// Money and booking calls through the real Supabase API path (PostgREST), which loads the safeupdate guard.
// The database suite connects directly and cannot load it, so this is where "DELETE requires a WHERE clause"
// and similar API-only failures show up. Local Supabase only.
import { test, expect, type Page } from "@playwright/test";
import { createTestUser } from "./local-supabase";

async function signInAndCreateHotel(page: Page) {
  const user = await createTestUser("api");
  await page.goto("/auth");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your hotel" })).toBeVisible();
  await page.getByLabel("Business name").fill("API Path Ltd");
  await page.getByLabel("Property name").fill("API Path Hotel");
  await page.getByLabel("Your full name").fill("Tess Tester");
  await page.getByLabel("City").fill("Lagos");
  await page.getByRole("button", { name: "Create hotel" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test("charges, payments, service requests and room charges work through the API", async ({ page }) => {
  await signInAndCreateHotel(page);
  // Every call below goes from the browser through PostgREST, exactly as the screens do.
  const result = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const steps: Record<string, string> = {};
    const call = async (name: string, fn: string, args: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn as never, args as never);
      steps[name] = error ? `FAILED: ${error.message}` : "ok";
      return data as unknown;
    };
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const p = (ctx as { properties: { id: string; business_date: string }[] }).properties[0]!;
    const bd = p.business_date;
    const plus = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
    const rt = await call("room type", "save_room_type", { p_property_id: p.id, p_id: null, p_code: "STD", p_name: "Standard", p_max_adults: 2, p_max_children: 0, p_description: null, p_is_active: true });
    await call("rooms", "bulk_add_rooms", { p_property_id: p.id, p_from: 1, p_to: 2, p_room_type_id: rt, p_floor: "1" });
    const rp = await call("rate plan", "save_rate_plan", { p_property_id: p.id, p_id: null, p_code: "BAR", p_name: "Best", p_is_corporate: false, p_cancellation_type: "none", p_cancellation_value: 0, p_no_show_type: "none", p_no_show_value: 0, p_deposit_type: "none", p_deposit_value: 0, p_is_active: true });
    await call("price", "save_rate_plan_price", { p_id: null, p_rate_plan_id: rp, p_room_type_id: rt, p_valid_from: bd, p_valid_to: plus(bd, 30), p_amount: 50000, p_currency: "NGN" });
    const g = await call("guest", "save_guest", { p_id: null, p_first_name: "Api", p_last_name: "Guest", p_phone: null, p_email: null, p_nationality: "NG", p_address: null, p_notes: null });
    const res = await call("booking", "create_reservation", { p_property_id: p.id, p_idempotency_key: crypto.randomUUID(), p_guest_id: g, p_arrival: bd, p_departure: plus(bd, 2), p_room_type_id: rt, p_rate_plan_id: rp, p_adults: 1, p_children: 0, p_status: "confirmed", p_source: "direct", p_company_name: null, p_special_requests: null, p_notes: null, p_guarantee: "none", p_hold_until: null, p_group_id: null, p_rate_override: null, p_override_reason: null });
    const { data: rooms } = await supabase.from("rooms").select("id").eq("property_id", p.id).order("room_number").limit(1);
    await call("check-in", "check_in", { p_id: res, p_registration: { id_type: "passport", id_number: "T1", nationality: "NG" }, p_room_id: rooms![0]!.id, p_room_override_reason: null, p_deposit_waive_reason: null });
    const folio = await call("open folio", "open_main_folio", { p_reservation_id: res });
    const { data: codes } = await supabase.from("charge_codes").select("id, code").eq("property_id", p.id);
    const code = (c: string) => codes!.find((x) => x.code === c)!.id;
    await call("post charge", "post_charge", { p_folio_id: folio, p_charge_code_id: code("REST"), p_amount: 10000, p_tax_inclusive: false, p_description: "Dinner", p_reference: null, p_idempotency_key: crypto.randomUUID() });
    const { data: pms } = await supabase.from("payment_methods").select("id, code").eq("property_id", p.id);
    await call("post payment", "post_payment", { p_folio_id: folio, p_payment_method_id: pms!.find((x) => x.code === "CASH")!.id, p_amount: 5000, p_currency: "NGN", p_is_deposit: false, p_description: null, p_reference: null, p_idempotency_key: crypto.randomUUID() });
    const svc = await call("service request", "create_service_request", { p_reservation_id: res, p_category: "laundry", p_description: "Shirts", p_chargeable: true, p_charge_amount: 3000, p_charge_code_id: code("LAUNDRY"), p_assignee_id: null });
    await call("complete service request", "complete_service_request", { p_id: svc });
    await call("post room charges", "post_room_charges", { p_property_id: p.id, p_business_date: bd });
    await call("exchange rate", "set_exchange_rate", { p_property_id: p.id, p_currency: "USD", p_rate_date: bd, p_rate: 1500 });
    const { data: bal } = await supabase.from("v_folio_balances").select("balance").eq("folio_id", folio as string).single();
    return { steps, balance: (bal as { balance: string } | null)?.balance };
  });
  for (const [step, outcome] of Object.entries(result.steps)) expect(outcome, step).toBe("ok");
  // 10,000 dinner + 3,000 laundry + 50,000 room night, each plus 18.25% tax, less 5,000 cash.
  expect(Number(result.balance)).toBe(63000 * 1.1825 - 5000);
});
