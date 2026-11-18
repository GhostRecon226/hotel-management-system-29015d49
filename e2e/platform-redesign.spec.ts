// Requirements: PLT-036, PLT-037, PLT-038, PLT-039
// The redesigned platform console: calls to make today, status chips and search, the hotel panel with a next step and tabs, and the three-step two-step sign-in.
// Local Supabase only.
import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { signInAndCreateHotel } from "./helpers";
import { createTestUser } from "./local-supabase";

const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = (q: string) => execSync(`psql "${LOCAL_DB}" -X -q -t -A -c "${q.replace(/"/g, '\\"')}"`).toString().trim();

/** The 6-digit code an authenticator app shows for this key now (RFC 6238: SHA-1, 30 seconds). */
function totp(base32: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of base32.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, "0");
}


test("[PLT-036] [PLT-037] [PLT-038] [PLT-039] an operator sees the steps, the calls list, status chips and search, and a hotel's next step and tabs", async ({ browser }) => {
  const label = `plr${Date.now().toString(36)}`;
  const hotelPage = await browser.newPage();
  await signInAndCreateHotel(hotelPage, label);
  await hotelPage.close();
  const op = await createTestUser("operator");
  expect(sql(`select app.add_platform_operator('${op.email}') is not null`)).toBe("t");

  const page = await browser.newPage();
  await page.goto("/auth");
  await page.getByLabel("Email").fill(op.email);
  await page.getByLabel("Password").fill(op.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/platform$/, { timeout: 15_000 });

  // [PLT-039] three steps; the current one is marked.
  const steps = page.getByRole("list", { name: "Two-step sign-in" });
  await expect(steps.getByText("Install app")).toBeVisible();
  await expect(steps.getByRole("listitem").nth(0)).toHaveAttribute("aria-current", "step");
  await page.getByRole("button", { name: "Set up the authenticator app" }).click();
  await expect(steps.getByRole("listitem").nth(1)).toHaveAttribute("aria-current", "step");
  const secret = (await page.locator("span.font-mono").innerText()).trim();
  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Confirm" }).click();

  // [PLT-036] the calls list is there; a new hotel on a 60-day trial needs no call.
  await expect(page.getByRole("heading", { name: /^Calls to make today/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Nobody needs a call today.")).toBeVisible();

  // [PLT-037] status chips with counts, and search.
  const chips = page.getByRole("group", { name: "Filter hotels by status" });
  await expect(chips.getByRole("button", { name: /^All \d+$/ })).toHaveAttribute("aria-pressed", "true");
  await chips.getByRole("button", { name: /^On trial \d+$/ }).click();
  const row = page.getByRole("row", { name: new RegExp(`${label} Ltd`) });
  await expect(row).toBeVisible();
  await expect(row.getByText(/days left/)).toBeVisible();
  await chips.getByRole("button", { name: /^All \d+$/ }).click();
  await page.getByLabel("Search hotels").fill("no such hotel zzz");
  await expect(page.getByText("No hotels match")).toBeVisible();
  await page.getByLabel("Search hotels").fill(label);
  await expect(row).toBeVisible();

  // [PLT-038] the panel opens on a next step with one main button, More for the rest, and three tabs.
  await row.getByRole("button", { name: `Manage ${label} Ltd` }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByText(/^On trial until/)).toBeVisible();
  await expect(panel.getByRole("button", { name: "Activate or extend paid period" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Suspend" })).toHaveCount(0);
  await panel.getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("menuitem", { name: "Extend trial" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Suspend" })).toBeVisible();
  await page.keyboard.press("Escape");
  const tabs = panel.getByRole("tablist", { name: "Hotel" });
  for (const t of ["Account", "Support", "History"]) await expect(tabs.getByRole("tab", { name: t })).toBeVisible();
  await expect(panel.getByText("Active staff")).toBeVisible();
  await tabs.getByRole("tab", { name: "History" }).click();
  await expect(panel.getByRole("tab", { name: "History" })).toHaveAttribute("data-state", "active");
});
