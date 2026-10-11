// Requirements: OFF-003, OFF-004
// Offline mode, stage 2: a charge and a cleaning task started with no connection wait on the device,
// then send when the connection returns, and post exactly once. Local Supabase only.
import { test, expect, type Page } from "@playwright/test";
import { pick, setUpRoomsAndRates, signInAndCreateHotel, toasts } from "./helpers";

async function queueEntries(page: Page) {
  return page.evaluate(() => new Promise<{ name: string; args: Record<string, unknown>; status: string }[]>((resolve) => {
    const req = indexedDB.open("zikora-offline", 1);
    req.onsuccess = () => {
      const get = req.result.transaction("kv").objectStore("kv").get("queue");
      get.onsuccess = () => resolve((get.result as never) ?? []);
      get.onerror = () => resolve([]);
    };
    req.onerror = () => resolve([]);
  }));
}

test("offline: a charge entered with no connection sends once when the connection returns", async ({ page, context }) => {
  await signInAndCreateHotel(page, "offwrite");
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
    const g = await call("guest", "save_guest", { p_id: null, p_first_name: "Offline", p_last_name: "Payer", p_phone: null, p_email: null, p_nationality: "NG", p_address: null, p_notes: null });
    const res = await call("booking", "create_reservation", { p_property_id: p.id, p_idempotency_key: crypto.randomUUID(), p_guest_id: g, p_arrival: bd, p_departure: plus(bd, 2), p_room_type_id: rt!.id, p_rate_plan_id: rp!.id, p_adults: 1, p_children: 0, p_status: "confirmed", p_source: "direct", p_company_name: null, p_special_requests: null, p_notes: null, p_guarantee: "none", p_hold_until: null, p_group_id: null, p_rate_override: null, p_override_reason: null });
    const { data: rooms } = await supabase.from("rooms").select("id").eq("property_id", p.id).order("room_number").limit(1);
    await call("check-in", "check_in", { p_id: res, p_registration: { id_type: "passport", id_number: "T1", nationality: "NG" }, p_room_id: rooms![0]!.id, p_room_override_reason: null, p_deposit_waive_reason: null });
    const folio = await call("folio", "open_main_folio", { p_reservation_id: res }) as string;
    return { fails, folio };
  });
  expect(setUp.fails, "set-up calls").toEqual([]);

  const balance = () => page.evaluate(async (folio) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { data } = await supabase.from("v_folio_balances").select("balance").eq("folio_id", folio).maybeSingle();
    return Number((data as { balance: string } | null)?.balance ?? 0);
  }, setUp.folio);
  const before = await balance();

  await page.goto(`/folios/${setUp.folio}`);
  await expect(page.getByRole("button", { name: "Post charge" })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500); // the charge and payment lists finish loading

  // Connection lost. The charge is saved on the device.
  await context.setOffline(true);
  await page.getByRole("button", { name: "Post charge" }).click();
  const charge = page.getByRole("dialog", { name: /Post charge/ });
  await pick(page, "pc-code", "Restaurant");
  await charge.locator("#pc-amt").fill("10000");
  await charge.getByRole("button", { name: "Save" }).click();
  await expect(toasts(page).filter({ hasText: "Saved on this device" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("status").filter({ hasText: "1 waiting to send" })).toBeVisible();
  const queued = await queueEntries(page);
  expect(queued.map((q) => q.name)).toEqual(["post_charge"]);

  // Connection back. The sender and a direct repeat of the same call race; the key keeps it to one posting.
  await context.setOffline(false);
  await page.evaluate(async (args) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    await supabase.rpc("post_charge" as never, args as never); // may be the first or the repeat; either way one posting
  }, queued[0]!.args);
  await expect.poll(async () => (await queueEntries(page)).length, { timeout: 30_000 }).toBe(0);
  await expect(page.getByRole("status").filter({ hasText: "waiting to send" })).toBeHidden({ timeout: 15_000 });
  await expect.poll(async () => Math.round(((await balance()) - before) * 100) / 100, { timeout: 15_000 }).toBe(11825);
});

test("offline: starting a cleaning task with no connection sends when the connection returns", async ({ page, context }) => {
  await signInAndCreateHotel(page, "offhk");
  await setUpRoomsAndRates(page);
  const taskId = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const me = (ctx as { user_id: string }).user_id;
    const { data: rooms } = await supabase.from("rooms").select("id").limit(1);
    const { data: id, error } = await supabase.rpc("create_hk_task" as never, { p_room_id: rooms![0]!.id, p_type: "deep_clean", p_priority: "normal" } as never);
    if (error) throw new Error(error.message);
    const { error: ae } = await supabase.rpc("assign_hk_task" as never, { p_id: id, p_assignee_id: me } as never);
    if (ae) throw new Error(ae.message);
    return id as string;
  });
  const status = () => page.evaluate(async (id) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { data } = await supabase.from("hk_tasks").select("status").eq("id", id).single();
    return (data as { status: string }).status;
  }, taskId);

  await page.goto("/housekeeping/my-tasks");
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible({ timeout: 15_000 });
  await context.setOffline(true);
  await page.getByRole("button", { name: "Start" }).click();
  await expect(toasts(page).filter({ hasText: "Saved on this device" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("status").filter({ hasText: "1 waiting to send" })).toBeVisible();
  await context.setOffline(false);
  await expect.poll(status, { timeout: 30_000 }).toBe("in_progress");
  await expect(page.getByRole("status").filter({ hasText: "waiting to send" })).toBeHidden({ timeout: 15_000 });
});
