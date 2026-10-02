// Takes screenshots of the local copy for design review. Local Supabase and the demo hotel only
// (scripts/seed-demo.sh). Needs the dev server: npm run dev -- --mode localdb --port 8081
// Usage: node scripts/screenshots.mjs <out-dir> <page> [<page> ...]
//   page = a path like /dashboard, or "folio-detail" (the first folio in the list).
// Output: <name>-1366x768.png (what fits on a 1366 by 768 screen) and <name>-1440-full.png (whole page, 1440 wide).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const env = Object.fromEntries(fs.readFileSync(".env.localdb.local", "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const [outDir, ...pages] = process.argv.slice(2);
if (!outDir || pages.length === 0) { console.error("usage: node scripts/screenshots.mjs <out-dir> <page>..."); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.BASE_URL ?? "http://localhost:8081";
const who = process.env.AS ?? "ADMIN";

const browser = await chromium.launch();
// VIEWPORTS=1024x768,768x1024 adds tablet sizes (what fits on screen).
const extra = (process.env.VIEWPORTS ?? "").split(",").filter(Boolean).map((v) => { const [w, h] = v.split("x").map(Number); return { w, h, tag: v, full: false }; });
const sizes = process.env.ONLY_EXTRA ? extra : [{ w: 1366, h: 768, tag: "1366x768", full: false }, { w: 1440, h: 900, tag: "1440-full", full: true }, ...extra];
for (const vp of sizes) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${base}/auth`);
  await page.getByRole("heading", { name: "Welcome" }).waitFor();
  await page.getByLabel("Email").fill(env[`DEMO_${who}_EMAIL`]);
  await page.getByLabel("Password").fill(env[`DEMO_${who}_PASSWORD`]);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard/);
  for (const p of pages) {
    if (p === "folio-detail") {
      await page.goto(`${base}/folios`);
      await page.locator('main a[href^="/folios/"]').first().click();
      await page.waitForURL(/\/folios\/[0-9a-f-]{36}/);
    } else {
      await page.goto(`${base}${p}`);
    }
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);
    const name = p === "folio-detail" ? "folio-detail" : p.replace(/^\//, "").replace(/\//g, "-") || "home";
    await page.screenshot({ path: path.join(outDir, `${name}-${vp.tag}.png`), fullPage: vp.full });
    console.log("saved", name, vp.tag);
  }
  await ctx.close();
}
await browser.close();
