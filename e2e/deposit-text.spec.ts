// QA-01 (10 Oct 2026): the check-in deposit box said the folio "is not built yet". It is built, so the box now
// tells staff to record the deposit as a payment on the folio. Local Supabase only.
import { test, expect } from "@playwright/test";
import { pick, signInAndCreateHotel } from "./helpers";

test("check-in shows the corrected deposit sentence when a deposit is due", async ({ page }) => {
  await signInAndCreateHotel(page, "deptext");

  // Room type STD, one room, and a rate plan that asks for a fixed 10,000 deposit.
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
    const rt = await call("save_room_type", { p_property_id: p.id, p_id: null, p_code: "STD", p_name: "Standard", p_max_adults: 2, p_max_children: 0, p_description: null, p_is_active: true });
    await call("bulk_add_rooms", { p_property_id: p.id, p_from: 1, p_to: 1, p_room_type_id: rt, p_floor: "1" });
    const rp = await call("save_rate_plan", { p_property_id: p.id, p_id: null, p_code: "DEP", p_name: "Deposit rate", p_is_corporate: false, p_cancellation_type: "none", p_cancellation_value: 0, p_no_show_type: "none", p_no_show_value: 0, p_deposit_type: "fixed", p_deposit_value: 10000, p_is_active: true });
    await call("save_rate_plan_price", { p_id: null, p_rate_plan_id: rp, p_room_type_id: rt, p_valid_from: plus(p.business_date, -5), p_valid_to: plus(p.business_date, 90), p_amount: 50000, p_currency: "NGN" });
    return out;
  });
  expect(failures, "set-up calls").toEqual([]);

  // Book today to tomorrow on that rate plan.
  await page.goto("/reservations/new");
  await page.getByRole("button", { name: "New guest" }).click();
  const guestDialog = page.getByRole("dialog", { name: "New guest" });
  await guestDialog.getByLabel("First name").fill("Dayo");
  await guestDialog.getByLabel("Last name").fill("Deposit");
  await guestDialog.getByRole("button", { name: "Save" }).click();
  await expect(guestDialog).toBeHidden();
  await pick(page, "room_type", /STD/);
  await pick(page, "rate_plan", /DEP/);
  await page.getByRole("button", { name: "Create booking" }).click();
  await expect(page).toHaveURL(/\/reservations\/[0-9a-f-]{36}$/);

  // Open the check-in form from the front desk.
  await page.goto("/front-desk");
  await page.getByRole("row", { name: /Dayo Deposit/ }).getByRole("button", { name: "Check in" }).click();
  const checkIn = page.getByRole("dialog", { name: /Check in/ });
  await expect(checkIn.getByText("is required before check-in")).toBeVisible();
  await expect(checkIn.getByText("Record the deposit as a payment on the folio, then check in.")).toBeVisible();
  await expect(checkIn.getByText("which is not built yet")).toHaveCount(0);
});
