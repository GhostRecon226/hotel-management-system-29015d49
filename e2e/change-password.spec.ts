// QA-19: a signed-in user changes their own password from the account menu, without email.
// Local Supabase only.
import { test, expect } from "@playwright/test";
import { createTestUser } from "./local-supabase";

test("a signed-in user changes their password from the account menu", async ({ page }) => {
  const user = await createTestUser("chgpw");
  const newPassword = `New-${crypto.randomUUID()}`;
  await page.goto("/auth");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your hotel" })).toBeVisible();
  await page.getByLabel("Business name").fill("Chgpw Ltd");
  await page.getByLabel("Property name").fill("Chgpw Hotel");
  await page.getByLabel("Your full name").fill("Tess Tester");
  await page.getByLabel("City").fill("Lagos");
  await page.getByRole("button", { name: "Create hotel" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("button", { name: /Tess Tester/ }).click();
  await page.getByRole("menuitem", { name: "Change password" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Change password" })).toBeVisible();

  // Wrong current password is refused.
  await dialog.getByLabel("Current password").fill("not-my-password");
  await dialog.getByLabel("New password", { exact: true }).fill(newPassword);
  await dialog.getByLabel("Confirm new password").fill(newPassword);
  await dialog.getByRole("button", { name: "Change password" }).click();
  await expect(dialog.getByRole("alert")).toContainText(/current password is not correct/i);

  // Short and mismatched passwords are refused.
  await dialog.getByLabel("Current password").fill(user.password);
  await dialog.getByLabel("New password", { exact: true }).fill("short");
  await dialog.getByLabel("Confirm new password").fill("short");
  await dialog.getByRole("button", { name: "Change password" }).click();
  await expect(dialog.getByRole("alert")).toContainText(/at least 8/i);
  await dialog.getByLabel("New password", { exact: true }).fill(newPassword);
  await dialog.getByLabel("Confirm new password").fill(newPassword + "x");
  await dialog.getByRole("button", { name: "Change password" }).click();
  await expect(dialog.getByRole("alert")).toContainText(/do not match/i);

  // A valid change works.
  await dialog.getByLabel("Confirm new password").fill(newPassword);
  await dialog.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed.")).toBeVisible();
  await expect(dialog).toBeHidden();

  // Old password no longer works; the new one does.
  await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    await supabase.auth.signOut();
  });
  await page.goto("/auth");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
});
