// [NFR-008] Phone and tablet layout, on a busy hotel (long names, a folio with charges, tasks, tickets). Local Supabase only.
// What a phone user needs: the page title is readable, nothing scrolls sideways, tables show every column (as cards),
// tabs and buttons are easy to hit, and text is not tiny. The older phone-width.spec.ts checks an empty hotel.
import { test, expect } from "@playwright/test";
import { setUpRoomsAndRates, signInAndCreateHotel } from "./helpers";
import { appScreens, MEASURE, seedBusyHotel } from "./responsive-kit";

test.use({ isMobile: true, hasTouch: true, viewport: { width: 360, height: 740 } });

const SIZES = [
  { name: "phone 360", width: 360, height: 740, phone: true },
  { name: "tablet 768", width: 768, height: 1024, phone: false },
];

type Report = {
  h1Ratio: number | null; tabsShort: string[]; scrollTables: string[]; pageOverflow: number; overflow: string[];
  tiny: string[]; smallText: string[]; wideTables: string[]; smallFields: string[];
};

test("[NFR-008] layout: busy hotel on a phone and a tablet", async ({ page }) => {
  test.setTimeout(900_000); // the first visit to each page compiles it
  await signInAndCreateHotel(page, "layout");
  await setUpRoomsAndRates(page);
  const ids = await seedBusyHotel(page);
  expect(ids.failures, "set-up calls").toEqual([]);

  const problems: Record<string, string[]> = { sideways: [], title: [], tables: [], tabs: [], targets: [], text: [], fields: [] };
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const [name, path] of appScreens(ids)) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.locator("main h1, h1").first().waitFor({ state: "attached", timeout: 20_000 });
      await page.waitForTimeout(700); // let lists and tabs finish drawing
      const r = (await page.evaluate(MEASURE)) as Report;
      const at = `${name} at ${size.name}`;
      if (r.pageOverflow > 1) problems.sideways!.push(`${at}: the page scrolls sideways by ${r.pageOverflow}px`);
      for (const o of r.overflow.slice(0, 2)) problems.sideways!.push(`${at}: ${o}`);
      if (size.phone && r.h1Ratio !== null && r.h1Ratio < 0.6) problems.title!.push(`${at}: the title box is only ${Math.round(r.h1Ratio * 100)}% of the screen wide`);
      for (const t of r.scrollTables) problems.tables!.push(`${at}: ${t}`);
      for (const t of r.tabsShort) problems.tabs!.push(`${at}: ${t}`);
      // Smallest comfortable target: 24px for links, check boxes and switches, 36px for buttons and fields.
      for (const t of r.tiny) problems.targets!.push(`${at}: ${t}`);
      for (const t of r.smallText) problems.text!.push(`${at}: ${t}`);
      for (const t of r.smallFields) problems.fields!.push(`${at}: ${t} has text under 16px, so an iPhone zooms in when it is tapped`);
    }
  }
  const show = (k: string) => `${k} (${problems[k]!.length}):\n  ${problems[k]!.slice(0, 40).join("\n  ")}`;
  for (const k of Object.keys(problems)) expect.soft(problems[k], show(k)).toEqual([]);
});

// Pop-up forms: inside the screen with a margin, scrolling inside when tall, fields at 16px, buttons always in reach.
test("[NFR-008] pop-up forms fit a phone", async ({ page }) => {
  test.setTimeout(300_000);
  await signInAndCreateHotel(page, "popups");
  await setUpRoomsAndRates(page);
  const ids = await seedBusyHotel(page);
  expect(ids.failures, "set-up calls").toEqual([]);
  const steps: [string, string, string][] = [
    ["check-in", "/front-desk", "Check in"], ["walk-in", "/front-desk", "Walk-in"], ["post charge", `/folios/${ids.folio}`, "Post charge"],
    ["record payment", `/folios/${ids.folio}`, "Record payment"], ["new task", "/housekeeping", "New task"], ["new guest", "/reservations/new", "New guest"],
    ["add rooms", "/rooms", "Add several rooms"], ["invite staff", "/admin", "Invite staff"],
  ];
  const problems: string[] = [];
  for (const [name, path, button] of steps) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.locator("main h1, h1").first().waitFor({ state: "attached", timeout: 20_000 });
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: button, exact: button === "Check in" ? false : true }).first().click();
    await page.getByRole("dialog").first().waitFor({ timeout: 8_000 });
    await page.waitForTimeout(400); // the pop-up finishes opening
    const m = await page.evaluate(() => {
      const d = document.querySelector("[role=dialog]") as HTMLElement;
      const r = d.getBoundingClientRect();
      const fields = Array.from(d.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, select, [role=combobox]"));
      const save = Array.from(d.querySelectorAll("button")).find((b) => /^(Save|Add|Create|Record|Post|Invite|Check in|Send)/.test(b.textContent?.trim() ?? ""));
      const sr = save?.getBoundingClientRect();
      return {
        inside: r.top >= 0 && r.bottom <= innerHeight + 1, side: Math.min(r.left, innerWidth - r.right),
        under16: fields.filter((f) => parseFloat(getComputedStyle(f).fontSize) < 16).length,
        saveInReach: sr ? sr.bottom <= innerHeight && sr.top >= 0 : null,
      };
    });
    if (!m.inside) problems.push(`${name}: the pop-up is taller than the screen`);
    if (m.side < 8) problems.push(`${name}: the pop-up touches the screen edge (${Math.round(m.side)}px margin)`);
    if (m.under16) problems.push(`${name}: ${m.under16} field(s) under 16px`);
    if (m.saveInReach === false) problems.push(`${name}: the main button is off the screen`);
    await page.keyboard.press("Escape");
  }
  expect(problems).toEqual([]);
});

// The top bar search is a pop-up with results: it must open inside the screen, take a finger, and not zoom an iPhone.
test("[NFR-008] top bar search works on a phone", async ({ page }) => {
  test.setTimeout(300_000);
  await signInAndCreateHotel(page, "search");
  await setUpRoomsAndRates(page);
  const ids = await seedBusyHotel(page);
  expect(ids.failures, "set-up calls").toEqual([]);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Search guests, bookings and rooms" }).last().click();
  const box = page.getByRole("textbox", { name: "Search" });
  await expect(box).toBeVisible();
  expect(await box.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)), "the field is 16px or more").toBeGreaterThanOrEqual(16);
  await box.fill("Olu");
  const rows = page.getByRole("dialog").getByRole("button").filter({ hasText: /Oluwaseun|RES-/ });
  await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  const problems = await page.evaluate(() => {
    const d = document.querySelector("[role=dialog]") as HTMLElement;
    const r = d.getBoundingClientRect();
    const out: string[] = [];
    if (r.top < 0 || r.bottom > innerHeight + 1) out.push(`the search pop-up runs off the screen (${Math.round(r.top)} to ${Math.round(r.bottom)} of ${innerHeight})`);
    if (r.left < 8 || innerWidth - r.right < 8) out.push("the search pop-up touches the screen edge");
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push("the page scrolls sideways with the search open");
    for (const b of Array.from(d.querySelectorAll("li button"))) {
      const br = b.getBoundingClientRect();
      if (br.height < 36) out.push(`a result row is only ${Math.round(br.height)}px tall`);
      if (br.right > r.right + 1) out.push("a result row runs past the pop-up");
    }
    return out;
  });
  expect(problems).toEqual([]);
  await rows.first().click();
  await expect(page).toHaveURL(/\/(guests|reservations)\//);
});
