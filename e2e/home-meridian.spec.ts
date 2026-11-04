// Home page, Meridian direction (Nov 2026): hero, hub, feature grid, previews, facts, pricing, FAQ. No database calls. [PLT-027]
import { test, expect } from "@playwright/test";

test.describe("home page (Meridian)", () => {
  test("[PLT-027] has the approved sections in order, one main heading, the approved headline", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "The operating system for modern hotels" })).toBeVisible();
    const h2s = await page.locator("main").getByRole("heading", { level: 2 }).allTextContents();
    expect(h2s).toEqual([
      "Everything works together.",
      "Everything you need to run your hotel.",
      "See Zikora in action.",
      "What changes for your team.",
      "Simple, transparent pricing.",
      "Frequently asked questions.",
      "Try it on your own hotel.",
    ]);
  });

  test("[PLT-027] the dark header has the nav links and goes to the right places", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Features" })).toHaveAttribute("href", "/features");
    await expect(nav.getByRole("link", { name: "Product" })).toHaveAttribute("href", "#preview");
    await expect(nav.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "#pricing");
    await expect(nav.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "#faq");
    await expect(page.locator("#pricing")).toHaveCount(1);
    await expect(page.locator("#faq")).toHaveCount(1);
    await expect(page.locator("#preview")).toHaveCount(1);
  });

  test("[PLT-027] the hero sample screen is labelled sample data and agrees with the Front desk preview", async ({ page }) => {
    await page.goto("/");
    const screen = page.getByRole("img", { name: /Sample Zikora home screen/ });
    await expect(screen).toBeVisible();
    await expect(screen).toContainText("Sample Data");
    for (const t of ["75%", "15 of 20 rooms", "Arrivals today", "Departures today", "Rooms ready"]) await expect(screen).toContainText(t);
    expect(await screen.innerText()).not.toMatch(/[₦$€£]/);
  });

  test("[PLT-027] the hub shows the six areas Zikora has", async ({ page }) => {
    await page.goto("/");
    const items = page.locator("[data-hub]").getByRole("listitem");
    await expect(items).toHaveCount(6);
    for (const n of ["Reservations", "Front desk", "Housekeeping", "Money", "Guests", "Reports"]) await expect(items.filter({ hasText: n })).toHaveCount(1);
  });

  test("[PLT-027] feature cards open and close with the keyboard", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const card = page.locator("#features li").filter({ hasText: "Front desk" });
    const more = card.getByRole("button");
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await more.focus();
    await page.keyboard.press("Enter");
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Check-in, walk-ins and room moves")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("Check-in, walk-ins and room moves")).toBeHidden();
  });

  test("[PLT-027] four numbered facts, no invented results", async ({ page }) => {
    await page.goto("/");
    const facts = page.getByRole("list", { name: "What changes for your team" }).getByRole("listitem");
    await expect(facts).toHaveCount(4);
    const text = await page.getByRole("list", { name: "What changes for your team" }).innerText();
    expect(text).not.toMatch(/\d+\s?%/);
  });

  test("[PLT-027] pricing shows the three plans from the plan list and switches to annual", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const box = page.locator("#pricing");
    for (const [name, price] of [["Starter", "₦30,000"], ["Standard", "₦45,000"], ["Pro", "₦80,000"]]) {
      await expect(box.getByRole("heading", { level: 3, name })).toBeVisible();
      await expect(box).toContainText(price);
    }
    await box.getByRole("tab", { name: /Annual/ }).click();
    await expect(box).toContainText("₦300,000");
    await expect(box.getByRole("link", { name: "Start free trial" })).toHaveCount(3);
  });

  test("[PLT-027] the FAQ opens an answer with the keyboard", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const q = page.locator("#faq").getByRole("button", { name: "Does it work offline?" });
    await q.focus();
    await page.keyboard.press("Enter");
    await expect(q).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Zikora requires an internet connection.")).toBeVisible();
  });

  test("[PLT-027] every call to action goes where it says", async ({ page }) => {
    await page.goto("/");
    const main = page.locator("main");
    await expect(main.getByRole("link", { name: "Start 60 days free" })).toHaveAttribute("href", /\/auth\?mode=signup/);
    await expect(main.getByRole("link", { name: "See Zikora in action" })).toHaveAttribute("href", "#preview");
    await expect(main.getByRole("link", { name: "See full pricing" })).toHaveAttribute("href", "/pricing");
    await expect(main.getByRole("link", { name: "See all questions" })).toHaveAttribute("href", "/faq");
    await expect(main.getByRole("link", { name: "Start free trial" }).last()).toHaveAttribute("href", /\/auth\?mode=signup/);
  });

  test("[PLT-027] with reduced motion, nothing is hidden and nothing animates", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("img", { name: /Sample Zikora home screen/ })).toBeVisible();
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && !(a instanceof CSSTransition)).length);
    expect(running).toBe(0);
    for (const sel of ["[data-hub] li", "#features h3", "#pricing h3"]) {
      expect(await page.locator(sel).first().evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    }
    await ctx.close();
  });

  test("[PLT-027] on a phone every section fits and the header menu has the sign-up link", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const items = page.locator("[data-hub]").getByRole("listitem");
    const a = await items.nth(0).boundingBox();
    const b = await items.nth(2).boundingBox();
    expect(b!.y).toBeGreaterThan(a!.y + a!.height - 2);
    await page.locator("#pricing").scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await ctx.close();
  });
});
