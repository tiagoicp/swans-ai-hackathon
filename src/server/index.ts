import { routeAgentRequest } from "agents";
import { handleProcess } from "./routes/process";

// Durable Object classes must be exported from the Worker entrypoint —
// this is how Wrangler resolves the bindings declared in wrangler.jsonc.
export { ChatAgent } from "./agents/chat";

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    // `/api/*` reaches the Worker because it's listed in
    // `assets.run_worker_first` in wrangler.jsonc.
    if (url.pathname === "/api/process" && request.method === "POST") {
      return handleProcess(request, env);
    }

    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
