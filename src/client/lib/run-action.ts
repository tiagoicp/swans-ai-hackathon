import type { ActionRunState, StartRunResponse } from "@shared";

/**
 * The browser half of Direct Actions.
 *
 * A run is a real Cloudflare Workflow living on the server, so this is two
 * concerns rather than one call: `startRun` kicks a workflow off and hands back
 * its id, and `watchRun` follows an id that already exists. Keeping them apart
 * is what lets the id live in the URL — a reload calls only `watchRun` and
 * rejoins a run already in flight.
 *
 * `GET /api/action/:runId` returns an `ActionRunState` verbatim, so polling is
 * mostly just forwarding.
 */

const POLL_INTERVAL_MS = 900;

/** Stop following a run that has gone quiet for this long. */
const WATCH_TIMEOUT_MS = 3 * 60 * 1000;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Starts a run and resolves with its id. Throws if the server rejects the
 * request — the caller decides how to show that.
 */
export async function startRun(
  type: string,
  count: number,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch("/api/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, count }),
    signal
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(detail?.error ?? "Couldn't start the run.");
  }

  const { runId } = (await response.json()) as StartRunResponse;
  return runId;
}

/**
 * Polls a run until it finishes, reporting every state along the way.
 *
 * Aborting stops the polling but deliberately leaves the workflow running — a
 * run outliving the tab that started it is the whole point of building this on
 * Workflows, and the id in the URL is enough to pick it back up.
 */
export async function watchRun(
  runId: string,
  onState: (state: ActionRunState) => void,
  signal?: AbortSignal
): Promise<void> {
  const deadline = Date.now() + WATCH_TIMEOUT_MS;

  try {
    for (;;) {
      const response = await fetch(`/api/action/${encodeURIComponent(runId)}`, {
        signal
      });

      // Rejections carry an ActionRunState too, so anything unparseable here is
      // a genuine fault and belongs in the catch below.
      const state = (await response.json()) as ActionRunState;
      onState(state);

      if (state.status === "complete" || state.status === "error") return;

      if (Date.now() > deadline) {
        onState({
          status: "error",
          message: "This run is taking unusually long. It may still finish."
        });
        return;
      }

      await sleep(POLL_INTERVAL_MS, signal ?? new AbortController().signal);
    }
  } catch (error) {
    if (isAbort(error)) return;
    onState({
      status: "error",
      message: "Lost contact with the run. Check your connection and retry."
    });
  }
}
