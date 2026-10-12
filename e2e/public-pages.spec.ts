// Public pages: readable signed out, static (no database calls), one heading each, and the signed-in rules:
// only "/" sends a signed-in user to the app; other public pages show "Open the app" instead of "Sign in".
import { test, expect } from "@playwright/test";
import { createTestUser } from "./local-supabase";

const PAGES: [string, RegExp][] = [
  ["/", /Know what’s happening in your hotel\. Keep control of the details\./],
  ["/features", /The workflows behind a well-run hotel/],
  ["/pricing", /The right tools for the way your hotel runs/],
  ["/security", /Accountability should be built into the workflow/],
  ["/faq", /Frequently asked questions/],
  ["/about", /Built around the work that keeps a hotel running/],
  ["/contact", /Tell us about your hotel/],
  ["/walkthrough", /See how the workflows fit together/],
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
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible(); // header and footer both link to sign-in
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
  const q = page.getByRole("button", { name: /Does it work offline/ });
  await q.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Zikora requires an internet connection/)).toBeVisible();
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

// [PLT-016] The pricing page offers 60 days free, and the button opens the Create account tab.
test("[PLT-016] pricing page offers 60 days free and the button opens Create account", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 2, name: "Try Zikora free for 60 days." })).toBeVisible();
  await page.getByRole("link", { name: "Start your free trial" }).click();
  await expect(page).toHaveURL(/\/auth\?mode=signup$/);
  await expect(page.getByRole("tab", { name: "Create account" })).toHaveAttribute("aria-selected", "true");
});

// [NFR-008] The public header stays one slim row on a phone and a tablet, and the menu reaches every page.
for (const [label, width, height] of [["phone", 390, 844], ["tablet", 768, 1024]] as const) {
  test(`[NFR-008] public header is one row with a working menu on a ${label}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    for (const path of ["/", "/features", "/pricing", "/contact"]) {
      await page.goto(path);
      const m = await page.evaluate(() => ({ h: document.querySelector("header")!.getBoundingClientRect().height, sw: document.documentElement.scrollWidth, iw: innerWidth }));
      expect(m.h, `${path} header height`).toBeLessThanOrEqual(72);
      expect(m.sw, `${path} scrolls sideways`).toBeLessThanOrEqual(m.iw);
    }
    await page.goto("/");
    // The first tap can land before the page has finished loading, so tap again until the menu opens.
    await expect(async () => {
      await page.getByRole("button", { name: "Open menu" }).tap();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    for (const name of ["Features", "Security", "Pricing", "FAQ", "About", "Contact", "Request a walkthrough"]) {
      await expect(page.getByRole("dialog").getByRole("link", { name })).toBeVisible();
    }
    await page.getByRole("dialog").getByRole("link", { name: "Pricing" }).tap();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await ctx.close();
  });
}
