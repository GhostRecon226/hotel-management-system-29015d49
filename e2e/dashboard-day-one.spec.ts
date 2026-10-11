// QA-23: a brand-new hotel's dashboard explains the empty history chart instead of looking broken. Local Supabase only.
import { test, expect } from "@playwright/test";
import { signInAndCreateHotel } from "./helpers";

test("QA-23 a new hotel's occupancy chart says history starts after tonight's roll", async ({ page }) => {
  await signInAndCreateHotel(page, "dayone");
  await expect(page.getByText("Occupancy overview")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("History starts tonight")).toBeVisible();
  await expect(page.getByText("Today's live figures are in the tiles above.", { exact: false })).toBeVisible();
});
