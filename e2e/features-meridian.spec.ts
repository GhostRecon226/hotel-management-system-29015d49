// Features page, Meridian look (Nov 2026). No database calls. [PLT-028]
import { test, expect } from "@playwright/test";

const AREAS = ["Reservations and front desk", "Guest records", "Folios, charges and payment records", "Cashiering and collections", "Approvals and staff permissions", "Housekeeping and guest service", "Maintenance", "Business day and reporting", "Setup and continuity"];

test.describe("features page (Meridian)", () => {
  test("[PLT-028] shows the headline and the nine areas in order, with one main heading", async ({ page }) => {
    await page.goto("/features");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "The workflows behind a well-run hotel." })).toBeVisible();
    expect(await page.locator("main").getByRole("heading", { level: 2 }).allTextContents()).toEqual([...AREAS, "Try it on your own hotel, free for 60 days."]);
  });

  test("[PLT-028] keeps the checked wording and does not add claims", async ({ page }) => {
    await page.goto("/features");
    const text = await page.locator("main").innerText();
    expect(text).toContain("integrated online card or transfer collection inside Zikora is not currently available");
    expect(text).toContain("12-month retention rule");
    expect(text).toContain("A printable downtime pack covers longer disruptions");
    for (const banned of [/integrat(es|ion) with/i, /channel manager/i, /testimonial/i]) expect(text).not.toMatch(banned);
  });

  test("[PLT-028] uses the dark header and footer, with section links that go to the home page", async ({ page }) => {
    await page.goto("/features");
    await expect(page.locator("[data-home-header]")).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    await expect(nav.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    await expect(nav.getByRole("link", { name: "Features" })).toHaveAttribute("href", "/features");
  });

  test("[PLT-028] the jump list goes to each area", async ({ page }) => {
    await page.goto("/features");
    await page.waitForLoadState("networkidle");
    const jump = page.getByRole("navigation", { name: "Jump to an area" });
    await expect(jump.getByRole("link")).toHaveCount(9);
    await jump.getByRole("link", { name: "Maintenance" }).click();
    await expect(page).toHaveURL(/#maintenance$/);
    await expect(page.locator("#maintenance")).toBeInViewport();
  });

  test("[PLT-028] the buttons go where they say", async ({ page }) => {
    await page.goto("/features");
    const main = page.locator("main");
    await expect(main.getByRole("link", { name: "Start 60 days free" })).toHaveAttribute("href", /\/auth\?mode=signup/);
    await expect(main.getByRole("link", { name: "See pricing" })).toHaveAttribute("href", "/pricing");
    await expect(main.getByRole("link", { name: "Start free trial" })).toHaveAttribute("href", /\/auth\?mode=signup/);
  });

  test("[PLT-028] with reduced motion nothing is hidden, and on a phone nothing scrolls sideways", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 375, height: 800 } });
    const page = await ctx.newPage();
    await page.goto("/features");
    await page.waitForLoadState("networkidle");
    expect(await page.locator(".rv-pre").count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await ctx.close();
  });
});
