// Home page story: five sections, a connected hotel day, sample-data previews, calm motion. No database calls. [PLT-027]
import { test, expect } from "@playwright/test";

test.describe("home page", () => {
  test("[PLT-027] has the five approved sections in order, one main heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Run your whole hotel from one screen." })).toBeVisible();
    const h2s = await page.locator("main").getByRole("heading", { level: 2 }).allTextContents();
    expect(h2s).toEqual([
      "One guest. One day. Everything connected.",
      "See Zikora in action.",
      "Four jobs. One system.",
      "Try it on your own hotel.",
    ]);
  });

  test("[PLT-027] the hotel day shows five staff steps, in the approved words", async ({ page }) => {
    await page.goto("/");
    const steps = page.getByRole("list", { name: "A hotel day, step by step" }).getByRole("listitem");
    await expect(steps).toHaveCount(5);
    await expect(steps.nth(0)).toContainText("A reservation is created");
    await expect(steps.nth(0)).toContainText("The booking is recorded and availability is updated.");
    await expect(steps.nth(1)).toContainText("Front desk checks in");
    await expect(steps.nth(2)).toContainText("The room gets ready");
    await expect(steps.nth(3)).toContainText("The bill stays accurate");
    await expect(steps.nth(4)).toContainText("The day closes");
  });

  test("[PLT-027] the previews switch with the keyboard and say they are sample data", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const tabs = page.getByRole("tablist", { name: "Zikora previews" });
    await expect(tabs.getByRole("tab")).toHaveText(["Front desk", "Rooms", "Money", "Reports"]);
    await tabs.getByRole("tab", { name: "Front desk" }).focus();
    await expect(page.getByRole("tabpanel").getByText("Arrivals today", { exact: true })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: "Rooms", selected: true })).toBeVisible();
    await expect(page.getByRole("tabpanel").getByText("Room board", { exact: true })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tabpanel").getByText("Guest folio", { exact: true })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tabpanel").getByText("Daily report", { exact: true })).toBeVisible();
    await expect(page.getByText(/Sample data\. Not a live hotel account\./)).toBeVisible();
  });

  test("[PLT-027] the copy stays inside what the product does", async ({ page }) => {
    await page.goto("/");
    const text = (await page.locator("main").innerText()).toLowerCase();
    for (const banned of ["nigeria", "inventory", "procurement", "testimonial", "guest app", "self-service", "integration"]) {
      expect(text, `home page must not say "${banned}"`).not.toContain(banned);
    }
  });

  test("[PLT-027] every call to action goes where it says", async ({ page }) => {
    await page.goto("/");
    const main = page.locator("main");
    await expect(main.getByRole("link", { name: "Start 60 days free" })).toHaveAttribute("href", /\/auth\?mode=signup/);
    await expect(main.getByRole("link", { name: "See Zikora in action" })).toHaveAttribute("href", "#preview");
    await expect(main.getByRole("link", { name: "Explore all features" })).toHaveAttribute("href", "/features");
    await expect(main.getByRole("link", { name: "Start free trial" })).toHaveAttribute("href", /\/auth\?mode=signup/);
    await expect(main.getByRole("link", { name: /How Zikora handles security/ })).toHaveAttribute("href", "/security");
    await expect(page.locator("#preview")).toBeVisible();
  });

  test("[PLT-027] with reduced motion, nothing animates and everything is visible", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const steps = page.getByRole("list", { name: "A hotel day, step by step" }).getByRole("listitem");
    await steps.last().scrollIntoViewIfNeeded();
    for (let i = 0; i < 5; i++) {
      await expect(steps.nth(i)).toBeVisible();
      expect(await steps.nth(i).evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    }
    const names = await page.locator("[data-hotel-scene] *").evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName));
    expect(names.every((n) => n === "none")).toBe(true);
    await ctx.close();
  });

  test("[PLT-027] with motion allowed, the hotel scene animates once", async ({ page }) => {
    await page.goto("/");
    const names = await page.locator("[data-hotel-scene] [data-window]").evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName));
    expect(names.length).toBeGreaterThanOrEqual(6);
    expect(names.every((n) => n !== "none")).toBe(true);
    const counts = await page.locator("[data-hotel-scene] [data-window]").first().evaluate((e) => getComputedStyle(e).animationIterationCount);
    expect(counts).toBe("1");
  });

  test("[PLT-027] with motion allowed, the steps reveal as they scroll into view", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const steps = page.getByRole("list", { name: "A hotel day, step by step" }).getByRole("listitem");
    await steps.last().scrollIntoViewIfNeeded();
    for (let i = 0; i < 5; i++) await expect(async () => {
      expect(await steps.nth(i).evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    }).toPass({ timeout: 8000 });
  });

  test("[PLT-027] on a phone the steps stack and nothing scrolls sideways", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const steps = page.getByRole("list", { name: "A hotel day, step by step" }).getByRole("listitem");
    const a = await steps.nth(0).boundingBox();
    const b = await steps.nth(1).boundingBox();
    expect(b!.y).toBeGreaterThan(a!.y + a!.height - 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await ctx.close();
  });
});
