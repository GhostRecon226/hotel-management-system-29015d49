// While online, keep the open folios and the charge and payment lists ready for offline use.
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* eslint-disable @typescript-eslint/no-explicit-any */

let lastWarm = 0;

/** Loads open folios (and the lists the charge and payment forms need) into the cache. At most once every ten minutes. */
export async function warmOfflineData(queryClient: QueryClient, propertyId: string, businessDate?: string) {
  if (Date.now() - lastWarm < 10 * 60_000) return;
  lastWarm = Date.now();
  try {
    for (const [table, order] of [["charge_codes", "code"], ["payment_methods", "code"], ["exchange_rates", "currency"]] as const) {
      await queryClient.prefetchQuery({
        queryKey: ["setup", table, propertyId],
        queryFn: async () => {
          const { data, error } = await (supabase.from as any)(table).select("*").eq("property_id", propertyId).order(order);
          if (error) throw error;
          return data;
        },
      });
    }
    const open = await queryClient.fetchQuery({
      queryKey: ["folios", "list", propertyId, "open"],
      queryFn: async () => {
        const { data, error } = await (supabase.from as any)("v_folio_balances").select("*").eq("property_id", propertyId).eq("status", "open").order("created_at", { ascending: false }).limit(200);
        if (error) throw error;
        return data as { folio_id: string }[];
      },
    });
    for (const f of open.slice(0, 40)) {
      queryClient.setQueryData(["folios", "one", f.folio_id], f);
      await queryClient.prefetchQuery({
        queryKey: ["folios", "tx", f.folio_id],
        queryFn: async () => {
          const { data, error } = await (supabase.from as any)("v_folio_transactions").select("*").eq("folio_id", f.folio_id).order("posted_at");
          if (error) throw error;
          return data;
        },
      });
    }
    await warmInHouse(queryClient, propertyId, businessDate);
    await warmArrivals(queryClient, propertyId, businessDate);
  } catch {
    lastWarm = 0; // try again next time
  }
}

/** Stage 3b: the room lists the Check in form reads, for today's arrivals (first 30). */
async function warmArrivals(queryClient: QueryClient, propertyId: string, businessDate?: string) {
  if (!businessDate) return;
  const { data: rows, error } = await (supabase.from as any)("v_arrivals").select("id, room_type_id, departure_date").eq("property_id", propertyId).limit(30);
  if (error || !rows) return;
  for (const r of rows as { id: string; room_type_id: string; departure_date: string }[]) {
    if (r.departure_date < businessDate) continue;
    await queryClient.prefetchQuery({
      queryKey: ["reservations", "fd", "rooms", propertyId, r.room_type_id, businessDate, r.departure_date, r.id],
      queryFn: async () => {
        const { data, error: e } = await (supabase.rpc as any)("get_front_desk_rooms", {
          p_property_id: propertyId, p_room_type_id: r.room_type_id, p_from: businessDate, p_to: r.departure_date, p_reservation_id: r.id,
        });
        if (e) throw e;
        return data;
      },
    });
  }
}

/** Stage 3: for each guest in house (first 30), keep what the check-out page and the Move room form need. */
async function warmInHouse(queryClient: QueryClient, propertyId: string, businessDate?: string) {
  const { data: rows, error } = await (supabase.from as any)("v_in_house").select("reservation_id, departure_date").eq("property_id", propertyId).limit(30);
  if (error || !rows) return;
  for (const r of rows as { reservation_id: string; departure_date: string }[]) {
    const id = r.reservation_id;
    const q = (queryKey: unknown[], queryFn: () => Promise<unknown>) => queryClient.prefetchQuery({ queryKey, queryFn });
    await q(["checkout", "stay", id], async () => {
      const { data, error: e } = await (supabase.from as any)("v_checkouts").select("*").eq("reservation_id", id).order("checked_out_at", { ascending: false, nullsFirst: true }).limit(1).maybeSingle();
      if (e) throw e;
      return data;
    });
    await q(["folios", "res", id], async () => {
      const { data, error: e } = await (supabase.from as any)("v_folio_balances").select("*").eq("reservation_id", id).order("created_at");
      if (e) throw e;
      return data;
    });
    await q(["folios", "outstanding", id], async () => {
      const { data, error: e } = await (supabase.rpc as any)("checkout_outstanding", { p_reservation_id: id });
      if (e) throw e;
      return data;
    });
    await q(["folios", "same-day-night", id], async () => {
      const { data, error: e } = await (supabase.rpc as any)("preview_check_out_charge", { p_id: id });
      if (e) throw e;
      return data;
    });
    if (businessDate && r.departure_date >= businessDate) {
      await q(["reservations", "fd", "rooms", propertyId, null, businessDate, r.departure_date, id], async () => {
        const { data, error: e } = await (supabase.rpc as any)("get_front_desk_rooms", {
          p_property_id: propertyId, p_room_type_id: null, p_from: businessDate, p_to: r.departure_date, p_reservation_id: id,
        });
        if (e) throw e;
        return data;
      });
    }
  }
}
