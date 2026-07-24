import { routeAgentRequest } from "agents";
import { handleActionRequest } from "./api/actions";
import { getSession, handleAuthRequest } from "./api/auth";
import type { User } from "@shared";

// Durable Object and Workflow classes must be exported from the Worker
// entrypoint — this is how Wrangler resolves the bindings declared in
// wrangler.jsonc.
export { ChatAgent } from "./agents/chat";
export { JokeWorkflow } from "./workflows/joke";
export { RunProgress } from "./workflows/run-progress";

function unauthorized(message: string, status: number): Response {
  return Response.json(
    { error: message },
    { status, headers: { "cache-control": "no-store" } }
  );
}

/**
 * Forces the agent room to the signed-in user's id.
 *
 * The chat room lives in the request path as `/agents/<namespace>/<room>` (see
 * partyserver's `routePartykitRequest`, which routes on `idFromName(room)`). We
 * overwrite that room segment with `session.userId` so the browser never chooses
 * — or spoofs — whose chat it opens; it sends a placeholder and the server
 * resolves who "me" is. Returns the original request when it already targets the
 * right room or isn't an agent path. Rebuilding the request is safe for
 * WebSocket upgrades — partyserver reconstructs the request the same way.
 */
function scopeAgentToUser(request: Request, url: URL, session: User): Request {
  const parts = url.pathname.split("/").filter(Boolean);
  if (
    parts[0] !== "agents" ||
    parts.length < 3 ||
    parts[2] === session.userId
  ) {
    return request;
  }
  parts[2] = session.userId;
  const scoped = new URL(url);
  scoped.pathname = `/${parts.join("/")}`;
  return new Request(scoped.toString(), request);
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    // The login endpoints are public and manage their own cookie state.
    const authResponse = await handleAuthRequest(request, env, url);
    if (authResponse) return authResponse;

    // Everything past the login gate — the Direct Actions API and the chat
    // agent WebSocket — requires a valid session. The Worker only ever runs for
    // `/api/*`, `/agents/*` and `/oauth/*` (see `run_worker_first`), so this
    // never touches static asset serving.
    const session = getSession(request);
    if (!session) {
      return unauthorized("Not signed in", 401);
    }

    const actionResponse = await handleActionRequest(request, env, url);
    if (actionResponse) return actionResponse;

    // The chat agent's room is set here from the session, not by the client.
    return (
      (await routeAgentRequest(scopeAgentToUser(request, url, session), env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
