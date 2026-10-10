// Browser tests. They run the app on port 8081 against LOCAL Supabase (Docker) only, never a real project.
// Run: npm run test:e2e   (local Supabase must be running: supabase start)
import { defineConfig, devices } from "@playwright/test";
import { localSupabase } from "./e2e/local-supabase";
import { TEST_CRON_SECRET, TEST_FROM_EMAIL, TEST_RESEND_PORT } from "./e2e/test-env";

const local = localSupabase();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // The dev server compiles pages on first visit; give checks time on a cold start.
  expect: { timeout: 15_000 },
  reporter: process.env.GITHUB_ACTIONS ? [["list"], ["github"]] : [["list"]], // on GitHub, failures also appear as readable annotations
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
      // Local only. Without these, the server would read .env.local, which holds the real project's keys.
      SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey,
      // The scheduled sender talks to a stand-in for Resend started by e2e/outbox-cron.spec.ts, never the real one.
      CRON_SECRET: TEST_CRON_SECRET,
      RESEND_API_KEY: "local-test-resend-key",
      RESEND_API_URL: `http://127.0.0.1:${TEST_RESEND_PORT}`,
      OUTBOX_FROM_EMAIL: TEST_FROM_EMAIL,
    },
  },
});
