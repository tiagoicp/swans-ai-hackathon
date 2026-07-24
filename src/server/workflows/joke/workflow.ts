import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep
} from "cloudflare:workers";
import { generateText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { AI_GATEWAY_ID } from "../../ai";
import type { RunProgress } from "../run-progress";
import { buildAnglesPrompt, buildJokePrompt } from "./prompts";

/**
 * The `joke` Direct Action, as a real Workflow.
 *
 * Shape: plan, then fan out. One step asks the model for N distinct comedic
 * angles; then N steps run in parallel, each writing a single joke on one angle.
 * That is not decoration — each joke becomes an independently retried step, and
 * giving the model one angle at a time is what stops it repeating itself the way
 * it does when asked for ten jokes in a single breath.
 */

/**
 * Separate from the chat agent's model on purpose. The agent needs tool calling
 * and long context; this needs to return two sentences before a demo audience
 * gets bored. The chat model (kimi-k2.6) took well over a minute per joke —
 * this one is quantized and tuned for latency.
 */
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export interface JokeWorkflowParams {
  count: number;
}

export interface JokeWorkflowOutput {
  jokes: string[];
}

/**
 * Pulls a clean list out of whatever the model actually returned. Models like to
 * number things and add a preamble no matter what the prompt says, so strip
 * leading numbering/bullets and drop anything that is not a real line. The
 * result is forced to exactly `count` entries — cycling if the model was stingy
 * — so the fan-out below always produces the number of jokes that was asked for.
 */
function parseAngles(text: string, count: number): string[] {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0 && line.length < 120);

  if (lines.length === 0) {
    // No usable angles, but the run can still produce jokes — let the model
    // pick its own subject rather than failing the whole workflow.
    return Array.from({ length: count }, () => "anything about swans");
  }

  return Array.from({ length: count }, (_, i) => lines[i % lines.length]);
}

export class JokeWorkflow extends WorkflowEntrypoint<Env, JokeWorkflowParams> {
  async run(
    event: WorkflowEvent<JokeWorkflowParams>,
    step: WorkflowStep
  ): Promise<JokeWorkflowOutput> {
    const { count } = event.payload;
    const workersai = createWorkersAI({
      binding: this.env.AI,
      gateway: { id: AI_GATEWAY_ID }
    });
    const progress = this.env.RunProgress.get(
      this.env.RunProgress.idFromName(event.instanceId)
    );

    /**
     * Progress reporting is best-effort telemetry, and it lives *outside* the
     * steps by necessity — a step cannot announce that it is about to run. That
     * makes it replayable, which the RunProgress DO handles, but it also means a
     * failure here must never be allowed to error a workflow that has already
     * done real work. Hence: swallow.
     */
    const report = async (
      fn: (p: DurableObjectStub<RunProgress>) => Promise<void>
    ) => {
      try {
        await fn(progress);
      } catch (error) {
        console.error("progress report failed", error);
      }
    };

    // One step to plan, then one step per joke.
    await report((p) => p.begin(count + 1, "Planning the angles"));

    const angles = await step.do("plan-angles", async () => {
      const { text } = await generateText({
        model: workersai(MODEL_ID),
        prompt: buildAnglesPrompt(count)
      });
      return parseAngles(text, count);
    });

    await report((p) =>
      p.mark(
        "plan-angles",
        `Writing ${count} ${count === 1 ? "joke" : "jokes"}`
      )
    );

    const jokes = await Promise.all(
      angles.map(async (angle, index) => {
        // Deterministic name — step names are cache keys, so nothing random or
        // time-based may appear in them.
        const name = `write-joke-${index + 1}`;
        const joke = await step.do(name, async () => {
          const { text } = await generateText({
            model: workersai(MODEL_ID),
            prompt: buildJokePrompt(angle)
          });
          return text.trim();
        });
        await report((p) => p.mark(name));
        return joke;
      })
    );

    // Becomes `InstanceStatus.output`, which is how the API reads the result.
    return { jokes };
  }
}
