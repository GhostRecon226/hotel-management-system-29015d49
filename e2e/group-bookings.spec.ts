// QA-11: a group with two rooms shows on the group list and detail pages, and cannot be cancelled while bookings are live. Local Supabase only.
import { test, expect } from "@playwright/test";
import { signInAndCreateHotel, setUpRoomsAndRates } from "./helpers";

test("QA-11 a group with two rooms shows its totals and cannot be cancelled while bookings are live", async ({ page }) => {
  await signInAndCreateHotel(page, "groups");
  await setUpRoomsAndRates(page);
  const setUp = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const out: string[] = [];
    const call = async (name: string, fn: string, args: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn as never, args as never);
      if (error) out.push(`${name}: ${error.message}`);
      return data as unknown;
    };
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const p = (ctx as { properties: { id: string; business_date: string }[] }).properties[0]!;
    const bd = p.business_date;
    const plus = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
    const { data: rt } = await supabase.from("room_types").select("id").eq("property_id", p.id).limit(1).single();
    const { data: rp } = await supabase.from("rate_plans").select("id").eq("property_id", p.id).limit(1).single();
    const group = await call("group", "save_group_booking", { p_property_id: p.id, p_id: null, p_name: "Okafor Wedding", p_contact_name: "Ngozi Okafor", p_contact_phone: "08030000000", p_notes: null });
    for (const last of ["One", "Two"]) {
      const g = await call("guest", "save_guest", { p_id: null, p_first_name: "Wedding", p_last_name: last, p_phone: null, p_email: null, p_nationality: "NG", p_address: null, p_notes: null });
      await call("booking", "create_reservation", { p_property_id: p.id, p_idempotency_key: crypto.randomUUID(), p_guest_id: g, p_arrival: plus(bd, 1), p_departure: plus(bd, 3), p_room_type_id: rt!.id, p_rate_plan_id: rp!.id, p_adults: 1, p_children: 0, p_status: "confirmed", p_source: "direct", p_company_name: null, p_special_requests: null, p_notes: null, p_guarantee: "none", p_hold_until: null, p_group_id: group, p_rate_override: null, p_override_reason: null });
    }
    return { out, group: group as string };
  });
  expect(setUp.out, "set-up calls").toEqual([]);

  // The list shows one group with 2 rooms and 4 room nights.
  await page.goto("/reservations/groups");
  const row = page.getByRole("row").filter({ hasText: "Okafor Wedding" });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row).toContainText("Ngozi Okafor");
  await expect(row).toContainText("Active");
  await expect(row.getByRole("cell").nth(4)).toHaveText("2");
  await expect(row.getByRole("cell").nth(5)).toHaveText("4");

  // The detail page lists both bookings and blocks cancelling.
  await row.click();
  await expect(page).toHaveURL(/\/reservations\/groups\//);
  await expect(page.getByRole("heading", { name: /Okafor Wedding/ })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Wedding One")).toBeVisible();
  await expect(page.getByText("Wedding Two")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel group" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Add a room" })).toBeVisible();
});
