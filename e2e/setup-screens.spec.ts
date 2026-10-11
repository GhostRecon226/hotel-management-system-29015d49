// QA-11: the Setup screens. The owner adds a room type on the screen, then every Setup page opens. Local Supabase only.
import { test, expect } from "@playwright/test";
import { signInAndCreateHotel, setUpRoomsAndRates, toasts } from "./helpers";

test("QA-11 the owner adds a room type in Setup and every Setup page opens", async ({ page }) => {
  await signInAndCreateHotel(page, "setupscr");
  await setUpRoomsAndRates(page);

  await page.goto("/setup/room-types");
  await expect(page.getByRole("row").filter({ hasText: "Standard" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Add room type" }).click();
  const dialog = page.getByRole("dialog", { name: "Add room type" });
  await dialog.getByLabel("Code").fill("DLX");
  await dialog.getByLabel("Name").fill("Deluxe");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(toasts(page).first()).toBeVisible({ timeout: 10_000 });
  await expect(dialog).toBeHidden();
  const row = page.getByRole("row").filter({ hasText: "Deluxe" });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row).toContainText("DLX");

  for (const path of ["/setup", "/setup/property", "/setup/rooms", "/setup/rates", "/setup/charges", "/setup/exchange-rates"]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.getByText("No access", { exact: true })).toHaveCount(0);
  }
});
