// QA-11: the Admin screen for the hotel owner: staff list, invite form and every tab opens. Local Supabase only.
import { test, expect } from "@playwright/test";
import { signInAndCreateHotel } from "./helpers";

test("QA-11 the owner sees themselves in Admin, opens the invite form and every tab", async ({ page }) => {
  await signInAndCreateHotel(page, "admintabs");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();

  // Staff tab: the owner is listed and marked as the signed-in person.
  await expect(page.getByRole("cell", { name: "Tess Tester" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("(you)")).toBeVisible();

  // The invite form opens and closes.
  await page.getByRole("button", { name: "Invite staff" }).click();
  await expect(page.getByRole("heading", { name: "Invite a staff member" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Invite a staff member" })).toHaveCount(0);

  // Each tab opens without the error page.
  const problems: string[] = [];
  for (const name of ["Roles", "Approval limits", "Audit log", "Subscription", "Business date", "Messages", "Support access"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("data-state", "active");
    if (await page.getByText("Something went wrong on our end").count()) problems.push(`${name}: error page`);
  }
  expect(problems).toEqual([]);
});
