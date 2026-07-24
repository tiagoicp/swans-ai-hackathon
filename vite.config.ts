import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import agents from "agents/vite";

const resolvePath = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [agents(), react(), cloudflare(), tailwindcss()],
  resolve: {
    // Mirrors `paths` in tsconfig.json. The array form matches `@shared`
    // exactly, so it can never prefix-collide with a future `@shared/...`.
    alias: [
      { find: /^@shared$/, replacement: resolvePath("./src/shared/index.ts") },
      { find: /^@server\//, replacement: resolvePath("./src/server/") },
      { find: /^@client\//, replacement: resolvePath("./src/client/") }
    ]
  }
});
