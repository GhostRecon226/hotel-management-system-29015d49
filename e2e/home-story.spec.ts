// How it works page previews: four sample screens with one interaction each, lazy loaded, sample data only. The page layout tests are in home-meridian.spec.ts. [PLT-027]
import { test, expect, type Page } from "@playwright/test";

/** Opens the How it works page, waits for it to start up, and scrolls to the previews. */
async function openPreview(page: Page) {
  await page.goto("/how-it-works");
  await page.waitForLoadState("networkidle");
  await page.locator("#preview").scrollIntoViewIfNeeded();
}

test.describe("how it works page", () => {
  test("[PLT-027] the previews switch with the keyboard and say they are sample data", async ({ page }) => {
    await page.goto("/how-it-works");
    await page.waitForLoadState("networkidle");
    const tabs = page.getByRole("tablist", { name: "Zikora previews" });
    await expect(tabs.getByRole("tab")).toHaveText(["Front desk", "Rooms", "Money", "Reports"]);
    await tabs.getByRole("tab", { name: "Front desk" }).focus();
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByRole("heading", { name: "Front desk" })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: "Rooms", selected: true })).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Room board" })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(panel.getByRole("heading", { name: "Guest folio" })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(panel.getByRole("heading", { name: "Reports" })).toBeVisible();
    await expect(panel.getByText("Sample Data", { exact: true })).toBeVisible();
    await expect(page.getByText("Sample Data. Not a live hotel account.")).toBeVisible();
  });

  test("[PLT-027] the preview code loads only when the previews come near the screen", async ({ page }) => {
    const files: string[] = [];
    page.on("request", (r) => { if (/preview\/panels/.test(r.url())) files.push(r.url()); });
    await page.goto("/how-it-works");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    expect(files, "previews must not load with the first page").toEqual([]);
    await page.locator("#preview").scrollIntoViewIfNeeded();
    await expect(page.getByRole("tabpanel").getByRole("heading", { name: "Front desk" })).toBeVisible();
    expect(files.length).toBeGreaterThan(0);
  });

  test("[PLT-027] preview 1: Check in moves a guest from Arrivals to In house", async ({ page }) => {
    await openPreview(page);
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByRole("button", { name: "Arrivals (3)" })).toBeVisible();
    await panel.getByRole("button", { name: "Check in Guest A" }).click();
    await expect(panel.getByRole("status")).toContainText("Guest A checked in to room 106");
    await expect(panel.getByRole("button", { name: "Arrivals (2)" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "In house (16)" })).toBeVisible();
    await panel.getByRole("button", { name: "In house (16)" }).click();
    await expect(panel.getByRole("cell", { name: "Guest A" })).toBeVisible();
    await panel.getByRole("button", { name: "Reset sample" }).click();
    await expect(panel.getByRole("button", { name: "Arrivals (3)" })).toBeVisible();
  });

  test("[PLT-027] preview 2: dirty rooms move through the cleaning steps and the board counts follow", async ({ page }) => {
    await openPreview(page);
    await page.getByRole("tab", { name: "Rooms" }).click();
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByText("Ready to sell tonight")).toBeVisible();
    const room = () => panel.getByRole("button", { name: /^Room 104,/ });
    for (const step of ["Assigned", "In progress", "Waiting inspection"]) {
      await room().click();
      await expect(panel.getByRole("status")).toContainText(`Room 104 cleaning task: ${step}`);
    }
    await room().click();
    await expect(panel.getByRole("status")).toContainText("Room 104 passed inspection");
    await expect(panel.getByRole("button", { name: /^Room 104,/ })).toHaveCount(0);
    await panel.getByRole("button", { name: "Occupied", exact: true }).first().click();
    await expect(panel.getByText("In house", { exact: true })).toHaveCount(15);
    await panel.getByRole("button", { name: "Not sellable" }).click();
    await expect(panel.getByText("Out of order", { exact: true })).toHaveCount(1);
    await expect(panel.getByText("In house", { exact: true })).toHaveCount(0);
  });

  test("[PLT-027] preview 3: Record payment settles the folio", async ({ page }) => {
    await openPreview(page);
    await page.getByRole("tab", { name: "Money" }).click();
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByText("26,000").first()).toBeVisible();
    for (const gone of ["Post charge", "Split folio", "Transfer"]) await expect(panel.getByRole("button", { name: gone })).toHaveCount(0);
    await panel.getByRole("button", { name: "Record payment" }).click();
    await expect(panel.getByRole("status")).toContainText("The balance is now 0");
    await expect(panel.getByText("Settled", { exact: true })).toBeVisible();
    await expect(panel.getByText("-26,000")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Record payment" })).toBeDisabled();
  });

  test("[PLT-027] preview 4: the report figures agree and the report views switch", async ({ page }) => {
    await openPreview(page);
    await page.getByRole("tab", { name: "Reports" }).click();
    const panel = page.getByRole("tabpanel");
    for (const v of ["75%", "12,000", "9,000", "180,000"]) await expect(panel.getByText(v, { exact: true }).first()).toBeVisible();
    await expect(panel.getByText("15 of 20 rooms sold").first()).toBeVisible();
    await panel.getByRole("button", { name: "Revenue by charge code" }).click();
    await expect(panel.getByRole("columnheader", { name: "Charge code" })).toBeVisible();
    await expect(panel.getByRole("cell", { name: "180,000" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Export CSV" })).toHaveCount(0);
    await expect(panel.getByRole("columnheader", { name: /tax/i })).toHaveCount(0);
    await panel.getByRole("button", { name: "Daily KPIs" }).click();
    await expect(panel.getByRole("columnheader", { name: "RevPAR" })).toBeVisible();
    const text = await panel.innerText();
    expect(text).not.toMatch(/last month|growth|increase|decrease|vs\b/i);
  });

  test("[PLT-027] previews show no currency symbol and no gold", async ({ page }) => {
    await openPreview(page);
    for (const tab of ["Front desk", "Rooms", "Money", "Reports"]) {
      await page.getByRole("tab", { name: tab }).click();
      const panel = page.getByRole("tabpanel");
      await expect(panel.getByText("Sample Data", { exact: true })).toBeVisible();
      expect(await panel.innerText()).not.toMatch(/[₦$€£]/);
      expect(await panel.evaluate((el) => el.innerHTML)).not.toMatch(/text-gold|oklch\(0\.88 0\.09 85\)/);
    }
  });

  test("[PLT-027] the copy stays inside what the product does", async ({ page }) => {
    for (const path of ["/", "/how-it-works"]) {
      await page.goto(path);
      const text = (await page.locator("main").innerText()).toLowerCase();
      for (const banned of ["nigeria", "inventory", "procurement", "testimonial", "guest app", "self-service", "integration"]) {
        expect(text, `${path} must not say "${banned}"`).not.toContain(banned);
      }
    }
  });

});
