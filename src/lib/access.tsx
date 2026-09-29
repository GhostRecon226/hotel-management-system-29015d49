import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GrantLevel = "Y" | "L" | "O";

export interface PropertyAccess {
  id: string;
  name: string;
  code: string;
  business_date: string;
  base_currency: string;
  timezone: string;
  permissions: Record<string, GrantLevel>;
}

export interface MyContext {
  user_id: string;
  has_hotel: boolean;
  disabled: boolean;
  profile?: { full_name: string; phone: string | null };
  tenant?: { id: string; name: string; country: string; status: string };
  writable?: boolean;
  subscription?: {
    plan_code: string;
    plan_name: string;
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    trial_days_left: number | null;
  } | null;
  properties?: PropertyAccess[];
}

export const myContextQuery = queryOptions({
  queryKey: ["my-context"],
  queryFn: async (): Promise<MyContext> => {
    const { data, error } = await supabase.rpc("my_context");
    if (error) throw error;
    return data as unknown as MyContext;
  },
  staleTime: 60_000,
});

interface AccessValue {
  ctx: MyContext;
  property: PropertyAccess | null;
  setPropertyId: (id: string) => void;
  /** True if the user holds the permission (any level) on the current property. */
  can: (key: string) => boolean;
  canAny: (keys: string[]) => boolean;
  level: (key: string) => GrantLevel | null;
  writable: boolean;
}

const AccessContext = createContext<AccessValue | null>(null);
const STORAGE_KEY = "hotel.currentPropertyId";

export function AccessProvider({ ctx, children }: { ctx: MyContext; children: ReactNode }) {
  const properties = ctx.properties ?? [];
  const [propertyId, setPropertyIdState] = useState<string | null>(properties[0]?.id ?? null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && properties.some((p) => p.id === saved)) setPropertyIdState(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.user_id]);

  const setPropertyId = useCallback((id: string) => {
    setPropertyIdState(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const property = properties.find((p) => p.id === propertyId) ?? properties[0] ?? null;

  const value = useMemo<AccessValue>(() => {
    const perms = property?.permissions ?? {};
    return {
      ctx,
      property,
      setPropertyId,
      can: (k) => k in perms,
      canAny: (ks) => ks.some((k) => k in perms),
      level: (k) => perms[k] ?? null,
      writable: ctx.writable ?? false,
    };
  }, [ctx, property, setPropertyId]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const v = useContext(AccessContext);
  if (!v) throw new Error("useAccess must be used inside AccessProvider");
  return v;
}

/** Renders children only when the user holds one of the permissions on the current property. */
export function Can({ perm, children }: { perm: string | string[]; children: ReactNode }) {
  const { canAny } = useAccess();
  return canAny(Array.isArray(perm) ? perm : [perm]) ? <>{children}</> : null;
}

export function formatBusinessDate(d: string | undefined) {
  if (!d) return "";
  const [y = 1970, m = 1, day = 1] = d.split("-").map(Number);
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, day)));
}
