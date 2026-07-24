import { routeAgentRequest } from "agents";
import { handleActionRequest } from "./api/actions";
import { handleAuthRequest } from "./api/auth";

// Durable Object and Workflow classes must be exported from the Worker
// entrypoint — this is how Wrangler resolves the bindings declared in
// wrangler.jsonc.
export { ChatAgent } from "./agents/chat";
export { JokeWorkflow } from "./workflows/joke";
export { RunProgress } from "./workflows/run-progress";

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    return (
      (await handleAuthRequest(request, env, url)) ||
      (await handleActionRequest(request, env, url)) ||
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
