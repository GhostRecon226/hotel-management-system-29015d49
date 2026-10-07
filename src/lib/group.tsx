import { useQuery } from "@tanstack/react-query";
import { callRpc } from "@/lib/setup";

export type GroupBranch = {
  property_id: string; name: string; code: string; city: string | null; base_currency: string; business_date: string;
  rooms_total: number; rooms_occupied: number; occupancy: string | null; in_house: number;
  arrivals_pending: number; departures_pending: number; pending_approvals: number; open_tickets: number; urgent_tickets: number;
  last_night_date: string | null; last_night_revenue: string; last_night_occupancy: string | null;
};
export type GroupOverview = {
  properties: GroupBranch[];
  totals: {
    properties: number; rooms_total: number; rooms_occupied: number; occupancy: string | null; in_house: number;
    arrivals_pending: number; departures_pending: number; pending_approvals: number; open_tickets: number; urgent_tickets: number;
    revenue_by_currency: Record<string, string>;
  };
};

// Every figure comes from the database (group_overview). The screen only shows them.
export function useGroupOverview(enabled: boolean) {
  return useQuery({ queryKey: ["group-overview"], enabled, queryFn: () => callRpc<GroupOverview>("group_overview", {}) });
}
