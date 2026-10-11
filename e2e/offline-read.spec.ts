// Offline mode, stage 1: after one online visit, the front desk lists open again with the network off.
// Local Supabase only. The service worker is turned on with a flag, and told to treat the network as down,
// because the browser's own offline switch does not always reach a service worker.
import { test, expect, type Page } from "@playwright/test";
import { setUpRoomsAndRates, signInAndCreateHotel } from "./helpers";

async function swSend(page: Page, message: unknown) {
  await page.evaluate(async (m) => {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage(m);
  }, message);
}

async function swFallbacks(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return new Promise<number>((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = (e) => resolve((e.data as { fallbacks: number }).fallbacks);
      reg.active?.postMessage({ type: "stats" }, [ch.port2]);
    });
  });
}

test("offline: the front desk lists open from the saved copy with no connection, and come back online", async ({ page, context }) => {
  await page.addInitScript(() => window.localStorage.setItem("zikora.sw", "1"));
  await signInAndCreateHotel(page, "offread");
  await setUpRoomsAndRates(page);
  await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const plus = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const p = (ctx as { properties: { id: string; business_date: string }[] }).properties[0]!;
    const { data: rt } = await supabase.from("room_types").select("id").eq("code", "STD").single();
    const { data: rp } = await supabase.from("rate_plans").select("id").eq("code", "BAR").single();
    const { data: g } = await supabase.rpc("save_guest" as never, { p_id: null, p_first_name: "Offline", p_last_name: "Guest", p_phone: null, p_email: null, p_nationality: "NG", p_address: null, p_notes: null } as never);
    const { error } = await supabase.rpc("create_reservation" as never, { p_property_id: p.id, p_idempotency_key: crypto.randomUUID(), p_guest_id: g, p_arrival: p.business_date, p_departure: plus(p.business_date, 2), p_room_type_id: rt!.id, p_rate_plan_id: rp!.id, p_adults: 1, p_children: 0, p_status: "confirmed", p_source: "direct", p_company_name: null, p_special_requests: null, p_notes: null, p_guarantee: "none", p_hold_until: null, p_group_id: null, p_rate_override: null, p_override_reason: null } as never);
    if (error) throw new Error(error.message);
  });

  // Online visit: the list loads and is saved on the device.
  await page.goto("/front-desk");
  await expect(page.getByRole("row", { name: /Offline Guest/ })).toBeVisible({ timeout: 15_000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // the service worker now controls the page and saves what loads
  await expect(page.getByRole("row", { name: /Offline Guest/ })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(4000); // the list is saved two seconds after it changes

  // Network down.
  await swSend(page, { type: "simulate-offline", on: true });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Front Desk", exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("status").filter({ hasText: "No connection" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Offline Guest/ })).toBeVisible();
  expect(await swFallbacks(page), "the page really came from the saved copy").toBeGreaterThan(0);

  // Network back.
  await context.setOffline(false);
  await swSend(page, { type: "simulate-offline", on: false });
  await expect(page.getByRole("status").filter({ hasText: "No connection" })).toBeHidden({ timeout: 15_000 });
});

test("offline: signing out removes the saved lists", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("zikora.sw", "1"));
  await signInAndCreateHotel(page, "offclear");
  await page.goto("/front-desk");
  await expect(page.getByRole("heading", { name: "Front Desk", exact: true })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(4000);
  const before = await page.evaluate(() => new Promise<boolean>((resolve) => {
    const req = indexedDB.open("zikora-offline", 1);
    req.onsuccess = () => {
      const get = req.result.transaction("kv").objectStore("kv").get("lists");
      get.onsuccess = () => resolve(!!get.result);
    };
    req.onerror = () => resolve(false);
  }));
  expect(before, "lists are saved while signed in").toBe(true);

  await page.getByRole("button", { name: /Tess Tester/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/auth/, { timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => new Promise<boolean>((resolve) => {
    const req = indexedDB.open("zikora-offline", 1);
    req.onsuccess = () => {
      const get = req.result.transaction("kv").objectStore("kv").get("lists");
      get.onsuccess = () => resolve(!!get.result);
    };
    req.onerror = () => resolve(false);
  })), { timeout: 10_000 }).toBe(false);
});
