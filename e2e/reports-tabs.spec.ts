// QA-11: Reports for the owner: a guest with a bill shows under Outstanding balances, and every tab opens. Local Supabase only.
import { test, expect } from "@playwright/test";
import { signInAndCreateHotel, setUpRoomsAndRates } from "./helpers";

test("QA-11 a guest with a bill shows under Outstanding balances and every report tab opens", async ({ page }) => {
  await signInAndCreateHotel(page, "reports");
  await setUpRoomsAndRates(page);
  const out = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const fails: string[] = [];
    const call = async (name: string, fn: string, args: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn as never, args as never);
      if (error) fails.push(`${name}: ${error.message}`);
      return data as unknown;
    };
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const p = (ctx as { properties: { id: string; business_date: string }[] }).properties[0]!;
    const bd = p.business_date;
    const plus = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
    const { data: rt } = await supabase.from("room_types").select("id").eq("property_id", p.id).limit(1).single();
    const { data: rp } = await supabase.from("rate_plans").select("id").eq("property_id", p.id).limit(1).single();
    const g = await call("guest", "save_guest", { p_id: null, p_first_name: "Report", p_last_name: "Guest", p_phone: null, p_email: null, p_nationality: "NG", p_address: null, p_notes: null });
    const res = await call("booking", "create_reservation", { p_property_id: p.id, p_idempotency_key: crypto.randomUUID(), p_guest_id: g, p_arrival: bd, p_departure: plus(bd, 2), p_room_type_id: rt!.id, p_rate_plan_id: rp!.id, p_adults: 1, p_children: 0, p_status: "confirmed", p_source: "direct", p_company_name: null, p_special_requests: null, p_notes: null, p_guarantee: "none", p_hold_until: null, p_group_id: null, p_rate_override: null, p_override_reason: null });
    const { data: rooms } = await supabase.from("rooms").select("id").eq("property_id", p.id).order("room_number").limit(1);
    await call("check-in", "check_in", { p_id: res, p_registration: { id_type: "passport", id_number: "T1", nationality: "NG" }, p_room_id: rooms![0]!.id, p_room_override_reason: null, p_deposit_waive_reason: null });
    const folio = await call("folio", "open_main_folio", { p_reservation_id: res });
    const { data: codes } = await supabase.from("charge_codes").select("id, code").eq("property_id", p.id);
    await call("charge", "post_charge", { p_folio_id: folio, p_charge_code_id: codes!.find((x) => x.code === "REST")!.id, p_amount: 10000, p_tax_inclusive: false, p_description: "Dinner", p_reference: null, p_idempotency_key: crypto.randomUUID() });
    return fails;
  });
  expect(out, "set-up calls").toEqual([]);

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible({ timeout: 10_000 });

  // 10,000 dinner plus 18.25% tax is a bill of 11,825.
  await page.getByRole("tab", { name: "Outstanding balances" }).click();
  const row = page.getByRole("row").filter({ hasText: "Report Guest" });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row).toContainText("11,825");

  for (const name of ["Daily KPIs", "Revenue by charge code", "By booking source", "Ageing", "Collections", "Payments", "Cancellations and stay length", "Balances by guest", "Export"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
  }
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
});
