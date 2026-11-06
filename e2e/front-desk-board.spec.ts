// Front Desk as a work list (FO-016): arrival cards, due-out cards, the in-house list, the room tiles and the search box.
// On a phone one list shows at a time. Local Supabase only.
import { test, expect } from "@playwright/test";
import { pick, setUpRoomsAndRates, signInAndCreateHotel, toasts } from "./helpers";

test("[FO-016] Front Desk shows the arrival as a card, the room tiles, and search narrows the lists", async ({ page }) => {
  await signInAndCreateHotel(page, "fdboard");
  await setUpRoomsAndRates(page);

  await page.goto("/reservations/new");
  await page.getByRole("button", { name: "New guest" }).click();
  const guestDialog = page.getByRole("dialog", { name: "New guest" });
  await guestDialog.getByLabel("First name").fill("Bola");
  await guestDialog.getByLabel("Last name").fill("Boardtest");
  await guestDialog.getByRole("button", { name: "Save" }).click();
  await expect(toasts(page).filter({ hasText: "Guest created." })).toBeVisible();
  await pick(page, "room_type", /STD/);
  await pick(page, "rate_plan", /BAR/);
  await page.getByRole("button", { name: "Create booking" }).click();
  await expect(page).toHaveURL(/\/reservations\/[0-9a-f-]{36}$/);

  await page.goto("/front-desk");
  await expect(page.getByRole("heading", { level: 2, name: /Arriving today/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Due out today/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /^In house/ })).toBeVisible();
  const card = page.getByRole("row", { name: /Bola Boardtest/ });
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Check in" })).toBeVisible();

  // Room tiles: both rooms, each named with its state in words.
  await expect(page.getByRole("link", { name: /^Room 1, / })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Room 2, / })).toBeVisible();

  // Search: no match empties the list, a name brings the card back, a room label narrows the tiles.
  const search = page.getByRole("searchbox", { name: "Find a guest, booking or room" });
  await search.fill("zzzz");
  await expect(card).toHaveCount(0);
  await expect(page.getByText("No arrivals match.")).toBeVisible();
  await search.fill("boardtest");
  await expect(card).toBeVisible();
  await search.fill("");
  await search.fill("2");
  await expect(page.getByRole("link", { name: /^Room 1, / })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Room 2, / })).toBeVisible();
});

test("[FO-016] on a phone one list shows at a time, Arriving first, and nothing scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signInAndCreateHotel(page, "fdphone");
  await setUpRoomsAndRates(page);
  await page.goto("/front-desk");
  const arriving = page.getByRole("heading", { level: 2, name: /Arriving today/ });
  await expect(arriving).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /^Rooms/ })).toBeHidden();

  await page.getByRole("button", { name: "Rooms", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2, name: /^Rooms/ })).toBeVisible();
  await expect(arriving).toBeHidden();
  await expect(page.getByRole("link", { name: /^Room 1, / })).toBeVisible();

  await page.getByRole("button", { name: "In house", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2, name: /^In house/ })).toBeVisible();
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  expect(m.sw).toBeLessThanOrEqual(m.iw);
});
