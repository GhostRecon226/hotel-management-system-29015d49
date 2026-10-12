// Requirements: OFF-005, OFF-006, OFF-007, OFF-008
// Offline mode, stage 3a: a check-out and a room move entered with no connection wait on the device and send when the
// connection returns. A move the database refuses ends under "Needs attention", not lost. Local Supabase only.
import { test, expect, type Page } from "@playwright/test";
import { setUpRoomsAndRates, signInAndCreateHotel, toasts } from "./helpers";

type Entry = { name: string; args: Record<string, unknown>; status: string; error?: string };
async function queueEntries(page: Page) {
  return page.evaluate(() => new Promise<Entry[]>((resolve) => {
    const req = indexedDB.open("zikora-offline", 1);
    req.onsuccess = () => {
      const get = req.result.transaction("kv").objectStore("kv").get("queue");
      get.onsuccess = () => resolve((get.result as never) ?? []);
      get.onerror = () => resolve([]);
    };
    req.onerror = () => resolve([]);
  }));
}

/** A guest booked for two nights, checked in to room `roomIndex` (0 = first room). Uses the same functions as the screens. */
async function checkedInGuest(page: Page, first: string, roomIndex: number) {
  return page.evaluate(async ({ first, roomIndex }) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const call = async (fn: string, args: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn as never, args as never);
      if (error) throw new Error(`${fn}: ${error.message}`);
      return data as unknown;
    };
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const p = (ctx as { properties: { id: string; business_date: string }[] }).properties[0]!;
    const bd = p.business_date;
    const plus = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
    const { data: rt } = await supabase.from("room_types").select("id").eq("property_id", p.id).limit(1).single();
    const { data: rp } = await supabase.from("rate_plans").select("id").eq("property_id", p.id).limit(1).single();
    const { data: rooms } = await supabase.from("rooms").select("id").eq("property_id", p.id).order("room_number");
    const g = await call("save_guest", { p_id: null, p_first_name: first, p_last_name: "Guest", p_phone: null, p_email: null, p_nationality: "NG", p_address: null, p_notes: null });
    const res = await call("create_reservation", { p_property_id: p.id, p_idempotency_key: crypto.randomUUID(), p_guest_id: g, p_arrival: bd, p_departure: plus(bd, 2), p_room_type_id: rt!.id, p_rate_plan_id: rp!.id, p_adults: 1, p_children: 0, p_status: "confirmed", p_source: "direct", p_company_name: null, p_special_requests: null, p_notes: null, p_guarantee: "none", p_hold_until: null, p_group_id: null, p_rate_override: null, p_override_reason: null }) as string;
    await call("check_in", { p_id: res, p_registration: { id_type: "passport", id_number: "T1", nationality: "NG" }, p_room_id: rooms![roomIndex]!.id, p_room_override_reason: null, p_deposit_waive_reason: null });
    await call("open_main_folio", { p_reservation_id: res });
    return { res, rooms: rooms!.map((r) => r.id) };
  }, { first, roomIndex });
}

const reservationStatus = (page: Page, id: string) => page.evaluate(async (rid) => {
  const { supabase } = await import("/src/integrations/supabase/client.ts");
  const { data } = await supabase.from("reservations").select("status").eq("id", rid).single();
  return (data as { status: string }).status;
}, id);

