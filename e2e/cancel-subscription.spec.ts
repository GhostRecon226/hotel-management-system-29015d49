// QA-06 (10 Oct 2026): a hotel administrator can cancel the hotel's own subscription from Admin, Subscription.
// The button shows only for an active paid plan; a trial hotel does not see it (cancelling a trial would stop
// access at once). Local Supabase only.
//
// Not covered here: a signed-in user who lacks the subscription permission. That needs a second staff account
// with a custom role, which is not set up reliably from the browser. The database test for cancel_subscription
// already proves the permission check.
import { test, expect } from "@playwright/test";
import { localSupabase } from "./local-supabase";
import { signInAndCreateHotel, toasts } from "./helpers";

/** Moves a hotel to a paid, active plan with a paid period that ends in 30 days (service role, local only). */
async function makeActive(hotelName: string) {
  const s = localSupabase();
  const headers = { apikey: s.serviceRoleKey, Authorization: `Bearer ${s.serviceRoleKey}`, "Content-Type": "application/json", Prefer: "return=representation" };
  const t = await (await fetch(`${s.url}/rest/v1/tenants?name=eq.${encodeURIComponent(hotelName)}&select=id`, { headers })).json() as { id: string }[];
  expect(t, "hotel found").toHaveLength(1);
  const id = t[0]!.id;
  const end = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const a = await fetch(`${s.url}/rest/v1/tenant_subscriptions?tenant_id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify({ status: "active", current_period_end: end }) });
  expect(a.ok, "subscription made active").toBeTruthy();
  const b = await fetch(`${s.url}/rest/v1/tenants?id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify({ status: "active" }) });
  expect(b.ok, "hotel made active").toBeTruthy();
}

test("a trial hotel does not see Cancel subscription", async ({ page }) => {
  await signInAndCreateHotel(page, "canceltrial");
  await page.goto("/admin#plan");
  await expect(page.getByText("Your plan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel subscription" })).toHaveCount(0);
});

test("an administrator cancels an active subscription and sees the confirmation", async ({ page }) => {
  const label = `cancelsub${Date.now()}`;
  await signInAndCreateHotel(page, label);
  await makeActive(`${label} Ltd`);

  await page.goto("/admin#plan");
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel subscription" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("keeps working until the end of the paid period");
  await expect(dialog).toContainText("read-only");
  await expect(dialog).toContainText("Nothing is deleted");

  // A reason is required.
  const confirm = dialog.getByRole("button", { name: "Cancel subscription" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Reason for cancelling").fill("Closing the hotel for renovation");
  await confirm.click();

  await expect(toasts(page).filter({ hasText: "Subscription cancelled." })).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel subscription" })).toHaveCount(0);
});
