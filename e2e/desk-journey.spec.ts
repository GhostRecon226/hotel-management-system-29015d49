// The main desk journey through the real screens: create a guest from the booking form, book, check in,
// post a charge, take a payment, check out. Local Supabase only.
// Hand test of 1 Oct 2026 found that saving a new guest inside the booking form also submitted the
// booking ("Guest not found"); these tests guard every screen that opens a pop-up form inside another form.
import { test, expect } from "@playwright/test";
import { pick, setUpRoomsAndRates, signInAndCreateHotel, toasts } from "./helpers";

test("desk journey: new guest from the booking form, book, check in, charge, pay, check out", async ({ page }) => {
  await signInAndCreateHotel(page, "journey");
  await setUpRoomsAndRates(page);

  // 1. New guest from inside the booking form: only the guest is saved, and the name shows.
  await page.goto("/reservations/new");
  const bookingCalls: string[] = [];
  page.on("request", (r) => { if (/\/rpc\/(create_reservation|walk_in_check_in)/.test(r.url())) bookingCalls.push(r.url()); });
  await page.getByRole("button", { name: "New guest" }).click();
  const guestDialog = page.getByRole("dialog", { name: "New guest" });
  await guestDialog.getByLabel("First name").fill("Ada");
  await guestDialog.getByLabel("Last name").fill("Journey");
  await guestDialog.getByRole("button", { name: "Save" }).click();
  await expect(toasts(page).filter({ hasText: "Guest created." })).toBeVisible();
  await expect(guestDialog).toBeHidden();
  await page.waitForTimeout(1000); // give a wrongly submitted booking time to show its error
  expect(bookingCalls, "saving the guest must not submit the booking").toEqual([]);
  await expect(toasts(page).filter({ hasText: "Guest not found" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/reservations\/new$/);
  await expect(page.getByText("Ada Journey", { exact: true })).toBeVisible();

  // 2. Book today to tomorrow.
  await pick(page, "room_type", /STD/);
  await pick(page, "rate_plan", /BAR/);
  await page.getByRole("button", { name: "Create booking" }).click();
  await expect(page).toHaveURL(/\/reservations\/[0-9a-f-]{36}$/);
  const reservationUrl = page.url();
  const reservationId = reservationUrl.split("/").pop()!;
  await expect(page.getByText("Ada Journey").first()).toBeVisible();

  // 3. Check in to room 1 from the front desk.
  await page.goto("/front-desk");
  const row = page.getByRole("row", { name: /Ada Journey/ });
  await row.getByRole("button", { name: "Check in" }).click();
  const checkIn = page.getByRole("dialog", { name: /Check in/ });
  await pick(page, "fd-room", /^1 ·/);
  await checkIn.getByLabel("ID number").fill("A1234567");
  await checkIn.getByLabel("Guest has read and signed the registration card").check();
  await checkIn.getByRole("button", { name: "Save" }).click();
  await expect(toasts(page).filter({ hasText: "Guest checked in." })).toBeVisible();

  // 4. Post a restaurant charge of 10,000. The preview total equals the folio balance after posting.
  await page.goto(reservationUrl);
  await page.getByRole("button", { name: "Folio" }).click();
  await expect(page).toHaveURL(/\/folios\/[0-9a-f-]{36}$/);
  const folioUrl = page.url();
  await page.getByRole("button", { name: "Post charge" }).click();
  const charge = page.getByRole("dialog", { name: /Post charge/ });
  await pick(page, "pc-code", "Restaurant");
  await charge.locator("#pc-amt").fill("10000");
  await expect(charge.getByText("₦11,825.00")).toBeVisible();
  await charge.getByRole("button", { name: "Save" }).click();
  await expect(charge).toBeHidden();
  await expect(page.getByText("Balance due")).toBeVisible();
  await expect(page.getByText("₦11,825.00").first()).toBeVisible();

  // 5. Leaving today: the check-out screen adds one night (decision DAY-006). Post it, then take payment.
  await page.goto(`/checkout/${reservationId}`);
  await expect(page.getByText("Same-day stay: one night is charged")).toBeVisible();
  await expect(page.getByText("Outstanding ₦70,950.00")).toBeVisible();
  await page.getByRole("button", { name: "Post it now" }).click();
  await expect(toasts(page).filter({ hasText: "One night posted to the folio." })).toBeVisible();
  await page.goto(folioUrl);
  await page.getByRole("button", { name: "Record payment" }).click();
  const pay = page.getByRole("dialog", { name: /Record payment/ });
  await pick(page, "pp-m", "Cash");
  await expect(pay.getByLabel("Amount")).toHaveValue("70950.00");
  await pay.getByRole("button", { name: "Save" }).click();
  await expect(toasts(page).filter({ hasText: "Payment recorded." })).toBeVisible();

  // 6. Check out.
  await page.goto(`/checkout/${reservationId}`);
  await page.getByRole("button", { name: "Check out", exact: true }).click();
  await expect(toasts(page).filter({ hasText: /Guest checked out/ })).toBeVisible();
  await expect(page.getByText("Checked out", { exact: true })).toBeVisible();
});

test("walk-in: a new guest created inside the walk-in pop-up does not submit the walk-in", async ({ page }) => {
  await signInAndCreateHotel(page, "walkin");
  await setUpRoomsAndRates(page);
  await page.goto("/front-desk");
  const walkInCalls: string[] = [];
  page.on("request", (r) => { if (/\/rpc\/walk_in_check_in/.test(r.url())) walkInCalls.push(r.url()); });
  await page.getByRole("button", { name: "Walk-in" }).click();
  const walkIn = page.getByRole("dialog", { name: "Walk-in guest" });
  await walkIn.getByRole("button", { name: "New guest" }).click();
  const guestDialog = page.getByRole("dialog", { name: "New guest" });
  await guestDialog.getByLabel("First name").fill("Wale");
  await guestDialog.getByLabel("Last name").fill("Walkin");
  await guestDialog.getByRole("button", { name: "Save" }).click();
  await expect(toasts(page).filter({ hasText: "Guest created." })).toBeVisible();
  await expect(guestDialog).toBeHidden();
  await page.waitForTimeout(1000); // give a wrongly submitted walk-in time to show its error
  expect(walkInCalls, "saving the guest must not submit the walk-in").toEqual([]);
  await expect(toasts(page).filter({ hasText: /Walk-in checked in|Guest not found|Choose a room|required/ })).toHaveCount(0);
  await expect(walkIn).toBeVisible();
  await expect(walkIn.getByText("Wale Walkin", { exact: true })).toBeVisible();
});
