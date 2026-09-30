// The three sign-in flows that broke on 30 Sep 2026 (see docs/known-issues.md, "Sign-in and Create your hotel").
// Each test fails on any uncaught page error, a blank page, or a stuck "Creating…" button.
import { test, expect, type Page } from "@playwright/test";
import { createTestUser, passwordTokens } from "./local-supabase";

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message || String(e)));
  page.on("console", (m) => { if (m.type() === "error" && /Uncaught/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function createHotel(page: Page, name: string) {
  await expect(page.getByRole("heading", { name: "Create your hotel" })).toBeVisible();
  await page.getByLabel("Business name").fill(`${name} Ltd`);
  await page.getByLabel("Property name").fill(name);
  await page.getByLabel("Your full name").fill("Tess Tester");
  await page.getByLabel("City").fill("Lagos");
  await page.getByRole("button", { name: "Create hotel" }).click();
}

test("1. arriving from the email confirmation link shows Create your hotel, not a blank page", async ({ page }) => {
  const errors = watchErrors(page);
  const user = await createTestUser("link");
  const t = await passwordTokens(user.email, user.password);
  // The confirmation link lands on /dashboard with the session in the address, as Supabase sends it.
  const hash = new URLSearchParams({
    access_token: t.access_token, refresh_token: t.refresh_token, expires_in: String(t.expires_in),
    expires_at: String(t.expires_at), token_type: "bearer", type: "signup",
  });
  await page.goto(`/dashboard#${hash}`);
  await expect(page).toHaveURL(/\/create-hotel$/);
  await expect(page.getByRole("heading", { name: "Create your hotel" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("2. a new user signs in, creates a hotel and reaches the dashboard", async ({ page }) => {
  const errors = watchErrors(page);
  const user = await createTestUser("new");
  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/create-hotel$/);
  await createHotel(page, "Flow Two Lodge");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Flow Two Lodge").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Creating…" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("3. a returning user signs in straight to the dashboard, signs out and back in", async ({ page }) => {
  const errors = watchErrors(page);
  const user = await createTestUser("returning");
  await signIn(page, user.email, user.password);
  await createHotel(page, "Flow Three Lodge");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // Sign out: the app must go back to the sign-in page and keep nothing from the session.
  await page.evaluate(async () => {
    const m = await import("/src/integrations/supabase/client.ts");
    await m.supabase.auth.signOut();
  });
  await expect(page).toHaveURL(/\/auth/, { timeout: 15_000 });

  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  // Opening Create your hotel with a hotel already made goes to the dashboard.
  await page.goto("/create-hotel");
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(errors).toEqual([]);
});
