import {
  findAction,
  type ActionRunState,
  type StartRunResponse
} from "@shared";
import type { JokeWorkflowOutput } from "../workflows/joke/workflow";

/**
 * HTTP surface for Direct Actions.
 *
 *   POST /api/action           { type, count }  →  { runId }
 *   GET  /api/action/:runId                     →  ActionRunState
 *
 * The GET response is an `ActionRunState` verbatim, so the browser can hand it
 * straight to `setState`. Progress comes from two places that have to be merged:
 * `instance.status()` knows whether a run is queued/running/finished, and the
 * `RunProgress` Durable Object knows which step it is on — Workflows does not
 * expose the latter.
 */

/** Guards the path segment before it is used as a workflow instance id. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    // A run's state changes constantly; never let anything cache it.
    headers: { "cache-control": "no-store" }
  });
}

function errorState(message: string, status: number): Response {
  return json({ status: "error", message } satisfies ActionRunState, status);
}

/**
 * Routes `/api/action*`. Returns null when the path is not ours, so the caller
 * can fall through to the agent router.
 */
export async function handleActionRequest(
  request: Request,
  env: Env,
  url: URL
): Promise<Response | null> {
  if (url.pathname === "/api/action") {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    return startRun(request, env);
  }

  const match = /^\/api\/action\/([^/]+)$/.exec(url.pathname);
  if (match) {
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }
    return readRun(decodeURIComponent(match[1]), env);
  }

  return null;
}

async function startRun(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  const { type, count } = (body ?? {}) as { type?: unknown; count?: unknown };

  // The catalog in @shared is the single source of truth for what may run and
  // with what input — the same definitions the homepage grid renders from.
  const action = findAction(typeof type === "string" ? type : undefined);
  if (!action) {
    return json({ error: `Unknown action "${String(type)}".` }, 400);
  }
  if (action.status !== "live") {
    return json({ error: `The "${action.type}" action isn't live yet.` }, 400);
  }

  const countInput = action.countInput;
  if (!countInput) {
    return json({ error: `The "${action.type}" action takes no input.` }, 400);
  }
  if (
    typeof count !== "number" ||
    !Number.isInteger(count) ||
    count < countInput.min ||
    count > countInput.max
  ) {
    return json(
      {
        error: `count must be a whole number between ${countInput.min} and ${countInput.max}.`
      },
      400
    );
  }

  const runId = crypto.randomUUID();
  await env.JOKE_WORKFLOW.create({ id: runId, params: { count } });

  return json({ runId } satisfies StartRunResponse, 201);
}

async function readRun(runId: string, env: Env): Promise<Response> {
  if (!UUID_PATTERN.test(runId)) {
    return errorState("That isn't a valid run id.", 400);
  }

  let status;
  try {
    const instance = await env.JOKE_WORKFLOW.get(runId);
    status = await instance.status();
  } catch {
    // `get` throws for an id that never existed or has aged out of retention.
    return errorState("That run no longer exists.", 404);
  }

  switch (status.status) {
    case "complete": {
      const output = status.output as JokeWorkflowOutput | undefined;
      const results = output?.jokes ?? [];
      return json({ status: "complete", results } satisfies ActionRunState);
    }

    case "errored":
    case "terminated": {
      // Log the real cause; hand the browser something it can show a person.
      console.error(`run ${runId} ${status.status}`, status.error);
      return json({
        status: "error",
        message: "The joke workflow didn't finish. Try running it again."
      } satisfies ActionRunState);
    }

    default: {
      // queued / running / waiting / paused — ask the DO what step we're on.
      const progress = await env.RunProgress.get(
        env.RunProgress.idFromName(runId)
      ).read();

      return json({
        status: "running",
        // No progress record yet means the instance hasn't started its first
        // step. stepCount 0 tells the UI to show the label without a counter.
        step: progress?.step ?? "Queued",
        stepIndex: progress?.stepIndex ?? 0,
        stepCount: progress?.stepCount ?? 0
      } satisfies ActionRunState);
    }
  }
}
