// FAQ page, Meridian look (Nov 2026). No database calls. [PLT-030]
import { test, expect } from "@playwright/test";

const GROUPS = ["About Zikora", "Money and controls", "Daily operations", "What is not available yet", "Data and security", "Pricing and next steps"];

test.describe("FAQ page (Meridian)", () => {
  test("[PLT-030] has one main heading, the dark header, and every topic in order", async ({ page }) => {
    await page.goto("/faq");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Frequently asked questions" })).toBeVisible();
    await expect(page.locator("[data-home-header]")).toBeVisible();
    expect(await page.locator("main").getByRole("heading", { level: 2 }).allTextContents()).toEqual([...GROUPS, "Have another question?"]);
  });

  test("[PLT-030] shows all fourteen questions, including what is not available yet", async ({ page }) => {
    await page.goto("/faq");
    await expect(page.locator("main").getByRole("button", { name: /\?$/ })).toHaveCount(14);
    await expect(page.getByRole("button", { name: /Can Zikora send guest messages/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /online booking sites/ })).toBeVisible();
  });

  test("[PLT-030] answers open with the keyboard", async ({ page }) => {
    await page.goto("/faq");
    await page.waitForLoadState("networkidle");
    const q = page.getByRole("button", { name: /Does it work offline/ });
    await q.focus();
    await page.keyboard.press("Enter");
    await expect(q).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/Zikora requires an internet connection/)).toBeVisible();
  });

  test("[PLT-030] the topic list jumps to each topic", async ({ page }) => {
    await page.goto("/faq");
    await page.waitForLoadState("networkidle");
    const jump = page.getByRole("navigation", { name: "Jump to a topic" });
    await expect(jump.getByRole("link")).toHaveCount(6);
    await jump.getByRole("link", { name: "Data and security" }).click();
    await expect(page).toHaveURL(/#faq-data-and-security$/);
    await expect(page.locator("#faq-data-and-security")).toBeInViewport();
  });

  test("[PLT-030] the contact button goes to the contact page, and the structured data lists every question", async ({ page }) => {
    await page.goto("/faq");
    await expect(page.locator("main").getByRole("link", { name: "Contact the Zikora team" })).toHaveAttribute("href", "/contact");
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(ld.join("")).toContain("FAQPage");
    expect((ld.join("").match(/"@type":"Question"/g) ?? []).length).toBe(14);
  });

  test("[PLT-030] with reduced motion nothing is hidden, and on a phone nothing scrolls sideways", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 375, height: 800 } });
    const page = await ctx.newPage();
    await page.goto("/faq");
    await page.waitForLoadState("networkidle");
    expect(await page.locator(".rv-pre").count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await ctx.close();
  });
});
