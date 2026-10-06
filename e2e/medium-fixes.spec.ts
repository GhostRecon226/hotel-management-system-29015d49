// Wave 1, item 2 part 2 (6 Oct 2026). FO-003: check-in waits for the registration card tick. FO-007: a move to a
// dearer room type offers only the new rate to front desk staff; the administrator (who holds every permission)
// also sees the complimentary option. PLT-007: the administrator sees "Add another property". Local Supabase only.
import { test, expect } from "@playwright/test";
import { pick, setUpRoomsAndRates, signInAndCreateHotel, toasts } from "./helpers";

test("check-in needs the registration card tick; Add another property is on the property page", async ({ page }) => {
  await signInAndCreateHotel(page, "medium");
  await setUpRoomsAndRates(page);

  await page.goto("/front-desk");
  await page.getByRole("button", { name: "Walk-in" }).click();
  const walkIn = page.getByRole("dialog", { name: "Walk-in guest" });
  await walkIn.getByRole("button", { name: "New guest" }).click();
  const guestDialog = page.getByRole("dialog", { name: "New guest" });
  await guestDialog.getByLabel("First name").fill("Tola");
  await guestDialog.getByLabel("Last name").fill("Tick");
  await guestDialog.getByRole("button", { name: "Save" }).click();
  await expect(guestDialog).toBeHidden();
  await pick(page, "wi-rt", /STD/);
  await pick(page, "wi-rp", /BAR/);
  await pick(page, "fd-room", /^1 ·/);
  await walkIn.getByLabel("ID number").fill("A7654321");
  await expect(walkIn.getByRole("button", { name: "Save" })).toBeDisabled();
  await walkIn.getByLabel("Guest has read and signed the registration card").check();
  await expect(walkIn.getByRole("button", { name: "Save" })).toBeEnabled();
  await walkIn.getByRole("button", { name: "Save" }).click();
  await expect(toasts(page).filter({ hasText: "Walk-in checked in." })).toBeVisible();

  await page.goto("/setup/property");
  await expect(page.getByRole("heading", { name: "Add another property" })).toBeVisible();
  await page.getByLabel("Property name").last().fill("Annex");
  await page.getByRole("button", { name: "Add property" }).click();
  // A new hotel is on the Starter plan, which allows one property.
  await expect(toasts(page).filter({ hasText: /propert/i }).last()).toBeVisible();
});
