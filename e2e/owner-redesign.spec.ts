// Requirements: RPT-012, RPT-013, ADM-010
// The owner's Dashboard, grouped Reports and grouped Admin. Local Supabase only.
import { test, expect } from "@playwright/test";
import { signInAndCreateHotel } from "./helpers";

test("[RPT-012] the owner's Dashboard shows Yesterday and Needs your decision, with no dark photo banner", async ({ page }) => {
  await signInAndCreateHotel(page, "ownerredo1");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /^Yesterday/ })).toBeVisible({ timeout: 15_000 });
  for (const label of ["Revenue", "Collected", "Occupancy", "ADR", "RevPAR", "Owed by guests"]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Needs your decision" })).toBeVisible();
  await expect(page.locator(".dash-banner")).toHaveCount(0);
  // The owner's view leaves out the desk shortcuts.
  await expect(page.getByRole("heading", { name: "Quick actions" })).toHaveCount(0);
});

test("[RPT-013] Reports groups its reports and a period button sets the dates", async ({ page }) => {
  await signInAndCreateHotel(page, "ownerredo2");
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible({ timeout: 15_000 });
  const nav = page.getByRole("tablist", { name: "Report" });
  for (const group of ["Performance", "Money in", "Money owed", "Share"]) await expect(nav.getByText(group, { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Ageing", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Ageing", exact: true })).toHaveAttribute("data-state", "active");
  await page.getByRole("button", { name: "Yesterday" }).click();
  await expect(page.getByLabel("From")).toHaveValue(await page.getByLabel("To").inputValue());
  await expect(page.getByRole("button", { name: "Yesterday" })).toHaveAttribute("aria-pressed", "true");
});

test("[ADM-010] Admin opens on a health strip and groups its areas", async ({ page }) => {
  await signInAndCreateHotel(page, "ownerredo3");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible({ timeout: 15_000 });
  const health = page.getByLabel("Health of your hotel account");
  await expect(health).toBeVisible({ timeout: 10_000 });
  await expect(health.getByText("Active staff")).toBeVisible();
  await expect(health.getByText("Plan", { exact: true })).toBeVisible();
  const nav = page.getByRole("tablist", { name: "Admin area" });
  for (const group of ["People", "Hotel", "Safety"]) await expect(nav.getByText(group, { exact: true })).toBeVisible();
  // A health box opens its area.
  await health.getByText("Plan", { exact: true }).click();
  await expect(page.getByRole("tab", { name: "Subscription", exact: true })).toHaveAttribute("data-state", "active");
});

test("[ADM-010] on a phone the report and admin lists become a drop-down", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signInAndCreateHotel(page, "ownerredo4");
  await page.goto("/reports");
  const pick = page.locator("#grouped-tabs-select");
  await expect(pick).toBeVisible({ timeout: 15_000 });
  await pick.selectOption("ageing");
  await expect(page.locator('[role="tab"][data-state="active"]')).toHaveText("Ageing");
  await page.goto("/admin");
  await expect(page.locator("#grouped-tabs-select")).toBeVisible({ timeout: 15_000 });
});
