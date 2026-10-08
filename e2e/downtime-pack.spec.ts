// [FO-014] Downtime pack: a print page with today's arrivals, in-house guests, departures and balances,
// plus blank rows for paper walk-ins. Local Supabase only.
import { test, expect } from "@playwright/test";
import { pick, setUpRoomsAndRates, signInAndCreateHotel, toasts } from "./helpers";

test("FO-014 the downtime pack lists in-house guests with their balance and has blank walk-in rows", async ({ page }) => {
  await signInAndCreateHotel(page, "downtime");
  await setUpRoomsAndRates(page);

  await page.goto("/front-desk");
  await page.getByRole("button", { name: "Walk-in" }).click();
  const walkIn = page.getByRole("dialog", { name: "Walk-in guest" });
  await walkIn.getByRole("button", { name: "New guest" }).click();
  const guestDialog = page.getByRole("dialog", { name: "New guest" });
  await guestDialog.getByLabel("First name").fill("Ada");
  await guestDialog.getByLabel("Last name").fill("Paperlist");
  await guestDialog.getByRole("button", { name: "Save" }).click();
  await expect(guestDialog).toBeHidden();
  await pick(page, "wi-rt", /STD/);
  await pick(page, "wi-rp", /BAR/);
  await pick(page, "fd-room", /^1 ·/);
  await walkIn.getByLabel("ID number").fill("A7654321");
  await walkIn.getByLabel("Guest has read and signed the registration card").check();
  await walkIn.getByRole("button", { name: "Save" }).click();
  await expect(toasts(page).filter({ hasText: "Walk-in checked in." })).toBeVisible();

  await page.goto("/downtime");
  await expect(page.getByRole("heading", { name: "Downtime pack" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print" })).toBeVisible();

  const inHouse = page.getByRole("region", { name: "In house" });
  const row = inHouse.getByRole("row", { name: /Ada Paperlist/ });
  await expect(row).toBeVisible();
  await expect(row.getByRole("cell").nth(0)).toContainText("1");

  const blank = page.getByRole("region", { name: "New guests on paper" });
  await expect(blank.getByRole("row")).toHaveCount(11); // header plus ten blank lines
  await expect(page.getByRole("region", { name: "Paper routine" })).toBeVisible();
});