test("offline: a check-out entered with no connection sends once when the connection returns", async ({ page, context }) => {
  await signInAndCreateHotel(page, "offout");
  await setUpRoomsAndRates(page);
  const g = await checkedInGuest(page, "Leaving", 0);

  await page.goto(`/checkout/${g.res}`);
  await expect(page.getByRole("heading", { name: /Check-out/ })).toBeVisible({ timeout: 15_000 });
  const plain = page.getByRole("button", { name: "Check out", exact: true });
  const withBalance = page.getByRole("button", { name: "Check out with balance" });
  await expect(plain.or(withBalance)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500); // the folio, balance and same-day night finish loading

  await context.setOffline(true);
  if (await withBalance.isVisible()) {
    await withBalance.click();
    const dialog = page.getByRole("dialog", { name: /Check out with a balance/ });
    await dialog.locator("#check_out-reason").fill("Guest left early");
    await dialog.getByRole("button", { name: "Save" }).click();
  } else {
    await plain.click();
  }
  await expect(toasts(page).filter({ hasText: "Saved on this device" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("status").filter({ hasText: "1 waiting to send" })).toBeVisible();
  await expect(page.getByText("Check-out is waiting to send")).toBeVisible();
  // The screen does not offer the check-out a second time while one waits.
  await expect(plain.or(withBalance)).toHaveCount(0);
  const queued = await queueEntries(page);
  expect(queued.map((q) => q.name)).toEqual(["check_out"]);
  expect(queued[0]!.args["p_reason"], "a reason is recorded for a check-out entered offline").toBeTruthy();
  expect(await reservationStatus(page, g.res).catch(() => "unreachable")).not.toBe("checked_out");

  await context.setOffline(false);
  await expect.poll(async () => (await queueEntries(page)).length, { timeout: 30_000 }).toBe(0);
  await expect.poll(() => reservationStatus(page, g.res), { timeout: 15_000 }).toBe("checked_out");
  await expect(page.getByRole("status").filter({ hasText: "waiting to send" })).toBeHidden({ timeout: 15_000 });
});

test("offline: a room move entered with no connection sends when the connection returns, and a refused move needs attention", async ({ page, context }) => {
  await signInAndCreateHotel(page, "offmove");
  await setUpRoomsAndRates(page);
  const a = await checkedInGuest(page, "Mover", 0);
  const b = await checkedInGuest(page, "Stayer", 1);
  await page.goto("/front-desk");
  await expect(page.getByRole("heading", { name: /Front Desk/ }).first()).toBeVisible({ timeout: 15_000 });

  const send = (args: Record<string, unknown>) => page.evaluate(async (a2) => {
    const q = await import("/src/lib/offline/queue.ts");
    return (await q.callRpcQueued("move_room", a2)) === q.QUEUED ? "queued" : "sent";
  }, args);

  // Room 2 is taken by the other guest: the database refuses this move when it is sent.
  await context.setOffline(true);
  expect(await send({ p_id: a.res, p_room_id: a.rooms[1], p_reason: "Guest asked", p_room_override_reason: null, p_keep_rate: null })).toBe("queued");
  await expect(page.getByRole("status").filter({ hasText: "1 waiting to send" })).toBeVisible();
  await context.setOffline(false);
  await expect.poll(async () => (await queueEntries(page)).map((e) => e.status), { timeout: 30_000 }).toEqual(["failed"]);
  await expect(page.getByRole("status").filter({ hasText: "1 need attention" })).toBeVisible();
  expect((await queueEntries(page))[0]!.error, "the refusal is kept in plain words").toBeTruthy();
  // Remove the refused entry through the screen, as staff would.
  await page.getByRole("status").getByRole("button", { name: "View" }).click();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect.poll(async () => (await queueEntries(page)).length).toBe(0);
  await page.keyboard.press("Escape");

  // A free room: the move waits offline, then goes through. Room 2's guest checks out first (online), freeing it.
  await page.evaluate(async (rid) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { error } = await supabase.rpc("check_out" as never, { p_id: rid, p_reason: "test" } as never);
    if (error) throw new Error(error.message);
  }, b.res);
  await context.setOffline(true);
  expect(await send({ p_id: a.res, p_room_id: a.rooms[1], p_reason: "Guest asked", p_room_override_reason: "Room not cleaned yet", p_keep_rate: null })).toBe("queued");
  await context.setOffline(false);
  await expect.poll(async () => (await queueEntries(page)).length, { timeout: 30_000 }).toBe(0);
  const room = await page.evaluate(async (rid) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { data } = await supabase.from("v_in_house").select("room_id").eq("reservation_id", rid).single();
    return (data as { room_id: string }).room_id;
  }, a.res);
  expect(room).toBe(a.rooms[1]);
});

// ---- Stage 3b: check-in. The guest's ID number waits on the device only until the entry is sent (OFF-007, OFF-008).
const SECRET = "SECRET-ID-4471";

/** Everything saved on this device, as one string, to look for the ID number. */
const deviceText = (page: Page) => page.evaluate(() => new Promise<string>((resolve) => {
  const req = indexedDB.open("zikora-offline", 1);
  req.onsuccess = () => {
    const out: string[] = [];
    const cur = req.result.transaction("kv").objectStore("kv").openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) { out.push(JSON.stringify(c.value)); c.continue(); } else resolve(out.join("\n"));
    };
    cur.onerror = () => resolve(out.join("\n"));
  };
  req.onerror = () => resolve("");
}));

