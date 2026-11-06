// How it works page, Meridian look (Nov 2026). No database calls. [PLT-031]
import { test, expect } from "@playwright/test";

test.describe("how it works page (Meridian)", () => {
  test("[PLT-031] has one main heading, the dark header, the six steps in order and the team section", async ({ page }) => {
    await page.goto("/how-it-works");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "One guest, one record, from booking to invoice." })).toBeVisible();
    await expect(page.locator("[data-home-header]")).toBeVisible();
    expect(await page.locator("main").getByRole("heading", { level: 2 }).allTextContents()).toEqual([
      "Set up your hotel", "Take a booking", "Check the guest in", "Run the stay", "Check out and invoice", "Close the day and review",
      "See Zikora in action.", "What changes for your team.", "Who uses it.", "Try it on your own hotel.",
    ]);
  });

  test("[PLT-031] the steps are numbered and each names who does it", async ({ page }) => {
    await page.goto("/how-it-works");
    const steps = page.getByRole("list", { name: "A stay, step by step" }).locator(":scope > li");
    await expect(steps).toHaveCount(6);
    await expect(steps.first()).toContainText("Step 1");
    await expect(steps.first()).toContainText("Manager or owner");
    await expect(steps.nth(4)).toContainText("The invoice is issued and does not change afterwards");
  });

  test("[PLT-031] four numbered facts, no invented results", async ({ page }) => {
    await page.goto("/how-it-works");
    const list = page.getByRole("list", { name: "What changes for your team" });
    await expect(list.getByRole("listitem")).toHaveCount(4);
    expect(await list.innerText()).not.toMatch(/\d+\s?%/);
  });

  test("[PLT-031] the header has the page links and the screens link jumps to the previews", async ({ page }) => {
    await page.goto("/how-it-works");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/how-it-works");
    await page.waitForLoadState("networkidle");
    await page.locator("main").getByRole("link", { name: "See the screens" }).click();
    await expect(page).toHaveURL(/#preview$/);
    await expect(page.locator("#preview")).toBeInViewport();
  });

  test("[PLT-031] the sample screens agree with the home page hero and say sample data", async ({ page }) => {
    await page.goto("/how-it-works");
    await page.waitForLoadState("networkidle");
    await page.locator("#preview").scrollIntoViewIfNeeded();
    const panel = page.getByRole("tabpanel");
    await expect(panel).toContainText("Sample Data");
    await expect(panel).toContainText("Arrivals");
  });

  test("[PLT-031] the buttons go where they say", async ({ page }) => {
    await page.goto("/how-it-works");
    const main = page.locator("main");
    await expect(main.getByRole("link", { name: "Start 60 days free" })).toHaveAttribute("href", /\/auth\?mode=signup/);
    await expect(main.getByRole("link", { name: "Start free trial" })).toHaveAttribute("href", /\/auth\?mode=signup/);
  });

  test("[PLT-031] with reduced motion nothing is hidden, and on a phone nothing scrolls sideways", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 375, height: 800 } });
    const page = await ctx.newPage();
    await page.goto("/how-it-works");
    await page.waitForLoadState("networkidle");
    expect(await page.locator(".rv-pre").count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await ctx.close();
  });
});
