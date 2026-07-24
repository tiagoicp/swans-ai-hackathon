import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import { type Schedule } from "agents";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  pruneMessages,
  stepCountIs,
  streamText,
  toUIMessageStream
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import type { ScheduledTaskEvent } from "@shared";
import { buildSystemPrompt } from "./prompts";
import { createTools } from "./tools";

/** Swap this to change the model backing the agent. */
const MODEL_ID = "@cf/moonshotai/kimi-k2.6";

/** Upper bound on tool-call round trips within a single response. */
const MAX_STEPS = 5;

export class ChatAgent extends AIChatAgent<Env> {
  maxPersistedMessages = 100;
  chatRecovery = true;

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const workersai = createWorkersAI({ binding: this.env.AI });

    const result = streamText({
      model: workersai(MODEL_ID, {
        sessionAffinity: this.sessionAffinity
      }),
      system: buildSystemPrompt(),
      // Prune old tool calls to save tokens on long conversations
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages"
      }),
      tools: createTools(this),
      stopWhen: stepCountIs(MAX_STEPS),
      abortSignal: options?.abortSignal
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream })
    });
  }

  async executeTask(description: string, _task: Schedule<string>) {
    // Do the actual work here (send email, call API, etc.)
    console.log(`Executing scheduled task: ${description}`);

    // Notify connected clients via a broadcast event.
    // We use broadcast() instead of saveMessages() to avoid injecting
    // into chat history — that would cause the AI to see the notification
    // as new context and potentially loop.
    const event: ScheduledTaskEvent = {
      type: "scheduled-task",
      description,
      timestamp: new Date().toISOString()
    };
    this.broadcast(JSON.stringify(event));
  }
}
