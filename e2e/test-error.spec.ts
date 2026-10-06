// Safety net (wave 2, item 1): the administrator can send a test error from Setup, Property to check that error
// alerts arrive. Locally there is no DSN, so nothing leaves this machine. Local Supabase only.
import { test, expect } from "@playwright/test";
import { signInAndCreateHotel, toasts } from "./helpers";

test("Setup, Property has Send a test error; it reports success and changes nothing", async ({ page }) => {
  await signInAndCreateHotel(page, "testerror");
  await page.goto("/setup/property");
  const serverCalls: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/_serverFn/")) serverCalls.push(r.url()); });
  await page.getByRole("button", { name: "Send a test error" }).click();
  await expect(toasts(page).filter({ hasText: "Two test errors sent." })).toBeVisible();
  expect(serverCalls.length, "the server part ran").toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "Property details" })).toBeVisible();
});
