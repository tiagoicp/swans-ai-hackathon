# swans-ai-hackathon

Project candidate for Swans AI Applied Hackathon in Lisbon - July 2026

---

# COPY

# Agent Starter

![npm i agents command](./npm-agents-banner.svg)

<a href="https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/agents-starter"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare"/></a>

A starter template for building AI chat agents on Cloudflare, powered by the [Agents SDK](https://developers.cloudflare.com/agents/).

Uses Workers AI (no API key required), with tools for weather, timezone detection, calculations with approval, task scheduling, and vision (image input).

## Quick start

```bash
npx create-cloudflare@latest --template cloudflare/agents-starter
cd agents-starter
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to see your agent in action.

Try these prompts to see the different features:

- **"What's the weather in Paris?"** — server-side tool (runs automatically)
- **"What timezone am I in?"** — client-side tool (browser provides the answer)
- **"Calculate 5000 \* 3"** — approval tool (asks you before running)
- **"Remind me in 5 minutes to take a break"** — scheduling
- **Drop an image and ask "What's in this image?"** — vision (image understanding)

## Project structure

```
src/
  client/                 # runs in the browser
    main.tsx              # React entry point
    app.tsx               # router shell — maps routes to pages
    pages/                # one file per route
      home.tsx            # /
      chat.tsx            # /chat — chat UI built with Kumo components
      action.tsx          # /action
    styles.css            # Tailwind + Kumo styles
  server/                 # runs on Cloudflare (Worker + Durable Objects)
    index.ts              # Worker entry point — routes requests, exports agents
    agents/
      chat/               # everything about the chat agent lives here
        agent.ts          # the ChatAgent class, model choice
        prompts.ts        # system prompt
        tools.ts          # tool definitions
  shared/
    index.ts              # types and constants both sides agree on
```

Imports use path aliases: `@shared`, `@server/*`, and `@client/*` (declared in
`tsconfig.json` and mirrored in `vite.config.ts`).

### Adding a second agent

Create a sibling folder under `src/server/agents/`, export its class from
`src/server/index.ts`, then add a Durable Object binding and a migration entry in
`wrangler.jsonc`.

## What's included

- **AI Chat** — Streaming responses powered by Workers AI via `AIChatAgent`
- **Image input** — Drag-and-drop, paste, or click to attach images for vision-capable models
- **Three tool patterns** — server-side auto-execute, client-side (browser), and human-in-the-loop approval
- **Scheduling** — one-time, delayed, and recurring (cron) tasks
- **Reasoning display** — shows model thinking as it streams, collapses when done
- **Debug mode** — toggle in the header to inspect raw message JSON for each message
- **Kumo UI** — Cloudflare's design system with dark/light mode
- **Real-time** — WebSocket connection with automatic reconnection and message persistence

## Making it your own

### Name your project

Update the name in `package.json` and `wrangler.jsonc` — the `name` in `wrangler.jsonc` becomes your deployed Worker's URL (`<name>.<subdomain>.workers.dev`).

### Change the system prompt

Edit `buildSystemPrompt()` in `src/server/agents/chat/prompts.ts` to give your agent a different personality or focus area. This is the most impactful single change you can make.

### Replace the demo tools with real ones

The starter ships with demo tools (`getWeather` returns random data, `calculate` does basic arithmetic). Replace them with real implementations:

```ts
// In agents/chat/tools.ts, replace a demo tool with a real API call:
const getWeather = tool({
  description: "Get the current weather for a city",
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => {
    const res = await fetch(`https://api.weather.example/${city}`);
    return res.json();
  }
});
```

### Add your own tools

Add new tools to the object returned by `createTools()` in `src/server/agents/chat/tools.ts`.
Tools that need nothing from the agent can be module-level constants; tools that use agent
state (like scheduling) are built inside the factory, which receives the agent. There are
three patterns:

```ts
// Auto-execute: runs on the server, no user interaction
myTool: tool({
  description: "...",
  inputSchema: z.object({ /* ... */ }),
  execute: async (input) => { /* return result */ }
}),