async function bookedGuest(page: Page, first: string) {
  return page.evaluate(async (first) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const call = async (fn: string, args: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn as never, args as never);
      if (error) throw new Error(`${fn}: ${error.message}`);
      return data as unknown;
    };
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const p = (ctx as { properties: { id: string; business_date: string }[] }).properties[0]!;
    const bd = p.business_date;
    const plus = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
    const { data: rt } = await supabase.from("room_types").select("id").eq("property_id", p.id).limit(1).single();
    const { data: rp } = await supabase.from("rate_plans").select("id").eq("property_id", p.id).limit(1).single();
    const { data: rooms } = await supabase.from("rooms").select("id").eq("property_id", p.id).order("room_number");
    const g = await call("save_guest", { p_id: null, p_first_name: first, p_last_name: "Guest", p_phone: null, p_email: null, p_nationality: "NG", p_address: null, p_notes: null });
    const res = await call("create_reservation", { p_property_id: p.id, p_idempotency_key: crypto.randomUUID(), p_guest_id: g, p_arrival: bd, p_departure: plus(bd, 2), p_room_type_id: rt!.id, p_rate_plan_id: rp!.id, p_adults: 1, p_children: 0, p_status: "confirmed", p_source: "direct", p_company_name: null, p_special_requests: null, p_notes: null, p_guarantee: "none", p_hold_until: null, p_group_id: null, p_rate_override: null, p_override_reason: null }) as string;
    return { res, rooms: rooms!.map((r) => r.id) };
  }, first);
}

const checkInArgs = (res: string, room: string) => ({
  p_id: res, p_registration: { id_type: "passport", id_number: SECRET, id_expiry: "2031-01-01", nationality: "NG", registration_accepted: true },
  p_room_id: room, p_room_override_reason: null, p_deposit_waive_reason: null,
});
const queueCheckIn = (page: Page, args: Record<string, unknown>) => page.evaluate(async (a) => {
  const q = await import("/src/lib/offline/queue.ts");
  return (await q.callRpcQueued("check_in", a)) === q.QUEUED ? "queued" : "sent";
}, args);

test("offline: a check-in entered with no connection sends once, and the ID number leaves the device", async ({ page, context }) => {
  await signInAndCreateHotel(page, "offin");
  await setUpRoomsAndRates(page);
  const g = await bookedGuest(page, "Arriving");

  await context.setOffline(true);
  expect(await queueCheckIn(page, checkInArgs(g.res, g.rooms[0]!))).toBe("queued");
  await expect(page.getByRole("status").filter({ hasText: "1 waiting to send" })).toBeVisible();
  expect(await deviceText(page), "the number waits on the device until it is sent").toContain(SECRET);

  await context.setOffline(false);
  await expect.poll(async () => (await queueEntries(page)).length, { timeout: 30_000 }).toBe(0);
  await expect.poll(() => reservationStatus(page, g.res), { timeout: 15_000 }).toBe("checked_in");
  expect(await deviceText(page), "once sent, the number is gone from the device").not.toContain(SECRET);
});

test("offline: a refused check-in is kept for attention with its ID number erased", async ({ page, context }) => {
  await signInAndCreateHotel(page, "offinfail");
  await setUpRoomsAndRates(page);
  const taken = await checkedInGuest(page, "Occupant", 0);
  const g = await bookedGuest(page, "Refused");

  // Room 1 is occupied, so the database refuses this check-in when it is sent.
  await context.setOffline(true);
  expect(await queueCheckIn(page, checkInArgs(g.res, taken.rooms[0]!))).toBe("queued");
  await context.setOffline(false);
  await expect.poll(async () => (await queueEntries(page)).map((e) => e.status), { timeout: 30_000 }).toEqual(["failed"]);
  expect((await queueEntries(page))[0]!.error, "the refusal is kept in plain words").toBeTruthy();
  expect(await deviceText(page), "a refused check-in does not keep the ID number").not.toContain(SECRET);
  await page.getByRole("status").getByRole("button", { name: "View" }).click();
  await expect(page.getByText("ID number was erased")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  await page.getByRole("button", { name: "Remove" }).click();
  await expect.poll(async () => (await queueEntries(page)).length).toBe(0);
  expect(await reservationStatus(page, g.res)).toBe("confirmed");
});
