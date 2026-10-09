// [RPT-007] The dashboard shows "Yesterday at a glance" to the owner, with sentences from the database and no AI. Local Supabase only.
import { test, expect } from "@playwright/test";
import { signInAndCreateHotel } from "./helpers";

test("RPT-007 the dashboard shows yesterday at a glance without AI", async ({ page }) => {
  await signInAndCreateHotel(page, "ownersummary");
  await page.goto("/dashboard");
  const card = page.getByLabel("Yesterday at a glance");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Business date:");
  await expect(card).toContainText("Collected on");
  await expect(card).toContainText("approvals");
});
