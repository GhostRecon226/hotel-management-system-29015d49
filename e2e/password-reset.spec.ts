// Forgotten password: request a link on the sign-in page, open the email, set a new password, sign in with it.
// Local Supabase only; the email is read from the local test mailbox (Mailpit).
import { test, expect } from "@playwright/test";
import { createTestUser, latestAuthLink } from "./local-supabase";

test("a user who forgot their password resets it from the emailed link and signs in with the new one", async ({ page }) => {
  const user = await createTestUser("reset");
  const newPassword = `New-${crypto.randomUUID()}`;

  // 1. Ask for a link from the sign-in page.
  await page.goto("/auth");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
  // The address changes before the new page is drawn; wait for it, or the email goes into the old sign-in form.
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If an account matches that email address/)).toBeVisible();

  // 2. Open the link in the email.
  const link = await latestAuthLink(user.email, /reset/i);
  await page.goto(link);
  await expect(page).toHaveURL(/\/reset-password/);
  await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();

  // 3. Passwords must match and be long enough.
  await page.getByLabel("New password", { exact: true }).fill("short");
  await page.getByLabel("Confirm new password").fill("short");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("alert")).toContainText(/at least 8/i);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword + "x");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("alert")).toContainText(/do not match/i);

  // 4. Save it. The user is signed in and carries on (no hotel yet, so Create your hotel).
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("heading", { name: "Create your hotel" })).toBeVisible();

  // 5. The old password no longer works; the new one does.
  await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    await supabase.auth.signOut();
  });
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/auth/);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your hotel" })).toBeVisible();
});

test("opening the reset page without a valid link explains what to do", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByText(/link has expired or was already used/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Send a new link" })).toBeVisible();
});
