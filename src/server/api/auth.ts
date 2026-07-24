import { normalizeUsername, type User } from "@shared";

/**
 * HTTP surface for the prototype login gate.
 *
 *   POST /api/login    { username }  →  User          (+ Set-Cookie session)
 *   GET  /api/me                     →  User | 401
 *   POST /api/logout                 →  204            (clears the cookie)
 *
 * There are no passwords. A username maps deterministically to a `userId`
 * (see `normalizeUsername`), and the identity lives entirely in a self-contained
 * cookie — no server-side session store. The cookie is intentionally not signed:
 * with no password anyone can already log in as anyone, so tamper-proofing would
 * add complexity for no security gain.
 */

const COOKIE_NAME = "swans_session";
/** 30 days. Long enough that the prototype never surprises anyone by expiring. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
/** Guards against an absurdly long value ending up in a cookie. */
const MAX_USERNAME_LENGTH = 64;

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, {
    status,
    // An identity is per-user; never let a shared cache hold onto it.
    headers: { "cache-control": "no-store", ...headers }
  });
}

// ── Cookie encoding ───────────────────────────────────────────────────
// The value is base64url(JSON(User)) over UTF-8 bytes, so a username with
// non-Latin characters survives `btoa`, which is Latin1-only.

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlToBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeSession(user: User): string {
  return bytesToBase64url(new TextEncoder().encode(JSON.stringify(user)));
}

/** Returns the session, or null when the value is missing or malformed. */
function decodeSession(value: string | undefined): User | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(
      new TextDecoder().decode(base64urlToBytes(value))
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as User).userId === "string" &&
      typeof (parsed as User).username === "string" &&
      (parsed as User).userId.length > 0
    ) {
      return parsed as User;
    }
  } catch {
    // Not our cookie, or someone tampered with it — treat as logged out.
  }
  return null;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/**
 * Builds a `Set-Cookie` value. `Secure` is added only over https — a plain-http
 * `wrangler dev` would silently drop a `Secure` cookie otherwise. Pass maxAge 0
 * to clear.
 */
function serializeSessionCookie(
  value: string,
  maxAge: number,
  secure: boolean
): string {
  const attrs = [
    `${COOKIE_NAME}=${value}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

/**
 * Reads and validates the session cookie on any request, returning the identity
 * or null when logged out. The gate in `index.ts` uses this to protect the
 * `/api/action*` and `/agents/*` surfaces.
 */
export function getSession(request: Request): User | null {
  return decodeSession(readCookie(request, COOKIE_NAME));
}

// ── Routing ───────────────────────────────────────────────────────────

/**
 * Routes `/api/login`, `/api/me`, `/api/logout`. Returns null when the path is
 * not ours, so the caller can fall through to the other handlers.
 */
export async function handleAuthRequest(
  request: Request,
  _env: Env,
  url: URL
): Promise<Response | null> {
  const secure = url.protocol === "https:";

  if (url.pathname === "/api/login") {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    return login(request, secure);
  }

  if (url.pathname === "/api/me") {
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }
    const user = getSession(request);
    return user ? json(user) : json({ error: "Not signed in" }, 401);
  }

  if (url.pathname === "/api/logout") {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    return new Response(null, {
      status: 204,
      headers: {
        "cache-control": "no-store",
        "set-cookie": serializeSessionCookie("", 0, secure)
      }
    });
  }

  return null;
}

async function login(request: Request, secure: boolean): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  const { username } = (body ?? {}) as { username?: unknown };
  if (typeof username !== "string" || username.trim().length === 0) {
    return json({ error: "Enter a username." }, 400);
  }
  if (username.length > MAX_USERNAME_LENGTH) {
    return json(
      { error: `Keep the username under ${MAX_USERNAME_LENGTH} characters.` },
      400
    );
  }

  const userId = normalizeUsername(username);
  if (userId.length === 0) {
    return json(
      { error: "Use at least one letter or number in the username." },
      400
    );
  }

  const user: User = { userId, username: username.trim() };
  return json(user, 200, {
    "set-cookie": serializeSessionCookie(
      encodeSession(user),
      MAX_AGE_SECONDS,
      secure
    )
  });
}
