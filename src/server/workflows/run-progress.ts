import { DurableObject } from "cloudflare:workers";

/**
 * Per-step progress for a Workflow run.
 *
 * Workflows deliberately does not expose step-level progress: `instance.status()`
 * returns `{ status, error?, output? }` and nothing more. A workflow that wants
 * to narrate itself has to publish that narration somewhere the poller can read,
 * which is what this Durable Object is for. One instance per run, addressed by
 * the workflow's own `event.instanceId`.
 *
 * Everything here has to be **idempotent**. Workflows re-runs `run()` from the
 * top when an instance restarts, replaying cached steps instantly, so any write
 * sitting between steps executes again. That is why finished steps are recorded
 * by name in a set rather than counted — re-marking a step is a no-op, whereas a
 * `count++` would silently inflate on every replay.
 */

/** What the poller reads back. Shaped to drop straight into `ActionRunState`. */
export interface RunProgressSnapshot {
  step: string;
  stepIndex: number;
  stepCount: number;
}

interface StoredProgress {
  stepCount: number;
  /** Names of steps known to have finished. A set, stored as an array. */
  done: string[];
  /** What to show while the run is in flight. */
  label: string;
}

const KEY = "progress";

/** How long a finished run's progress sticks around before it deletes itself. */
const RETENTION_MS = 60 * 60 * 1000;

export class RunProgress extends DurableObject<Env> {
  /**
   * Records the shape of the run. A no-op once begun, so a replay cannot reset
   * the label back to the first phase while later steps are already running.
   */
  async begin(stepCount: number, label: string): Promise<void> {
    const existing = await this.ctx.storage.get<StoredProgress>(KEY);
    if (existing) return;

    await this.ctx.storage.put<StoredProgress>(KEY, {
      stepCount,
      done: [],
      label
    });
    // Progress is scaffolding, not a record worth keeping. Clean up after
    // anyone who might still be watching has long since stopped.
    await this.ctx.storage.setAlarm(Date.now() + RETENTION_MS);
  }

  /**
   * Marks one step finished, optionally moving the run to a new phase label.
   * Safe to call repeatedly with the same name.
   */
  async mark(name: string, label?: string): Promise<void> {
    const state = await this.ctx.storage.get<StoredProgress>(KEY);
    if (!state) return;

    const done = state.done.includes(name) ? state.done : [...state.done, name];
    await this.ctx.storage.put<StoredProgress>(KEY, {
      ...state,
      done,
      label: label ?? state.label
    });
  }

  async read(): Promise<RunProgressSnapshot | null> {
    const state = await this.ctx.storage.get<StoredProgress>(KEY);
    if (!state) return null;

    return {
      step: state.label,
      stepIndex: state.done.length,
      stepCount: state.stepCount
    };
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
