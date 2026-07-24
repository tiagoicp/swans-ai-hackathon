/**
 * The contract between the Worker and the browser.
 *
 * This module is pulled into the client bundle, so it must stay free of runtime
 * dependencies — no `agents`, no `ai`, no `zod`. Types and plain values only.
 */

// The Direct Actions catalog. Re-exported here because `@shared` resolves to
// this file alone — there is no `@shared/*` path in tsconfig.json.
export * from "./actions";

/**
 * The one tool declared without a server-side `execute`: the browser fulfills it
 * via the `onToolCall` callback. Both sides import this constant so the name
 * cannot drift.
 */
export const CLIENT_TOOL_TIMEZONE = "getUserTimezone" as const;

/**
 * A logged-in identity. There are no passwords: a username maps deterministically
 * to a `userId`, so the same name is the same user on any device.
 */
export type User = {
  /** Stable, slugified id derived from the username. Safe as a URL path segment. */
  userId: string;
  /** The display name the user typed, preserved as-entered. */
  username: string;
};

/**
 * Turns a raw username into a stable `userId`: trimmed, lowercased, spaces to
 * dashes, everything outside `[a-z0-9-]` stripped, repeat dashes collapsed. The
 * result must be safe both as the session-cookie id and as a `ChatAgent` room
 * name (which becomes a URL path segment). Returns "" when nothing survives, so
 * the caller can reject empty logins. Shared so client and server agree.
 */
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Broadcast by the agent when a scheduled task fires. */
export type ScheduledTaskEvent = {
  type: "scheduled-task";
  description: string;
  timestamp: string;
};

/** Narrows a parsed WebSocket payload, which may be any message on the socket. */
export function isScheduledTaskEvent(
  value: unknown
): value is ScheduledTaskEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    event.type === "scheduled-task" &&
    typeof event.description === "string" &&
    typeof event.timestamp === "string"
  );
}