// Client-side: no execute function, browser provides the result.
// Export the name from src/shared/index.ts (like CLIENT_TOOL_TIMEZONE) so the
// onToolCall handler in src/client/pages/chat.tsx matches the same constant, not a copy.
browserTool: tool({
  description: "...",
  inputSchema: z.object({ /* ... */ })
}),

// Approval: add needsApproval to gate execution
sensitiveTool: tool({
  description: "...",
  inputSchema: z.object({ /* ... */ }),
  needsApproval: async (input) => true, // or conditional logic
  execute: async (input) => { /* runs after approval */ }
}),
```

### Customize scheduled task behavior

When a scheduled task fires, `executeTask` runs on the server. It does its work and then uses `this.broadcast()` to notify connected clients (shown as a toast notification in the UI). Replace it with your own logic:

```ts
async executeTask(description: string, task: Schedule<string>) {
  // Do the actual work
  await sendEmail({ to: "user@example.com", subject: description });

  // Notify connected clients. ScheduledTaskEvent comes from src/shared, so the
  // client's isScheduledTaskEvent() guard stays in sync with what's sent here.
  const event: ScheduledTaskEvent = {
    type: "scheduled-task",
    description,
    timestamp: new Date().toISOString()
  };
  this.broadcast(JSON.stringify(event));
}
```

> **Why `broadcast()` instead of `saveMessages()`?** Injecting into chat history can cause the AI to see the notification as new context and re-trigger the same task in a loop. `broadcast()` sends a one-off event that the client displays separately from the conversation.

### Remove scheduling

If you don't need scheduling, remove `scheduleTask`, `getScheduledTasks`, and `cancelScheduledTask` from `agents/chat/tools.ts`; remove `executeTask` and the `Schedule` import from `agents/chat/agent.ts`; remove `ScheduledTaskEvent` and `isScheduledTaskEvent` from `shared/index.ts`; remove the scheduled-task import and `onMessage` handling from `client/pages/chat.tsx`; and remove `getSchedulePrompt` plus its interpolation from `agents/chat/prompts.ts`.

### Add state beyond chat messages

Use `this.setState()` and `this.state` for real-time state that syncs to all connected clients. See [Store and sync state](https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/).

### Add callable methods

Expose agent methods as typed RPC that your client can call directly:

```ts
import { callable } from "agents";

export class ChatAgent extends AIChatAgent<Env> {
  @callable()
  async getStats() {
    return { messageCount: this.messages.length };
  }
}

// Client-side:
const stats = await agent.call("getStats");
```

See [Callable methods](https://developers.cloudflare.com/agents/api-reference/callable-methods/).

## Use a different AI model provider

The starter uses [Workers AI](https://developers.cloudflare.com/workers-ai/) by default (no API key needed). To use a different provider:

### OpenAI

```bash
npm install @ai-sdk/openai
```

```ts
// In agents/chat/agent.ts, replace MODEL_ID and the model call:
import { openai } from "@ai-sdk/openai";

// Inside onChatMessage:
const result = streamText({
  model: openai("gpt-5.2")
  // ...
});
```

Create a `.env` file with your API key:

```
OPENAI_API_KEY=your-key-here
```

### Anthropic

```bash
npm install @ai-sdk/anthropic
```

```ts
import { anthropic } from "@ai-sdk/anthropic";

const result = streamText({
  model: anthropic("claude-sonnet-4-20250514")
  // ...
});
```

Create a `.env` file with your API key:

```
ANTHROPIC_API_KEY=your-key-here
```

## Deploy

```bash
npm run deploy
```

Your agent is live on Cloudflare's global network. Messages persist in SQLite, streams resume on disconnect, and the agent hibernates when idle.

## Learn more

- [Agents SDK documentation](https://developers.cloudflare.com/agents/)
- [Build a chat agent tutorial](https://developers.cloudflare.com/agents/getting-started/build-a-chat-agent/)
- [Chat agents API reference](https://developers.cloudflare.com/agents/api-reference/chat-agents/)
- [Workers AI models](https://developers.cloudflare.com/workers-ai/models/)

## License

MIT
