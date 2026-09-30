// Browser tests. They run the app on port 8081 against LOCAL Supabase (Docker) only, never a real project.
// Run: npm run test:e2e   (local Supabase must be running: supabase start)
import { defineConfig, devices } from "@playwright/test";
import { localSupabase } from "./e2e/local-supabase";

const local = localSupabase();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // The dev server compiles pages on first visit; give checks time on a cold start.
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: "http://localhost:8081", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 8081 --strictPort",
    url: "http://localhost:8081/auth",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: local.url,
      VITE_SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
      VITE_SUPABASE_PROJECT_ID: "local",
      SUPABASE_URL: local.url,
      SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
    },
  },
});
