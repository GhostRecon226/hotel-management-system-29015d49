// Measuring tool for the phone and tablet pass. Local Supabase only. It does not fail; it writes screenshots and a report
// to AUDIT_OUT (default /tmp/zikora-audit) so every screen can be looked at and counted. Run: AUDIT=1 npx playwright test e2e/responsive-audit.spec.ts
import { test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { setUpRoomsAndRates, signInAndCreateHotel } from "./helpers";
import { appScreens, MEASURE, seedBusyHotel } from "./responsive-kit";

const OUT = process.env.AUDIT_OUT ?? "/tmp/zikora-audit";
const ALL_SIZES = [
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-360", width: 360, height: 740 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "tablet-1024", width: 1024, height: 768 },
];
// AUDIT_SIZES=phone-390,tablet-768 and AUDIT_ONLY=front-desk,folio-detail narrow a run; AUDIT_PUBLIC=0 skips the public pages.
const SIZES = ALL_SIZES.filter((s) => !process.env.AUDIT_SIZES || process.env.AUDIT_SIZES.split(",").includes(s.name));
const ONLY = process.env.AUDIT_ONLY?.split(",");

test.skip(!process.env.AUDIT, "measuring tool: run with AUDIT=1");
test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

test("phone and tablet audit: signed-in screens", async ({ page }) => {
  test.setTimeout(1_500_000);
  mkdirSync(OUT, { recursive: true });
  await signInAndCreateHotel(page, "audit");
  await setUpRoomsAndRates(page);
  const ids = await seedBusyHotel(page);
  writeFileSync(`${OUT}/seed.json`, JSON.stringify(ids, null, 2));
  if (ids.failures.length) throw new Error(`seed problems: ${ids.failures.join(" | ")}`);
  const routes = appScreens(ids).filter(([n]) => !ONLY || ONLY.includes(n));
  const report: Record<string, Record<string, unknown>> = {};
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    mkdirSync(`${OUT}/${size.name}`, { recursive: true });
    report[size.name] = {};
    for (const [name, path] of routes) {
      try {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await page.locator("main h1, h1").first().waitFor({ state: "attached", timeout: 20_000 }).catch(() => {});
        await page.waitForTimeout(900);
        report[size.name]![name] = await page.evaluate(MEASURE);
        await page.screenshot({ path: `${OUT}/${size.name}/${name}.png`, fullPage: true });
      } catch (e) {
        report[size.name]![name] = { error: String(e).slice(0, 200) };
      }
    }
    writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  }
});

test("phone and tablet audit: public pages and sign-in", async ({ page }) => {
  test.skip(process.env.AUDIT_PUBLIC === "0", "public pages skipped for this run");
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const routes: [string, string][] = [
    ["home", "/"], ["features", "/features"], ["pricing", "/pricing"], ["about", "/about"], ["contact", "/contact"], ["faq", "/faq"],
    ["security", "/security"], ["privacy", "/privacy"], ["terms", "/terms"], ["auth", "/auth"], ["forgot-password", "/forgot-password"],
  ];
  const report: Record<string, Record<string, unknown>> = {};
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    mkdirSync(`${OUT}/public-${size.name}`, { recursive: true });
    report[size.name] = {};
    for (const [name, path] of routes) {
      try {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await page.locator("main h1, h1").first().waitFor({ state: "attached", timeout: 20_000 }).catch(() => {});
        await page.waitForTimeout(900);
        report[size.name]![name] = await page.evaluate(MEASURE);
        await page.screenshot({ path: `${OUT}/public-${size.name}/${name}.png`, fullPage: true });
      } catch (e) {
        report[size.name]![name] = { error: String(e).slice(0, 200) };
      }
    }
  }
  writeFileSync(`${OUT}/report-public.json`, JSON.stringify(report, null, 2));
});

// Pop-up forms on a phone: each must fit the screen (scrolling inside if it is tall), keep a margin, and use 16px fields.
test("phone audit: pop-up forms", async ({ page }) => {
  test.skip(process.env.AUDIT_DIALOGS !== "1", "pop-up forms: run with AUDIT_DIALOGS=1");
  test.setTimeout(600_000);
  mkdirSync(`${OUT}/dialogs`, { recursive: true });
  await signInAndCreateHotel(page, "dialogs");
  await setUpRoomsAndRates(page);
  const ids = await seedBusyHotel(page);
  const steps: [string, string, (p: typeof page) => Promise<void>][] = [
    ["check-in", "/front-desk", async (p) => { await p.getByRole("button", { name: "Check in" }).first().click(); }],
    ["walk-in", "/front-desk", async (p) => { await p.getByRole("button", { name: "Walk-in" }).click(); }],
    ["post-charge", `/folios/${ids.folio}`, async (p) => { await p.getByRole("button", { name: "Post charge" }).click(); }],
    ["record-payment", `/folios/${ids.folio}`, async (p) => { await p.getByRole("button", { name: "Record payment" }).click(); }],
    ["new-task", "/housekeeping", async (p) => { await p.getByRole("button", { name: "New task" }).click(); }],
    ["new-guest", "/reservations/new", async (p) => { await p.getByRole("button", { name: "New guest" }).click(); }],
    ["add-rooms", "/rooms", async (p) => { await p.getByRole("button", { name: "Add several rooms" }).click(); }],
    ["new-ticket", "/maintenance", async (p) => { await p.getByRole("button", { name: /New (ticket|request|problem)|Report/ }).first().click(); }],
    ["invite-staff", "/admin", async (p) => { await p.getByRole("button", { name: "Invite staff" }).click(); }],
  ];
  const report: Record<string, unknown> = {};
  for (const size of ALL_SIZES.filter((s) => s.name === "phone-390" || s.name === "phone-360")) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const [name, path, open] of steps) {
      try {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await page.locator("main h1, h1").first().waitFor({ state: "attached", timeout: 20_000 });
        await page.waitForTimeout(600);
        await open(page);
        const dialog = page.getByRole("dialog").first();
        await dialog.waitFor({ timeout: 8_000 });
        await page.waitForTimeout(500);
        report[`${name} at ${size.name}`] = await page.evaluate(() => {
          const d = document.querySelector("[role=dialog]") as HTMLElement | null;
          if (!d) return { error: "no dialog" };
          const r = d.getBoundingClientRect();
          const fields = Array.from(d.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, select, [role=combobox]"));
          const small = fields.filter((f) => parseFloat(getComputedStyle(f).fontSize) < 16).length;
          return {
            top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right),
            viewport: [innerWidth, innerHeight], fitsHeight: r.top >= 0 && r.bottom <= innerHeight + 1, margins: [Math.round(r.left), Math.round(innerWidth - r.right)],
            scrolls: d.scrollHeight > d.clientHeight + 1, fields: fields.length, fieldsUnder16px: small,
          };
        });
        await page.screenshot({ path: `${OUT}/dialogs/${name}-${size.name}.png` });
        await page.keyboard.press("Escape");
      } catch (e) {
        report[`${name} at ${size.name}`] = { error: String(e).slice(0, 160) };
      }
    }
  }
  writeFileSync(`${OUT}/dialogs.json`, JSON.stringify(report, null, 2));
});
