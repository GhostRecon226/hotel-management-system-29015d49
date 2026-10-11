// While online, keep the open folios and the charge and payment lists ready for offline use.
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* eslint-disable @typescript-eslint/no-explicit-any */

let lastWarm = 0;

/** Loads open folios (and the lists the charge and payment forms need) into the cache. At most once every ten minutes. */
export async function warmOfflineData(queryClient: QueryClient, propertyId: string) {
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
  } catch {
    lastWarm = 0; // try again next time
  }
}
