// Requirements: FIN-025, FIN-026
// The cashier's work screen: open folios with Take payment, the close step, and the folio search. Local Supabase only.
import { test, expect } from "@playwright/test";
import { setUpRoomsAndRates, signInAndCreateHotel } from "./helpers";

test("[FIN-025] an open shift lists owing folios, and Take payment opens the payment form", async ({ page }) => {
  await signInAndCreateHotel(page, "cashredo1");
  await setUpRoomsAndRates(page);
  const failures = await page.evaluate(async () => {
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
    const g = await call("guest", "save_guest", { p_id: null, p_first_name: "Cash", p_last_name: "Redo", p_phone: null, p_email: null, p_nationality: "NG", p_address: null, p_notes: null });
    const res = await call("booking", "create_reservation", { p_property_id: p.id, p_idempotency_key: crypto.randomUUID(), p_guest_id: g, p_arrival: bd, p_departure: plus(bd, 2), p_room_type_id: rt!.id, p_rate_plan_id: rp!.id, p_adults: 1, p_children: 0, p_status: "confirmed", p_source: "direct", p_company_name: null, p_special_requests: null, p_notes: null, p_guarantee: "none", p_hold_until: null, p_group_id: null, p_rate_override: null, p_override_reason: null });
    const { data: rooms } = await supabase.from("rooms").select("id").eq("property_id", p.id).order("room_number").limit(1);
    await call("check-in", "check_in", { p_id: res, p_registration: { id_type: "passport", id_number: "T1", nationality: "NG" }, p_room_id: rooms![0]!.id, p_room_override_reason: null, p_deposit_waive_reason: null });
    const folio = await call("folio", "open_main_folio", { p_reservation_id: res }) as string;
    const { data: codes } = await supabase.from("charge_codes").select("id, code").eq("property_id", p.id);
    await call("charge", "post_charge", { p_folio_id: folio, p_charge_code_id: codes!.find((x) => x.code === "REST")!.id, p_amount: 10000, p_tax_inclusive: false, p_description: "Dinner", p_reference: null, p_idempotency_key: crypto.randomUUID() });
    await call("shift", "open_cashier_shift", { p_property_id: p.id, p_opening_float: 20000, p_idempotency_key: crypto.randomUUID() });
    return out;
  });
  expect(failures, "set-up calls").toEqual([]);

  await page.goto("/cashier");
  await expect(page.getByText("Your shift is open")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Open folios" })).toBeVisible();
  await expect(page.getByText("Cash Redo")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Owing", { exact: true })).toBeVisible();
  // The search narrows the list.
  await page.getByLabel("Find a folio").fill("zzz-no-match");
  await expect(page.getByText("No folios match.")).toBeVisible();
  await page.getByLabel("Find a folio").fill("Redo");
  await page.getByRole("link", { name: /Take payment for Cash Redo/ }).click();
  await expect(page.getByRole("dialog", { name: /payment/i })).toBeVisible({ timeout: 15_000 });
});

test("[FIN-025] closing a shift shows what the system expects and asks for a note when a count differs", async ({ page }) => {
  await signInAndCreateHotel(page, "cashredo2");
  await page.goto("/cashier");
  await page.getByLabel(/Opening float/).fill("20000");
  await page.getByRole("button", { name: "Open shift" }).click();
  await expect(page.getByText("Your shift is open")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Close shift" }).click();
  const dialog = page.getByRole("dialog", { name: "Close your shift" });
  const first = dialog.getByRole("textbox").first();
  await expect(dialog.getByText(/Should hold/).first()).toBeVisible();
  await first.fill("1");
  await expect(dialog.getByText(/This count differs/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close shift" })).toBeDisabled();
});

test("[FIN-026] the folios list finds a guest and can show only folios that owe", async ({ page }) => {
  await signInAndCreateHotel(page, "cashredo3");
  await page.goto("/folios");
  await expect(page.getByRole("heading", { name: "Folios" })).toBeVisible({ timeout: 10_000 });
  await page.getByLabel("Find a folio").fill("nobody-by-this-name");
  await expect(page.getByText("No folios match")).toBeVisible();
  await page.getByLabel("Find a folio").fill("");
  await page.getByRole("button", { name: "Owing only" }).click();
  await expect(page.getByRole("button", { name: "Owing only" })).toHaveAttribute("aria-pressed", "true");
});
