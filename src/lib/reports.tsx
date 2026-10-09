import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { callRpc } from "@/lib/setup";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface KpiRow {
  property_id: string; business_date: string; rooms_available: number; rooms_sold: number; room_revenue: number; total_revenue: number;
  arrivals: number; departures: number; no_shows: number; cancellations: number; occupancy: number | null; adr: number | null; revpar: number | null;
}
export interface DashboardSummary {
  business_date: string; arrivals: number; arrivals_pending: number; departures: number; departures_pending: number; in_house: number;
  vacant_clean: number; vacant_dirty: number; out_of_order: number; pending_approvals: number; open_tickets: number; urgent_tickets: number;
}

export interface ActivityRow { kind: string; title: string; detail: string; at: string; amount: number | null; currency: string | null }

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function formatPercent(v: number | null | undefined) {
  return v == null ? "—" : `${(Number(v) * 100).toFixed(1)}%`;
}

export function useDashboardSummary() {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["reports", "dashboard", property?.id],
    enabled: !!property,
    refetchInterval: 60_000,
    queryFn: () => callRpc<DashboardSummary>("dashboard_summary", { p_property_id: property!.id }),
  });
}

/** The newest things that happened at the hotel, limited by the database to what this person may see. */
export function useRecentActivity(enabled: boolean, limit = 6) {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["reports", "activity", property?.id, limit],
    enabled: !!property && enabled,
    refetchInterval: 60_000,
    retry: false,
    queryFn: () => callRpc<ActivityRow[]>("recent_activity", { p_property_id: property!.id, p_limit: limit }),
  });
}

export function useKpis(from: string, to: string, enabled = true) {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["reports", "kpi", property?.id, from, to],
    enabled: !!property && enabled && !!from && !!to,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("v_kpi_daily").select("*").eq("property_id", property!.id)
        .gte("business_date", from).lte("business_date", to).order("business_date");
      if (error) throw error;
      return data as KpiRow[];
    },
  });
}

export function useReport<T>(fn: string, args: Record<string, unknown>, enabled = true) {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["reports", fn, property?.id, args],
    enabled: !!property && enabled,
    queryFn: () => callRpc<T[]>(fn, { p_property_id: property!.id, ...args }),
  });
}

export function downloadCsv(filename: string, header: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const DEFINITIONS = [
  { term: "Rooms available", text: "Active rooms, minus rooms blocked as out of order or out of service that night." },
  { term: "Rooms sold", text: "Nights stayed by guests who checked in (in house or checked out)." },
  { term: "Occupancy", text: "Rooms sold ÷ rooms available." },
  { term: "ADR (average daily rate)", text: "Room revenue ÷ rooms sold." },
  { term: "RevPAR (revenue per available room)", text: "Room revenue ÷ rooms available." },
  { term: "Room revenue", text: "Room charges for the night, after discounts, reversals and adjustments, before tax." },
  { term: "Total revenue", text: "All charges except tax lines, after discounts, reversals and adjustments, before tax." },
];
