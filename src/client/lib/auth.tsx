import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { User } from "@shared";

/**
 * The browser half of the login gate.
 *
 * The server owns the identity (an HttpOnly cookie the client can't read), so on
 * mount we ask `GET /api/me` who we are. `login`/`logout` hit the matching
 * endpoints and update the cached `user`. `RequireAuth` in `app.tsx` reads
 * `loading`/`user` to decide whether to render a route or redirect to `/login`.
 */

interface AuthState {
  /** The signed-in identity, or null when logged out. */
  user: User | null;
  /** True until the initial `GET /api/me` resolves — routes wait on this. */
  loading: boolean;
  /** Logs in with a username; resolves to the created identity or throws. */
  login: (username: string) => Promise<User>;
  /** Clears the session cookie and local state. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Reads a JSON error message from a failed response, with a fallback. */
async function errorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  const detail = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return detail?.error ?? fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from the session cookie on first load. A 401 just means logged out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/me");
        if (!cancelled) {
          setUser(response.ok ? ((await response.json()) as User) : null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string): Promise<User> => {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username })
    });
    if (!response.ok) {
      throw new Error(await errorMessage(response, "Couldn't sign you in."));
    }
    const next = (await response.json()) as User;
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      // Local state clears even if the network call fails — the cookie is
      // HttpOnly and short-lived, and the UI must reflect the intent to leave.
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth state. Must be called under an `<AuthProvider>`. */
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
