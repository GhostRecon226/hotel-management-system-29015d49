// Requirements: MNT-005, MNT-006, MNT-007, MNT-008, SVC-003
// Maintenance Board, My jobs, ticket page, Report a problem and service request cards. Local Supabase only.
import { test, expect, type Page } from "@playwright/test";
import { setUpRoomsAndRates, signInAndCreateHotel } from "./helpers";

async function makeTickets(page: Page) {
  const failures = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const out: string[] = [];
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const c = ctx as { user_id: string; properties: { id: string }[] };
    const { data: rooms } = await supabase.from("rooms").select("id, room_number").order("room_number");
    const make = async (title: string, room: string, priority: string, assign: boolean) => {
      const { data: id, error } = await supabase.rpc("create_ticket" as never, {
        p_property_id: c.properties[0]!.id, p_title: title, p_description: null, p_room_id: room, p_location: null, p_priority: priority,
      } as never);
      if (error) { out.push(`create_ticket: ${error.message}`); return; }
      if (assign) {
        const { error: ae } = await supabase.rpc("assign_ticket" as never, { p_id: id, p_assignee_id: c.user_id } as never);
        if (ae) out.push(`assign_ticket: ${ae.message}`);
      }
    };
    await make("No hot water", rooms![0]!.id, "urgent", false);
    await make("TV remote broken", rooms![1]!.id, "normal", true);
    return out;
  });
  expect(failures, "set-up calls").toEqual([]);
}

test("[MNT-006] the supervisor opens on the board, with what needs attention and the list one tap away", async ({ page }) => {
  await signInAndCreateHotel(page, "mntredo1");
  await setUpRoomsAndRates(page);
  await makeTickets(page);
  await page.goto("/maintenance");
  const attention = page.locator("section").filter({ has: page.getByRole("heading", { name: /^Needs attention/ }) });
  await expect(attention).toBeVisible({ timeout: 10_000 });
  await expect(attention.getByText("Urgent", { exact: true })).toBeVisible();
  await expect(attention.getByRole("button", { name: "Assign" })).toBeVisible();
  const load = page.locator("section").filter({ has: page.getByRole("heading", { name: "Workload" }) });
  await expect(load.getByText("1 active · 0 waiting")).toBeVisible();
  await expect(page.getByRole("region", { name: "Open" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Assigned and working" })).toContainText("TV remote broken");
  await expect(page.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "List" }).click();
  await expect(page.getByRole("row").filter({ hasText: "No hot water" })).toBeVisible();
});

test("[MNT-005] My jobs shows my ticket with one large button, and Mark resolved offers common fixes", async ({ page }) => {
  await signInAndCreateHotel(page, "mntredo2");
  await setUpRoomsAndRates(page);
  await makeTickets(page);
  await page.goto("/maintenance");
  await page.getByRole("button", { name: "My jobs" }).click();
  await expect(page.getByText("1 job to do")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("TV remote broken")).toBeVisible();
  await expect(page.getByText("No hot water")).toHaveCount(0);
  await page.getByRole("button", { name: "Start work" }).click();
  await page.getByRole("button", { name: "Mark resolved" }).click();
  const dialog = page.getByRole("dialog", { name: "Mark resolved" });
  await dialog.getByRole("button", { name: "Reset the breaker" }).click();
  await expect(dialog.getByLabel("What was done?")).toHaveValue("Reset the breaker");
});

test("[MNT-007] a ticket shows five steps, one main button and the other actions under More", async ({ page }) => {
  await signInAndCreateHotel(page, "mntredo3");
  await setUpRoomsAndRates(page);
  await makeTickets(page);
  await page.goto("/maintenance");
  await page.getByRole("button", { name: "List" }).click();
  await page.getByRole("link", { name: "TV remote broken" }).click();
  const steps = page.getByRole("list", { name: "Progress" });
  await expect(steps).toBeVisible({ timeout: 10_000 });
  for (const label of ["Open", "Assigned", "In progress", "Resolved", "Closed"]) await expect(steps.getByText(label)).toBeVisible();
  await expect(steps.getByRole("listitem").nth(1)).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("button", { name: "Start work" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Block room" })).toHaveCount(0);
  await page.getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("menuitem", { name: "Block room" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Put on hold" })).toBeVisible();
});

test("[MNT-008] Report a problem fills the problem from one tap", async ({ page }) => {
  await signInAndCreateHotel(page, "mntredo4");
  await setUpRoomsAndRates(page);
  await page.goto("/maintenance");
  await page.getByRole("button", { name: "Report a problem" }).click();
  const dialog = page.getByRole("dialog", { name: "Report a problem" });
  await dialog.getByRole("button", { name: "AC not cooling" }).click();
  await expect(dialog.getByLabel("What is wrong?")).toHaveValue("AC not cooling");
  await expect(dialog.getByRole("button", { name: "AC not cooling" })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Urgent" }).click();
  await expect(dialog.getByRole("button", { name: "Urgent" })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Other" }).click();
  await expect(dialog.getByLabel("What is wrong?")).toHaveValue("");
});

test("[SVC-003] on a phone a service request is a card with the room first and one large action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signInAndCreateHotel(page, "mntredo5");
  await setUpRoomsAndRates(page);
  const failures = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const fails: string[] = [];
    const call = async (name: string, fn: string, args: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn as never, args as never);
      if (error) fails.push(`${name}: ${error.message}`);
      return data as unknown;
    };
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const p = (ctx as { properties: { id: string; business_date: string }[] }).properties[0]!;
    const plus = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
    const { data: rt } = await supabase.from("room_types").select("id").eq("property_id", p.id).limit(1).single();
    const { data: rp } = await supabase.from("rate_plans").select("id").eq("property_id", p.id).limit(1).single();
    const g = await call("guest", "save_guest", { p_id: null, p_first_name: "Card", p_last_name: "Guest", p_phone: null, p_email: null, p_nationality: "NG", p_address: null, p_notes: null });
    const res = await call("booking", "create_reservation", { p_property_id: p.id, p_idempotency_key: crypto.randomUUID(), p_guest_id: g, p_arrival: p.business_date, p_departure: plus(p.business_date, 2), p_room_type_id: rt!.id, p_rate_plan_id: rp!.id, p_adults: 1, p_children: 0, p_status: "confirmed", p_source: "direct", p_company_name: null, p_special_requests: null, p_notes: null, p_guarantee: "none", p_hold_until: null, p_group_id: null, p_rate_override: null, p_override_reason: null });
    const { data: rooms } = await supabase.from("rooms").select("id").eq("property_id", p.id).order("room_number").limit(1);
    await call("check-in", "check_in", { p_id: res, p_registration: { id_type: "passport", id_number: "T1", nationality: "NG" }, p_room_id: rooms![0]!.id, p_room_override_reason: null, p_deposit_waive_reason: null });
    await call("folio", "open_main_folio", { p_reservation_id: res });
    await call("service request", "create_service_request", { p_reservation_id: res, p_category: "amenities", p_description: "Extra pillows", p_chargeable: false, p_charge_amount: null, p_charge_code_id: null, p_assignee_id: null });
    return fails;
  });
  expect(failures, "set-up calls").toEqual([]);
  await page.goto("/service-requests");
  const cards = page.getByLabel("Service requests as cards");
  await expect(cards.getByText("Extra pillows")).toBeVisible({ timeout: 10_000 });
  await expect(cards.getByText("Free")).toBeVisible();
  await expect(cards.getByRole("button", { name: "Complete" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mine" })).toBeVisible();
});
