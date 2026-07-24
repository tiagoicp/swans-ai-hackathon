import { routeAgentRequest } from "agents";

// Durable Object classes must be exported from the Worker entrypoint —
// this is how Wrangler resolves the bindings declared in wrangler.jsonc.
export { ChatAgent } from "./agents/chat";

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
