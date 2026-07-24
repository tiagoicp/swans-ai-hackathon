/**
 * The one place that knows how a Direct Action executes.
 *
 * Today it is a mock. The shape, however, is deliberately that of a Cloudflare
 * Workflow run — start, then a sequence of named steps, then a result — so the
 * pages consuming it never have to change when the real backend lands.
 *
 * ── Swapping in the real Workflow ──────────────────────────────────────
 * 1. `wrangler.jsonc`: add a `workflows` binding for the joke workflow, and add
 *    `"/api/*"` to `assets.run_worker_first` (currently `["/agents/*",
 *    "/oauth/*"]`) so the Worker sees those requests instead of the asset
 *    server. Then `npm run types` and commit `worker-configuration.d.ts`.
 * 2. `src/server/index.ts`: route `POST /api/action` → `WORKFLOW.create(...)`,
 *    returning `{ instanceId }`, and `GET /api/action/:instanceId` →
 *    `instance.status()`.
 * 3. Replace the body of `runAction` below: POST to start, then poll a backend
 *    response that maps every Workflow lifecycle state. Because
 *    `instance.status()` exposes only `status`, `error`, and `output`, preserving
 *    named step progress requires the backend to persist and return it too.
 */

export type ActionRunState =
  | { status: "idle" }
  | { status: "running"; step: string; stepIndex: number; stepCount: number }
  | { status: "complete"; results: string[] }
  | { status: "error"; message: string };

/** Steps the UI narrates while a run is in flight. */
const JOKE_STEPS = [
  "Waking Lexi",
  "Drafting jokes",
  "Polishing punchlines"
] as const;

const CANNED_JOKES = [
  "Why did the swan refuse to join the band? It only knew one note, and it was a honk.",
  "A swan walks into a bar. The bartender says “we don't serve waterfowl.” The swan says “that's fine, I'm just here for the tap water.”",
  "What do you call a swan that's great at deploying software? A graceful rollout.",
  "Why are swans terrible at hide and seek? They always stick their necks out.",
  "How does a swan pay for coffee? With a bill, obviously.",
  "What's a swan's favourite kind of storage? A pond-ended queue.",
  "Why did the swan get promoted? Outstanding down-to-earth performance.",
  "Two swans are arguing about migration. One says “let's go south.” The other says “you always take the path of least resistance.”",
  "What do you call a swan with a great sense of timing? Punctual-ate.",
  "Why don't swans use cloud storage? They prefer to keep everything on the lake."
];

const STEP_DELAY_MS = 550;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Runs a Direct Action, reporting progress through `onState`.
 *
 * Resolves once the run reaches a terminal state. An aborted run reports
 * nothing further — the caller has already moved on.
 */
export async function runAction(
  type: string,
  count: number,
  onState: (state: ActionRunState) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    for (const [index, step] of JOKE_STEPS.entries()) {
      onState({
        status: "running",
        step,
        stepIndex: index + 1,
        stepCount: JOKE_STEPS.length
      });
      await sleep(STEP_DELAY_MS, signal);
    }

    if (type !== "joke") {
      onState({
        status: "error",
        message: `No workflow is wired up for "${type}" yet.`
      });
      return;
    }

    // Cycle the pool so a count larger than it still returns `count` jokes.
    const results = Array.from(
      { length: count },
      (_, i) => CANNED_JOKES[i % CANNED_JOKES.length]
    );
    onState({ status: "complete", results });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    onState({
      status: "error",
      message: error instanceof Error ? error.message : "Something went wrong."
    });
  }
}
