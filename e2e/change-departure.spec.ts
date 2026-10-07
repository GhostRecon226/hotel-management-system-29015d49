// FO-008 (wave 1, 6 Oct 2026): from the Front Desk, an in-house stay can be extended and then shortened.
// Local Supabase only.
import { test, expect } from "@playwright/test";
import { pick, setUpRoomsAndRates, signInAndCreateHotel, toasts } from "./helpers";

test("an in-house stay can be extended and then shortened from the Front Desk", async ({ page }) => {
  await signInAndCreateHotel(page, "chgdep");
  await setUpRoomsAndRates(page);

  await page.goto("/front-desk");
  await page.getByRole("button", { name: "Walk-in" }).click();
  const walkIn = page.getByRole("dialog", { name: "Walk-in guest" });
  await walkIn.getByRole("button", { name: "New guest" }).click();
  const guestDialog = page.getByRole("dialog", { name: "New guest" });
  await guestDialog.getByLabel("First name").fill("Kemi");
  await guestDialog.getByLabel("Last name").fill("Early");
  await guestDialog.getByRole("button", { name: "Save" }).click();
  await expect(guestDialog).toBeHidden();
  await pick(page, "wi-rt", /STD/);
  await pick(page, "wi-rp", /BAR/);
  await pick(page, "fd-room", /^1 ·/);
  await walkIn.getByLabel("ID number").fill("A1234567");
  await walkIn.getByLabel("Guest has read and signed the registration card").check();
  await walkIn.getByRole("button", { name: "Save" }).click();
  await expect(toasts(page).filter({ hasText: "Walk-in checked in." })).toBeVisible();

  const changeTo = async (offsetDays: number, hint: RegExp) => {
    await page.reload();
    await page.getByRole("tab", { name: /In house/ }).click();
    await page.getByRole("row", { name: /Kemi Early/ }).getByRole("button", { name: "Actions for room 1" }).click();
    await page.getByRole("menuitem", { name: "Change departure" }).click();
    const dlg = page.getByRole("dialog", { name: /Change departure/ });
    // The hotel's business date is the Lagos date, not the runner's date (they differ from 23:00 to 24:00 UTC).
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
    const iso = new Date(Date.parse(today) + offsetDays * 86_400_000).toISOString().slice(0, 10);
    await dlg.getByLabel("New departure").fill(iso);
    await expect(dlg.getByText(hint)).toBeVisible();
    await dlg.getByRole("button", { name: "Save" }).click();
    await expect(toasts(page).filter({ hasText: "Departure changed." }).last()).toBeVisible();
    await expect(dlg).toBeHidden();
  };

  await changeTo(3, /2 extra nights/);
  await changeTo(2, /1 night fewer/);
});
