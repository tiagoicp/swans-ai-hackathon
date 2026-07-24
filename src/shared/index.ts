/**
 * The contract between the Worker and the browser.
 *
 * This module is pulled into the client bundle, so it must stay free of runtime
 * dependencies — no `agents`, no `ai`, no `zod`. Types and plain values only.
 */

/**
 * The one tool declared without a server-side `execute`: the browser fulfills it
 * via the `onToolCall` callback. Both sides import this constant so the name
 * cannot drift.
 */
export const CLIENT_TOOL_TIMEZONE = "getUserTimezone" as const;

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
