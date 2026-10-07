import { useQuery } from "@tanstack/react-query";
import { callRpc } from "@/lib/setup";

export interface GroupRow {
  id: string; name: string; contact_name: string | null; contact_phone: string | null; status: string;
  rooms: number; nights: number; first_arrival: string | null; last_departure: string | null;
  total_amount: number; currency: string;
}
export interface GroupDetail {
  group: { id: string; name: string; contact_name: string | null; contact_phone: string | null; status: string; notes?: string | null };
  reservations: {
    id: string; number: string; guest_name: string; arrival_date: string; departure_date: string; status: string;
    room_type_code: string; room_number: string | null; total_amount: number; currency: string; arrival_ready: boolean;
  }[];
  totals: { currency: string; rooms: number; nights: number; total_amount: number; deposit_required: number; balance_due: number | null };
}

export function useGroupList(propertyId: string | undefined, status: string) {
  return useQuery({
    queryKey: ["reservations", "group-list", propertyId, status],
    enabled: !!propertyId,
    queryFn: () => callRpc<GroupRow[]>("list_group_bookings", { p_property_id: propertyId, p_status: status === "all" ? null : status }),
  });
}

export function useGroupDetail(id: string) {
  return useQuery({
    queryKey: ["reservations", "group-detail", id],
    queryFn: () => callRpc<GroupDetail>("get_group_booking", { p_id: id }),
  });
}
