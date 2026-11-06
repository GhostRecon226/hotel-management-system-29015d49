// About and Contact pages, Meridian look (Nov 2026). No database calls. [PLT-032]
import { test, expect } from "@playwright/test";

test.describe("about page (Meridian)", () => {
  test("[PLT-032] has one main heading, the dark header, the four handovers and five beliefs", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Built around the work that keeps a hotel running." })).toBeVisible();
    await expect(page.locator("[data-home-header]")).toBeVisible();
    await expect(page.getByRole("list", { name: "Handovers in a hotel" }).getByRole("listitem")).toHaveCount(4);
    await expect(page.getByRole("list", { name: "What we believe" }).getByRole("listitem")).toHaveCount(5);
    await expect(page.getByRole("list", { name: "Where Zikora is today" }).getByRole("listitem")).toHaveCount(3);
  });

  test("[PLT-032] makes no invented claims and labels the roadmap as ideas", async ({ page }) => {
    await page.goto("/about");
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\d+\s?%|founded|our customers|trusted by/i);
    expect(text).toContain("They are not features today");
  });

  test("[PLT-032] the closing button goes to Contact", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator("main").getByRole("link", { name: "Talk to Zikora" })).toHaveAttribute("href", "/contact");
  });
});

test.describe("contact page (Meridian)", () => {
  test("[PLT-032] has one main heading, the dark header, the form and the contact details", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Tell us about your hotel." })).toBeVisible();
    await expect(page.locator("[data-home-header]")).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send enquiry" })).toBeVisible();
    await expect(page.locator("main")).toContainText("hello@zikorahq.com");
    await expect(page.getByRole("list", { name: "Topics" }).getByRole("listitem")).toHaveCount(3);
  });

  test("[PLT-032] promises no reply time and links to the trial and FAQ", async ({ page }) => {
    await page.goto("/contact");
    expect(await page.locator("main").innerText()).not.toMatch(/within \d+|24 hours|same day/i);
    await expect(page.locator("main").getByRole("link", { name: "Start 60 days free" })).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Read the FAQ" })).toHaveAttribute("href", "/faq");
  });
});
