// Home page story: five sections, a connected hotel day, sample-data previews, calm motion. No database calls. [PLT-027]
import { test, expect, type Page } from "@playwright/test";

/** Opens the home page, waits for it to start up, and scrolls to the previews. */
async function openPreview(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.locator("#preview").scrollIntoViewIfNeeded();
}

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
    await page.goto("/");
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
    await expect(panel.getByRole("button", { name: "Post charge" })).toBeDisabled();
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

  test("[PLT-027] capability cards open and close with the keyboard", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const card = page.getByRole("button", { name: /^Front desk Reservations/ });
    await expect(card).toHaveAttribute("aria-expanded", "false");
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(card).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Walk-ins, room moves and stay extensions")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(card).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("Walk-ins, room moves and stay extensions")).toBeHidden();
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
    await page.locator("#preview").scrollIntoViewIfNeeded();
    for (const tab of ["Front desk", "Rooms", "Money", "Reports"]) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.getByRole("tabpanel").getByRole("heading", { level: 3 })).toBeVisible();
      await page.waitForTimeout(400);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${tab} fits a phone`).toBe(true);
    }
    await ctx.close();
  });
});
