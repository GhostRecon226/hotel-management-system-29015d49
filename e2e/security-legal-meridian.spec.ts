// Security, Privacy and Terms pages in the Meridian look (Nov 2026). No database calls. [PLT-033]
import { test, expect } from "@playwright/test";

test.describe("security and legal pages (Meridian)", () => {
  test("[PLT-033] security has one main heading, the dark header and six controls", async ({ page }) => {
    await page.goto("/security");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Accountability should be built into the workflow." })).toBeVisible();
    await expect(page.locator("[data-home-header]")).toBeVisible();
    await expect(page.getByRole("list", { name: "How Zikora protects hotel data" }).getByRole("listitem")).toHaveCount(6);
  });

  test("[PLT-033] security claims no certification, uptime or full compliance", async ({ page }) => {
    await page.goto("/security");
    expect(await page.locator("main").innerText()).not.toMatch(/ISO ?27001|SOC ?2|99\.\d+%|fully compliant|certified/i);
  });

  test("[PLT-033] privacy and terms use the dark header and keep the draft notice", async ({ page }) => {
    for (const path of ["/privacy", "/terms"]) {
      await page.goto(path);
      await expect(page.locator("[data-home-header]")).toBeVisible();
      await expect(page.getByRole("note")).toContainText("Draft, pending legal review");
    }
  });

  test("[PLT-033] the footer links to every public page", async ({ page }) => {
    await page.goto("/security");
    const footer = page.locator("footer");
    for (const [name, href] of [["How it works", "/how-it-works"], ["Pricing", "/pricing"], ["Security", "/security"], ["Privacy notice", "/privacy"], ["Terms of use", "/terms"]]) {
      await expect(footer.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
    }
  });
});
