// [RES-013] The "ready for arrival" flag, through the real screens: Mark ready on the booking page shows a badge there
// and on the Front Desk arrivals list, and Not ready takes it off again. Local Supabase only.
import { test, expect } from "@playwright/test";
import { setUpRoomsAndRates, signInAndCreateHotel } from "./helpers";

test("[RES-013] a booking marked ready shows Ready on the booking page and the Front Desk, then not ready clears it", async ({ page }) => {
  await signInAndCreateHotel(page, "readyflag");
  await setUpRoomsAndRates(page);
  const out = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const errors: string[] = [];
    const call = async (fn: string, args: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn as never, args as never);
      if (error) errors.push(`${fn}: ${error.message}`);
      return data as unknown;
    };
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const p = (ctx as { properties: { id: string; business_date: string }[] }).properties[0]!;
    const plus = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
    const { data: rt } = await supabase.from("room_types").select("id").eq("code", "STD").single();
    const { data: rp } = await supabase.from("rate_plans").select("id").eq("code", "BAR").single();
    const g = await call("save_guest", { p_id: null, p_first_name: "Ready", p_last_name: "Flag", p_phone: null, p_email: null, p_nationality: "NG", p_address: null, p_notes: null });
    const id = await call("create_reservation", { p_property_id: p.id, p_idempotency_key: crypto.randomUUID(), p_guest_id: g, p_arrival: p.business_date, p_departure: plus(p.business_date, 2), p_room_type_id: rt!.id, p_rate_plan_id: rp!.id, p_adults: 1, p_children: 0, p_status: "confirmed", p_source: "direct", p_company_name: null, p_special_requests: null, p_notes: null, p_guarantee: "none", p_hold_until: null, p_group_id: null, p_rate_override: null, p_override_reason: null });
    return { errors, id: id as string };
  });
  expect(out.errors, "set-up calls").toEqual([]);

  await page.goto(`/reservations/${out.id}`);
  await expect(page.getByText("Ready for arrival")).toHaveCount(0);
  await page.getByRole("button", { name: "Mark ready" }).click();
  await expect(page.getByText("Ready for arrival")).toBeVisible();

  await page.goto("/front-desk");
  const row = page.getByRole("row", { name: /Ready Flag/ });
  await expect(row).toBeVisible();
  await expect(row.getByText("Ready", { exact: true })).toBeVisible();

  await page.goto(`/reservations/${out.id}`);
  await page.getByRole("button", { name: "Not ready" }).click();
  await expect(page.getByText("Ready for arrival")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark ready" })).toBeVisible();
});
