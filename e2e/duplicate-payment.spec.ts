// Duplicate payment guard (FIN-017, wave 1, 6 Oct 2026). Recording the same payment twice on a bill within
// 10 minutes shows the earlier payment and asks for a reason; with a reason the second payment is recorded.
// Local Supabase only.
import { test, expect } from "@playwright/test";
import { pick, setUpRoomsAndRates, signInAndCreateHotel, toasts } from "./helpers";

test("a repeat payment shows the earlier one and needs a reason before it is recorded", async ({ page }) => {
  await signInAndCreateHotel(page, "duppay");
  await setUpRoomsAndRates(page);

  await page.goto("/reservations/new");
  await page.getByRole("button", { name: "New guest" }).click();
  const guestDialog = page.getByRole("dialog", { name: "New guest" });
  await guestDialog.getByLabel("First name").fill("Bola");
  await guestDialog.getByLabel("Last name").fill("Twice");
  await guestDialog.getByRole("button", { name: "Save" }).click();
  await expect(guestDialog).toBeHidden();
  await pick(page, "room_type", /STD/);
  await pick(page, "rate_plan", /BAR/);
  await page.getByRole("button", { name: "Create booking" }).click();
  await expect(page).toHaveURL(/\/reservations\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Folio" }).click();
  await expect(page).toHaveURL(/\/folios\/[0-9a-f-]{36}$/);

  const record = async () => {
    await page.getByRole("button", { name: "Record payment" }).click();
    const pay = page.getByRole("dialog", { name: /Record payment/ });
    await pick(page, "pp-m", "Cash");
    await pay.getByLabel("Amount").fill("20000");
    await pay.getByLabel("Reference (optional)").fill("RCPT-1");
    await pay.getByRole("button", { name: "Save" }).click();
    return pay;
  };

  // First payment: recorded as normal.
  const first = await record();
  await expect(toasts(page).filter({ hasText: "Payment recorded." })).toBeVisible();
  await expect(first).toBeHidden();

  // Same payment again: the form stays open, names the earlier payment and asks for a reason.
  const pay = await record();
  const warning = pay.getByRole("alert");
  await expect(warning).toContainText("20,000.00");
  await expect(warning).toContainText("Cash");
  await expect(warning).toContainText("RCPT-1");
  const reason = pay.getByLabel("Reason for second payment");
  await expect(reason).toBeVisible();
  await expect(page.locator("tbody tr", { hasText: "RCPT-1" })).toHaveCount(1);

  // Saving without a reason is not allowed; with a reason it is recorded.
  await expect(pay.getByRole("button", { name: "Record second payment" })).toBeDisabled();
  await reason.fill("Guest paid the deposit and balance separately");
  await pay.getByRole("button", { name: "Record second payment" }).click();
  await expect(pay).toBeHidden();
  await expect(page.locator("tbody tr", { hasText: "RCPT-1" })).toHaveCount(2);
});
