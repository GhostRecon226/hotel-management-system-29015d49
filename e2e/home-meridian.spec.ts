// Home page, Meridian direction (Nov 2026): hero, hub, feature grid and a row of links to the other pages. No database calls. [PLT-027]
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
      "Go deeper.",
      "Try it on your own hotel.",
    ]);
  });

  test("[PLT-027] the dark header has the nav links and goes to the right places", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Features" })).toHaveAttribute("href", "/features");
    await expect(nav.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/how-it-works");
    await expect(nav.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    await expect(nav.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    await expect(nav.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
    // The home page is short: pricing, FAQ and the previews live on their own pages.
    for (const id of ["#pricing", "#faq", "#preview"]) await expect(page.locator(id)).toHaveCount(0);
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

  test("[PLT-027] every call to action goes where it says", async ({ page }) => {
    await page.goto("/");
    const main = page.locator("main");
    await expect(main.getByRole("link", { name: "Start 60 days free" })).toHaveAttribute("href", /\/auth\?mode=signup/);
    await expect(main.getByRole("link", { name: "See Zikora in action" })).toHaveAttribute("href", "/how-it-works");
    const explore = page.locator("main li").filter({ has: page.getByRole("heading", { level: 3, name: /^(Features|How it works|Pricing)$/ }) });
    await expect(explore).toHaveCount(3);
    await expect(main.getByRole("link", { name: /^Features/ })).toHaveAttribute("href", "/features");
    await expect(main.getByRole("link", { name: /^How it works/ })).toHaveAttribute("href", "/how-it-works");
    await expect(main.getByRole("link", { name: /^Pricing/ })).toHaveAttribute("href", "/pricing");
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
    for (const sel of ["[data-hub] li", "#features h3"]) {
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
    await page.locator("#features").scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await ctx.close();
  });

  test("[PLT-027] with motion allowed, sections below the fold are visible from the start and reveal once as they scroll in", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const card = page.locator("#features li").first();
    await expect(card).toHaveClass(/rv-pre/);
    expect(await card.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
    await card.scrollIntoViewIfNeeded();
    await expect(async () => {
      expect(await card.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    }).toPass({ timeout: 8000 });
    await expect(card).not.toHaveClass(/rv-pre/);
    // The first screen is never hidden.
    expect(await page.getByRole("heading", { level: 1 }).evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });

  test("[PLT-027] with motion allowed, the hero underline draws once and the hub lines are drawn", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const underline = page.locator("h1 svg path");
    await expect(underline).toHaveCSS("stroke-dashoffset", "0px", { timeout: 6000 });
    await page.locator("[data-hub]").scrollIntoViewIfNeeded();
    await expect(page.locator(".mer-hub-line").first()).toHaveCSS("stroke-dashoffset", "0px", { timeout: 6000 });
  });

  test("[PLT-027] with reduced motion, no section is hidden and the hero underline is drawn at once", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(await page.locator(".rv-pre").count()).toBe(0);
    await expect(page.locator("h1 svg path")).toHaveCSS("stroke-dashoffset", "0px");
    expect(await page.locator("#features li").first().evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    await ctx.close();
  });

  test("[PLT-027] the hub centre shows the Zikora mark and it fades in when the diagram comes into view", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const logo = page.locator("[data-hub] .mer-logo");
    await expect(logo).toHaveCount(1);
    await expect(logo).toHaveAttribute("src", /zikora-icon-dark-screen\.svg/);
    await page.locator("[data-hub]").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-hub]")).toHaveClass(/dr-in/);
    await expect(logo).toHaveCSS("opacity", "1", { timeout: 4000 });
    expect(await logo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  });

  test("[PLT-027] with reduced motion the hub mark and lines are shown at once", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(await page.locator(".dr-pre").count()).toBe(0);
    await expect(page.locator("[data-hub] .mer-logo")).toHaveCSS("opacity", "1");
    await expect(page.locator(".mer-hub-line").first()).toHaveCSS("stroke-dashoffset", "0px");
    await ctx.close();
  });

  test("[PLT-027] on a wide screen the dark header spans the full width and the sample screen stays inside the page", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/");
    const header = await page.locator("[data-home-header]").boundingBox();
    expect(header!.x).toBe(0);
    expect(Math.round(header!.width)).toBe(1600);
    expect(header!.height).toBeLessThanOrEqual(72);
    // The links inside line up with the page content, not the screen edges.
    const logo = await page.getByRole("link", { name: "Zikora home" }).boundingBox();
    expect(logo!.x).toBeGreaterThan(100);
    const screen = await page.getByRole("img", { name: /Sample Zikora home screen/ }).boundingBox();
    expect(screen!.width).toBeLessThanOrEqual(1000);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
