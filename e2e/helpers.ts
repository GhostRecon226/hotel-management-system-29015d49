// Shared steps for the browser tests. Local Supabase only (see local-supabase.ts).
import { expect, type Page } from "@playwright/test";
import { createTestUser } from "./local-supabase";

/** Signs a new local user in and creates a hotel through the real screens. */
export async function signInAndCreateHotel(page: Page, label: string) {
  const user = await createTestUser(label);
  await page.goto("/auth");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your hotel" })).toBeVisible();
  await page.getByLabel("Business name").fill(`${label} Ltd`);
  await page.getByLabel("Property name").fill(`${label} Hotel`);
  await page.getByLabel("Your full name").fill("Tess Tester");
  await page.getByLabel("City").fill("Lagos");
  await page.getByRole("button", { name: "Create hotel" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

/** Room type STD, rooms 1 and 2, rate plan BAR at 50,000 a night. Uses the same functions as the Setup screens. */
export async function setUpRoomsAndRates(page: Page) {
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
    await call("bulk_add_rooms", { p_property_id: p.id, p_from: 1, p_to: 2, p_room_type_id: rt, p_floor: "1" });
    const rp = await call("save_rate_plan", { p_property_id: p.id, p_id: null, p_code: "BAR", p_name: "Best available rate", p_is_corporate: false, p_cancellation_type: "none", p_cancellation_value: 0, p_no_show_type: "none", p_no_show_value: 0, p_deposit_type: "none", p_deposit_value: 0, p_is_active: true });
    await call("save_rate_plan_price", { p_id: null, p_rate_plan_id: rp, p_room_type_id: rt, p_valid_from: plus(p.business_date, -5), p_valid_to: plus(p.business_date, 90), p_amount: 50000, p_currency: "NGN" });
    return out;
  });
  expect(failures, "set-up calls").toEqual([]);
}

/** Picks an option in one of the app's drop-downs (Radix Select), found by the trigger's id. */
export async function pick(page: Page, triggerId: string, option: string | RegExp) {
  await page.locator(`#${triggerId}`).click();
  await page.getByRole("option", { name: option }).first().click();
}

/** The toast messages currently on screen. */
export function toasts(page: Page) {
  return page.locator("[data-sonner-toast]");
}
