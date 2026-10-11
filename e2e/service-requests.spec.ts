// QA-11: a chargeable service request is completed on the screen and the charge lands on the guest's folio. Local Supabase only.
import { test, expect } from "@playwright/test";
import { signInAndCreateHotel, setUpRoomsAndRates } from "./helpers";

test("QA-11 completing a laundry request posts its charge to the guest's folio", async ({ page }) => {
  await signInAndCreateHotel(page, "service");
  await setUpRoomsAndRates(page);
  const setUp = await page.evaluate(async () => {
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
    const g = await call("guest", "save_guest", { p_id: null, p_first_name: "Laundry", p_last_name: "Guest", p_phone: null, p_email: null, p_nationality: "NG", p_address: null, p_notes: null });
    const res = await call("booking", "create_reservation", { p_property_id: p.id, p_idempotency_key: crypto.randomUUID(), p_guest_id: g, p_arrival: bd, p_departure: plus(bd, 2), p_room_type_id: rt!.id, p_rate_plan_id: rp!.id, p_adults: 1, p_children: 0, p_status: "confirmed", p_source: "direct", p_company_name: null, p_special_requests: null, p_notes: null, p_guarantee: "none", p_hold_until: null, p_group_id: null, p_rate_override: null, p_override_reason: null });
    const { data: rooms } = await supabase.from("rooms").select("id").eq("property_id", p.id).order("room_number").limit(1);
    await call("check-in", "check_in", { p_id: res, p_registration: { id_type: "passport", id_number: "T1", nationality: "NG" }, p_room_id: rooms![0]!.id, p_room_override_reason: null, p_deposit_waive_reason: null });
    const folio = await call("folio", "open_main_folio", { p_reservation_id: res }) as string;
    const { data: codes } = await supabase.from("charge_codes").select("id, code").eq("property_id", p.id);
    await call("service request", "create_service_request", { p_reservation_id: res, p_category: "laundry", p_description: "Shirts for pressing", p_chargeable: true, p_charge_amount: 3000, p_charge_code_id: codes!.find((x) => x.code === "LAUNDRY")!.id, p_assignee_id: null });
    return { fails, folio };
  });
  expect(setUp.fails, "set-up calls").toEqual([]);

  const balance = () => page.evaluate(async (folio) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { data } = await supabase.from("v_folio_balances").select("balance").eq("folio_id", folio).maybeSingle();
    return Number((data as { balance: string } | null)?.balance ?? 0);
  }, setUp.folio);
  const before = await balance();

  await page.goto("/service-requests");
  const row = page.getByRole("row").filter({ hasText: "Shirts for pressing" });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByRole("button", { name: "Complete" }).click();
  await expect(row).toHaveCount(0, { timeout: 10_000 });

  // 3,000 plus 18.25% tax lands on the folio.
  await expect.poll(balance, { timeout: 10_000 }).toBe(before + 3000 * 1.1825);
});
