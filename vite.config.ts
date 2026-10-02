// Vite config for TanStack Start.
// Dev server: http://localhost:8080. Production build: Nitro with the Vercel preset (decision 5c).
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => ({
  // "localhost" only: the dev server answers on this Mac and not to other devices on the same network.
  server: { host: "localhost", port: 8080 },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Our server entry wraps SSR errors (src/server.ts).
      server: { entry: "server" },
      // Server-only code must never be bundled for the browser.
      importProtection: { behavior: "error", client: { files: ["**/server/**"], specifiers: ["server-only"] } },
    }),
    // No Vercel cron yet: Hobby rejects a 5-minute schedule. Put it back on Pro (docs/deployment-plan.md, 4.4):
    // vercel: { config: { version: 3, crons: [{ path: "/api/cron/outbox", schedule: "*/5 * * * *" }] } },
    ...(command === "build" ? [nitro({ preset: process.env["NITRO_PRESET"] ?? "vercel" })] : []),
    viteReact(),
  ],
}));
