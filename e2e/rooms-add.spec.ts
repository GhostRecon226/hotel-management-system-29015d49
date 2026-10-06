// Rooms page: "Add room" and "Add several rooms" (numbers and names), for roles that can set up rooms
// (stage 1, 6 Oct 2026; requirement ROOM-005). Labels are free text, shown as typed, in natural order,
// and lists and boards show "Zurich (Standard)". Local Supabase only.
import { test, expect, type Page } from "@playwright/test";
import { pick, setUpRoomsAndRates, signInAndCreateHotel, toasts } from "./helpers";
import { createTestUser, passwordTokens } from "./local-supabase";

async function roomTiles(page: Page) {
  return page.locator('main a[href^="/rooms/"]').allInnerTexts();
}

test("an administrator adds one room by name from the Rooms page", async ({ page }) => {
  await signInAndCreateHotel(page, "addroom");
  await setUpRoomsAndRates(page); // rooms 1 and 2, type STD (Standard)
  await page.goto("/rooms");
  await page.getByRole("button", { name: "Add room", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add room" });
  await dialog.getByLabel("Room name or number").fill("  Zürich   Lake ");
  await pick(page, "ar-type", /Standard/);
  await dialog.getByLabel("Floor").fill("1");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(toasts(page).filter({ hasText: "Room added." })).toBeVisible();
  await expect(dialog).toBeHidden();
  const tile = page.locator('main a[href^="/rooms/"]').filter({ hasText: "Zürich Lake" });
  await expect(tile).toContainText("Zürich Lake (Standard)");
  // The same name in another case is refused with a clear message.
  await page.getByRole("button", { name: "Add room", exact: true }).click();
  await dialog.getByLabel("Room name or number").fill("zürich lake");
  await pick(page, "ar-type", /Standard/);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(toasts(page).filter({ hasText: "already exists" })).toBeVisible();
});

test("add several rooms by number, with a prefix and a preview, in natural order", async ({ page }) => {
  await signInAndCreateHotel(page, "addnums");
  await setUpRoomsAndRates(page);
  await page.goto("/rooms");
  await page.getByRole("button", { name: "Add several rooms" }).click();
  const dialog = page.getByRole("dialog", { name: "Add several rooms" });
  await dialog.getByRole("tab", { name: "Numbers" }).click();
  await pick(page, "asr-type", /Standard/);
  await dialog.getByLabel("Floor").fill("1");
  await dialog.getByLabel("From").fill("1");
  await dialog.getByLabel("To").fill("10");
  // Rooms 1 and 2 exist already: the preview says what will be added and what is skipped.
  await expect(dialog.getByText("Adds 8 rooms: 3, 4, 5, 6, 7, 8, 9, 10")).toBeVisible();
  await expect(dialog.getByText("Already there, skipped: 1, 2")).toBeVisible();
  await dialog.getByRole("button", { name: "Add 8 rooms" }).click();
  await expect(toasts(page).filter({ hasText: "8 rooms added. 2 skipped (already there)." })).toBeVisible();
  const tiles = await roomTiles(page);
  const labels = tiles.map((t) => t.split("\n")[0]!.replace(/ \(Standard\)$/, ""));
  expect(labels.slice(0, 10)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);

  // A prefix: A1 to A3 on floor 2.
  await page.getByRole("button", { name: "Add several rooms" }).click();
  await dialog.getByRole("tab", { name: "Numbers" }).click();
  await pick(page, "asr-type", /Standard/);
  await dialog.getByLabel("Floor").fill("2");
  await dialog.getByLabel("Prefix").fill("A");
  await dialog.getByLabel("From").fill("1");
  await dialog.getByLabel("To").fill("3");
  await expect(dialog.getByText("Adds 3 rooms: A1, A2, A3")).toBeVisible();
  await dialog.getByRole("button", { name: "Add 3 rooms" }).click();
  await expect(toasts(page).filter({ hasText: "3 rooms added." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Floor 2" })).toBeVisible();
  await expect(page.locator('main a[href^="/rooms/"]').filter({ hasText: "A3 (Standard)" })).toBeVisible();
});

test("add several rooms by name: one per line, duplicates skipped, names not allowed are shown", async ({ page }) => {
  await signInAndCreateHotel(page, "addnames");
  await setUpRoomsAndRates(page);
  await page.goto("/rooms");
  await page.getByRole("button", { name: "Add several rooms" }).click();
  const dialog = page.getByRole("dialog", { name: "Add several rooms" });
  await dialog.getByRole("tab", { name: "Names" }).click();
  await pick(page, "asr-type", /Standard/);
  await dialog.getByLabel("Room names, one per line").fill("Zurich\nBoston\n\nzurich\nRoom#9");
  await expect(dialog.getByText("Adds 2 rooms: Zurich, Boston")).toBeVisible();
  await expect(dialog.getByText("Already there, skipped: zurich")).toBeVisible();
  await expect(dialog.getByText(/Not allowed: Room#9/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Add \d+ rooms?$/ })).toBeDisabled();
  await dialog.getByLabel("Room names, one per line").fill("Zurich\nBoston\n\nzurich");
  await dialog.getByRole("button", { name: "Add 2 rooms" }).click();
  await expect(toasts(page).filter({ hasText: "2 rooms added. 1 skipped (already there)." })).toBeVisible();
  const labels = (await roomTiles(page)).map((t) => t.split("\n")[0]);
  expect(labels).toEqual(["1 (Standard)", "2 (Standard)", "Boston (Standard)", "Zurich (Standard)"]);
});

test("front desk staff do not see the add buttons on the Rooms page", async ({ page, browser }) => {
  await signInAndCreateHotel(page, "addperm");
  await setUpRoomsAndRates(page);
  const clerk = await createTestUser("addperm-fdo");
  const tokens = (await passwordTokens(clerk.email, clerk.password)) as unknown as { user: { id: string } };
  const failures = await page.evaluate(async (userId) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const out: string[] = [];
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const p = (ctx as { properties: { id: string }[] }).properties[0]!;
    const { data: roles } = await (supabase.from as any)("roles").select("id, code").eq("code", "FDO").is("tenant_id", null);
    const r1 = await supabase.rpc("register_invited_user" as never, { p_user_id: userId, p_full_name: "Femi Frontdesk", p_phone: null } as never);
    if (r1.error) out.push(r1.error.message);
    const r2 = await supabase.rpc("assign_role" as never, { p_user_id: userId, p_property_id: p.id, p_role_id: (roles as { id: string }[])[0]!.id } as never);
    if (r2.error) out.push(r2.error.message);
    return out;
  }, tokens.user.id);
  expect(failures, "set-up calls").toEqual([]);
  await expect(page.getByRole("button", { name: "Add several rooms" })).toHaveCount(0); // not on the dashboard either way

  const ctx = await browser.newContext();
  const clerkPage = await ctx.newPage();
  await clerkPage.goto("/auth");
  await clerkPage.getByLabel("Email").fill(clerk.email);
  await clerkPage.getByLabel("Password").fill(clerk.password);
  await clerkPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(clerkPage).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await clerkPage.goto("/rooms");
  await expect(clerkPage.getByRole("heading", { name: "Rooms", exact: true })).toBeVisible();
  await expect(clerkPage.locator('main a[href^="/rooms/"]').first()).toBeVisible();
  await expect(clerkPage.getByRole("button", { name: "Add room", exact: true })).toHaveCount(0);
  await expect(clerkPage.getByRole("button", { name: "Add several rooms" })).toHaveCount(0);
  await ctx.close();
});
