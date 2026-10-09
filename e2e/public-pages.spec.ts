// Public pages: readable signed out, static (no database calls), one heading each, and the signed-in rules:
// only "/" sends a signed-in user to the app; other public pages show "Open the app" instead of "Sign in".
import { test, expect } from "@playwright/test";
import { createTestUser } from "./local-supabase";

const PAGES: [string, RegExp][] = [
  ["/", /Know every payment that comes through your front desk/],
  ["/features", /Everything your hotel's front office runs on/],
  ["/pricing", /Try it free\. Pay for the size of your hotel/],
  ["/security", /Guest records and hotel money, protected on purpose/],
  ["/faq", /Questions hotel owners ask/],
  ["/about", /About Zikora/],
  ["/contact", /Talk to a real person/],
  ["/privacy", /Privacy notice/],
  ["/terms", /Terms of use/],
];

test("every public page opens signed out, with one main heading and no database calls", async ({ page }) => {
  const dbCalls: string[] = [];
  page.on("request", (r) => { if (/\/rest\/v1\//.test(r.url())) dbCalls.push(r.url()); });
  for (const [path, heading] of PAGES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path}`));
  }
  expect(dbCalls, "public pages must not call the database").toEqual([]);
});

test("privacy and terms say they are drafts pending legal review", async ({ page }) => {
  for (const path of ["/privacy", "/terms"]) {
    await page.goto(path);
    await expect(page.getByText("Draft, pending legal review.")).toBeVisible();
  }
});

test("the first Tab on a public page offers Skip to content", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});

test("FAQ answers open with the keyboard", async ({ page }) => {
  await page.goto("/faq");
  await page.waitForLoadState("networkidle"); // the questions open once the page has started up
  const q = page.getByRole("button", { name: /Does it work without internet/ });
  await q.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("No, it needs an internet connection.")).toBeVisible();
});

test("signed in: / goes to the app; other public pages stay readable with Open the app", async ({ page }) => {
  const user = await createTestUser("public");
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your hotel" })).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(/\/(dashboard|create-hotel)$/);
  await page.goto("/pricing");
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole("link", { name: "Open the app" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
});
