// Pricing page, Meridian look (Nov 2026). No database calls. [PLT-029]
import { test, expect } from "@playwright/test";

test.describe("pricing page (Meridian)", () => {
  test("[PLT-029] has one main heading, the dark header and the three plans with their prices", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "The right tools for the way your hotel runs." })).toBeVisible();
    await expect(page.locator("[data-home-header]")).toBeVisible();
    const main = page.locator("main");
    for (const [name, price] of [["Starter", "₦30,000"], ["Standard", "₦45,000"], ["Pro", "₦80,000"]]) {
      const card = main.locator("section.mer-lift").filter({ has: page.getByRole("heading", { level: 3, name }) });
      await expect(card).toContainText(price);
      await expect(card).toContainText("or ₦");
    }
    await expect(main.getByRole("heading", { level: 2, name: "Enterprise" })).toBeVisible();
  });

  test("[PLT-029] the annual tab shows yearly prices", async ({ page }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: /Annual/ }).click();
    const main = page.locator("main");
    await expect(main).toContainText("₦300,000");
    await expect(main).toContainText("₦450,000");
    await expect(main).toContainText("₦800,000");
    await expect(main).toContainText("Same as ₦30,000 a month for 10 months");
  });

  test("[PLT-029] home page and pricing page show the same plan list", async ({ page }) => {
    await page.goto("/");
    const home = await page.locator("#pricing").innerText();
    await page.goto("/pricing");
    const pricing = await page.locator("main").innerText();
    for (const x of ["₦30,000", "₦45,000", "₦80,000", "Up to 20 rooms", "Up to 60 rooms", "Up to 150 rooms", "Up to 3 properties", "Up to 60 staff users"]) {
      expect(home).toContain(x);
      expect(pricing).toContain(x);
    }
  });

  test("[PLT-029] says what happens after the 60 days, in three steps", async ({ page }) => {
    await page.goto("/pricing");
    const steps = page.locator("main ol").last().getByRole("listitem");
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(1)).toContainText("14 days to pay");
    await expect(steps.nth(2)).toContainText("Nothing is deleted");
  });

  test("[PLT-029] the trial and contact buttons go where they say", async ({ page }) => {
    await page.goto("/pricing");
    const main = page.locator("main");
    await expect(main.getByRole("link", { name: "Start your free trial" })).toHaveAttribute("href", /\/auth\?mode=signup/);
    await expect(main.getByRole("link", { name: "Contact us" }).first()).toHaveAttribute("href", "/contact");
    await expect(main.getByRole("link", { name: "Start free trial" })).toHaveCount(3);
  });

  test("[PLT-029] with reduced motion nothing is hidden, and on a phone nothing scrolls sideways", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 375, height: 800 } });
    const page = await ctx.newPage();
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");
    expect(await page.locator(".rv-pre").count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await ctx.close();
  });
});
