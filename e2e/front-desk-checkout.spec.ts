// Front Desk, In house tab: every row has a plain "Check out" button next to the row menu (live hand test of
// 5 Oct 2026: check-out was only inside the menu). Keyboard order: guest link, Check out, then the menu.
// Local Supabase only.
import { test, expect } from "@playwright/test";
import { pick, setUpRoomsAndRates, signInAndCreateHotel, toasts } from "./helpers";

test("an in-house row has a Check out button that opens that guest's check-out, before the row menu in keyboard order", async ({ page }) => {
  await signInAndCreateHotel(page, "fdcheckout");
  await setUpRoomsAndRates(page);

  // Walk-in to room 1, so one guest is in house.
  await page.goto("/front-desk");
  await page.getByRole("button", { name: "Walk-in" }).click();
  const walkIn = page.getByRole("dialog", { name: "Walk-in guest" });
  await walkIn.getByRole("button", { name: "New guest" }).click();
  const guestDialog = page.getByRole("dialog", { name: "New guest" });
  await guestDialog.getByLabel("First name").fill("Olu");
  await guestDialog.getByLabel("Last name").fill("Inhouse");
  await guestDialog.getByRole("button", { name: "Save" }).click();
  await expect(guestDialog).toBeHidden();
  await pick(page, "wi-rt", /STD/);
  await pick(page, "wi-rp", /BAR/);
  await pick(page, "fd-room", /^1 ·/);
  await walkIn.getByLabel("ID number").fill("A1234567");
  await walkIn.getByRole("button", { name: "Save" }).click();
  await expect(toasts(page).filter({ hasText: "Walk-in checked in." })).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: /In house/ }).click();
  const row = page.getByRole("row", { name: /Olu Inhouse/ });
  const checkOut = row.getByRole("button", { name: "Check out room 1" }).or(row.getByRole("link", { name: "Check out room 1" }));
  await expect(checkOut).toBeVisible();
  await expect(checkOut).toHaveText("Check out");
  await expect(row.getByRole("button", { name: "Actions for room 1" })).toBeVisible();

  // Keyboard order: from the guest link, Tab reaches Check out, then the row menu.
  await row.getByRole("link", { name: "Olu Inhouse" }).focus();
  await page.keyboard.press("Tab");
  await expect(checkOut).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(row.getByRole("button", { name: "Actions for room 1" })).toBeFocused();

  // It opens this guest's check-out screen.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/checkout\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Olu Inhouse").first()).toBeVisible();
});
