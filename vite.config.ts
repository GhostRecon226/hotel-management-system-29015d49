// Plain Vite config for TanStack Start. Replaces the Lovable preset (@lovable.dev/vite-tanstack-config).
// Dev server: http://localhost:8080. Production build: Nitro with the Vercel preset (decision 5c).
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => ({
  server: { host: "::", port: 8080 },
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
    ...(command === "build" ? [nitro({ preset: process.env["NITRO_PRESET"] ?? "vercel" })] : []),
    viteReact(),
  ],
}));
