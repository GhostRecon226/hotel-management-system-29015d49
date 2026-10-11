// Dry-run step 7.3: check-in and the attendant task list on a phone (390 x 844). Local Supabase only.
// Each screen must not scroll sideways, and its main buttons must be on screen without sideways scrolling.
import { test, expect, type Locator, type Page } from "@playwright/test";
import { pick, setUpRoomsAndRates, signInAndCreateHotel, toasts } from "./helpers";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function noSideScroll(page: Page, where: string) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, `${where}: the page scrolls sideways by ${over}px`).toBeLessThanOrEqual(1);
}

async function onScreen(page: Page, target: Locator, what: string) {
  await expect(target, what).toBeVisible();
  const box = await target.boundingBox();
  const width = page.viewportSize()!.width;
  expect(box, `${what}: no position`).not.toBeNull();
  expect(box!.x, `${what} starts left of the screen`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${what} runs past the right edge (${Math.round(box!.x + box!.width)}px of ${width}px)`).toBeLessThanOrEqual(width + 1);
}

test("phone: front desk check-in works at 390px wide", async ({ page }) => {
  await signInAndCreateHotel(page, "phonedesk");
  await setUpRoomsAndRates(page);
  const failures = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const out: string[] = [];
    const call = async (fn: string, args: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn as never, args as never);
      if (error) out.push(`${fn}: ${error.message}`);
      return data as unknown;
    };
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const p = (ctx as { properties: { id: string; business_date: string }[] }).properties[0]!;
    const plus = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
    const { data: rt } = await supabase.from("room_types").select("id").eq("code", "STD").single();
    const { data: rp } = await supabase.from("rate_plans").select("id").eq("code", "BAR").single();
    const g = await call("save_guest", { p_id: null, p_first_name: "Phone", p_last_name: "Guest", p_phone: null, p_email: null, p_nationality: "NG", p_address: null, p_notes: null });
    await call("create_reservation", { p_property_id: p.id, p_idempotency_key: crypto.randomUUID(), p_guest_id: g, p_arrival: p.business_date, p_departure: plus(p.business_date, 2), p_room_type_id: rt!.id, p_rate_plan_id: rp!.id, p_adults: 1, p_children: 0, p_status: "confirmed", p_source: "direct", p_company_name: null, p_special_requests: null, p_notes: null, p_guarantee: "none", p_hold_until: null, p_group_id: null, p_rate_override: null, p_override_reason: null });
    return out;
  });
  expect(failures, "set-up calls").toEqual([]);

  await page.goto("/front-desk");
  const row = page.getByRole("row", { name: /Phone Guest/ });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await noSideScroll(page, "Front desk");
  const checkInButton = row.getByRole("button", { name: "Check in" });
  await onScreen(page, checkInButton, "Check in button");
  await checkInButton.tap();

  const dialog = page.getByRole("dialog", { name: /Check in/ });
  await expect(dialog).toBeVisible();
  await noSideScroll(page, "Check-in form");
  await pick(page, "fd-room", /^1 ·/);
  await dialog.getByLabel("ID number").fill("A1234567");
  await dialog.getByLabel("Guest has read and signed the registration card").check();
  const save = dialog.getByRole("button", { name: "Save" });
  await save.scrollIntoViewIfNeeded();
  await onScreen(page, save, "Save button in the check-in form");
  await save.tap();
  await expect(toasts(page).filter({ hasText: "Guest checked in." })).toBeVisible();
});

test("phone: an attendant's task list works at 390px wide", async ({ page }) => {
  await signInAndCreateHotel(page, "phonehk");
  await setUpRoomsAndRates(page);
  const failures = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const out: string[] = [];
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const me = (ctx as { user_id: string }).user_id;
    const { data: rooms } = await supabase.from("rooms").select("id").limit(1);
    const { data: id, error } = await supabase.rpc("create_hk_task" as never, { p_room_id: rooms![0]!.id, p_type: "deep_clean", p_priority: "normal" } as never);
    if (error) return [`create_hk_task: ${error.message}`];
    const { error: ae } = await supabase.rpc("assign_hk_task" as never, { p_id: id, p_assignee_id: me } as never);
    if (ae) out.push(`assign_hk_task: ${ae.message}`);
    return out;
  });
  expect(failures, "set-up calls").toEqual([]);

  await page.goto("/housekeeping/my-tasks");
  await expect(page.getByText("Deep clean")).toBeVisible({ timeout: 10_000 });
  await noSideScroll(page, "My tasks");
  const start = page.getByRole("button", { name: "Start" });
  await onScreen(page, start, "Start button");
  await start.tap();
  await expect(toasts(page).filter({ hasText: "Task started." })).toBeVisible();
  await noSideScroll(page, "My tasks, started");

  // Tick every checklist item with a thumb, then complete.
  const boxes = page.getByRole("checkbox");
  const count = await boxes.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await boxes.nth(i).scrollIntoViewIfNeeded();
    const box = await boxes.nth(i).boundingBox();
    expect(box!.width, "checkbox is big enough to tap").toBeGreaterThanOrEqual(20);
    await boxes.nth(i).tap();
  }
  const complete = page.getByRole("button", { name: "Complete" });
  await complete.scrollIntoViewIfNeeded();
  await onScreen(page, complete, "Complete button");
  await complete.tap();
  await expect(toasts(page).filter({ hasText: "Done. Waiting for inspection." })).toBeVisible();
});

const screens = [
  "/dashboard", "/front-desk", "/reservations", "/reservations/new", "/reservations/availability", "/reservations/groups",
  "/rooms", "/guests", "/housekeeping", "/housekeeping/my-tasks", "/maintenance", "/service-requests", "/cashier",
  "/approvals", "/reports", "/admin", "/setup",
];

test("phone: no main screen scrolls sideways at 390px wide", async ({ page }) => {
  await signInAndCreateHotel(page, "phoneall");
  await setUpRoomsAndRates(page);
  const problems: string[] = [];
  for (const path of screens) {
    await page.goto(path);
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500); // let lists and tabs finish drawing
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) problems.push(`${path}: scrolls sideways by ${over}px`);
  }
  expect(problems).toEqual([]);
});
