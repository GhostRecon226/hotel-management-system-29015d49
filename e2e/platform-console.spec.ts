// Platform console (wave 2, item 2; PLT-008, PLT-009, PLT-013). A separate operator sign-in, added by the database
// owner, sets up two-step sign-in with an authenticator app, then activates a test hotel from the screen.
// Local Supabase only: the operator is added with the same one-line command Peter runs in the SQL editor.
import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { signInAndCreateHotel, toasts } from "./helpers";
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

test("an operator signs in, sets up two-step sign-in, and activates a test hotel", async ({ browser }) => {
  // A hotel on its free trial, created through the real screens.
  const label = `plt${Date.now().toString(36)}`;
  const hotelPage = await browser.newPage();
  await signInAndCreateHotel(hotelPage, label);
  await hotelPage.close();

  // The operator: a separate account that belongs to no hotel, added by the database owner.
  const op = await createTestUser("operator");
  expect(sql(`select app.add_platform_operator('${op.email}') is not null`)).toBe("t");

  const page = await browser.newPage();
  await page.goto("/auth");
  await page.getByLabel("Email").fill(op.email);
  await page.getByLabel("Password").fill(op.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Not "Create your hotel": the console, which first asks for two-step sign-in.
  await expect(page).toHaveURL(/\/platform$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Confirm it is you" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0); // no hotel list before two-step sign-in
  await page.getByRole("button", { name: "Set up the authenticator app" }).click();
  await expect(page.getByAltText("Code to scan with the authenticator app")).toBeVisible();
  const secret = (await page.locator("span.font-mono").innerText()).trim();
  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Confirm" }).click();

  // The hotel list, then activate the trial hotel with a reason and a confirmation step.
  const row = page.getByRole("row", { name: new RegExp(`${label} Ltd`) });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText("Trial", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: `Manage ${label} Ltd` }).click();
  await page.getByRole("button", { name: "Activate or extend paid period" }).click();
  const dlg = page.getByRole("dialog", { name: "Activate or extend the paid period" });
  const until = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  await dlg.getByLabel("Paid until").fill(until);
  await dlg.getByLabel("Reason").fill("Pilot invoice 001 paid by transfer");
  await dlg.getByRole("button", { name: "Continue" }).click();
  await expect(dlg.getByText(/becomes active on the .* plan/)).toBeVisible();
  await dlg.getByRole("button", { name: "Yes, save this change" }).click();
  await expect(toasts(page).filter({ hasText: "Saved." })).toBeVisible();
  await expect(page.getByText("Pilot invoice 001 paid by transfer")).toBeVisible();
  await expect(page.getByText(`By ${op.email}`)).toBeVisible();
});
