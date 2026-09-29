import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { callRpc } from "@/lib/setup";
import { errorMessage } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";

export const RES_STATUS: Record<string, string> = {
  tentative: "Tentative", confirmed: "Confirmed", cancelled: "Cancelled", no_show: "No-show",
  checked_in: "In house", checked_out: "Checked out",
};
const STATUS_TONE: Record<string, "warning" | "success" | "neutral" | "danger" | "info"> = {
  tentative: "warning", confirmed: "success", cancelled: "neutral", no_show: "danger", checked_in: "info", checked_out: "neutral",
};
export const SOURCES: Record<string, string> = {
  direct: "Direct", walk_in: "Walk-in", phone: "Phone", corporate: "Corporate", other: "Other",
};
export const GUARANTEES: Record<string, string> = {
  none: "None", card: "Card", deposit: "Deposit", company: "Company pays", other: "Other",
};

export function ResStatusBadge({ status, holdUntil }: { status: string; holdUntil?: string | null }) {
  const expired = status === "tentative" && holdUntil && new Date(holdUntil) <= new Date();
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={STATUS_TONE[status] ?? "neutral"} dot>{RES_STATUS[status] ?? status}</Badge>
      {expired && <Badge variant="danger">Hold expired</Badge>}
    </span>
  );
}

export interface ResRow {
  id: string; number: string; guest_id: string; guest_name: string; arrival_date: string; departure_date: string;
  room_type_code: string; room_number: string | null; status: string; source: string; company_name: string | null;
  hold_until: string | null; total_amount: number; currency: string; adults: number; children: number;
}

export interface Reservation {
  id: string; property_id: string; number: string; guest_id: string; arrival_date: string; departure_date: string;
  room_type_id: string; rate_plan_id: string; adults: number; children: number; status: string; source: string;
  company_name: string | null; special_requests: string | null; notes: string | null; guarantee: string;
  hold_until: string | null; group_id: string | null; currency: string; total_amount: number; deposit_required: number;
  rate_override: number | null; override_reason: string | null; cancellation_fee: number | null; no_show_fee: number | null;
  fee_waived: boolean; status_reason: string | null; created_at: string;
}
export interface HistoryEvent {
  id: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null;
  reason: string | null; created_at: string; actor: string | null;
}
export interface ReservationDetail {
  reservation: Reservation;
  room_type: { id: string; code: string; name: string; max_adults: number; max_children: number };
  rate_plan: { id: string; code: string; name: string; cancellation_policy_type: string; cancellation_policy_value: number;
    no_show_policy_type: string; no_show_policy_value: number; deposit_policy_type: string; deposit_policy_value: number };
  group: { id: string; name: string } | null;
  room: { id: string; room_number: string; condition: string } | null;
  guests: { id: string; first_name: string; last_name: string; phone: string | null; email: string | null; is_primary: boolean }[];
  nights: { stay_date: string; rate_amount: number; room_id: string | null }[];
  history: HistoryEvent[];
}

export interface AvailabilityCell {
  room_type_id: string; room_type_code: string; room_type_name: string; stay_date: string;
  sellable: number; reserved: number; available: number;
}

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(iso: string, n: number) {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}
export function nightsBetween(a: string, b: string) {
  if (!a || !b) return 0;
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}
export function formatDay(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "";
  const [y = 1970, m = 1, d = 1] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-NG", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}
export function formatDateTime(ts: string | null | undefined) {
  return ts ? new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ts)) : "";
}

export function useReservationSearch(propertyId: string | undefined, f: { q: string; status: string; from: string; to: string }) {
  const [q, setQ] = useState(f.q);
  useEffect(() => { const t = setTimeout(() => setQ(f.q), 250); return () => clearTimeout(t); }, [f.q]);
  return useQuery({
    queryKey: ["reservations", "search", propertyId, q, f.status, f.from, f.to],
    enabled: !!propertyId,
    queryFn: () => callRpc<ResRow[]>("search_reservations", {
      p_property_id: propertyId, p_query: q, p_status: f.status === "all" ? null : f.status,
      p_from: f.from || null, p_to: f.to || null, p_limit: 200,
    }),
  });
}

export function useReservation(id: string) {
  return useQuery({ queryKey: ["reservations", "detail", id], queryFn: () => callRpc<ReservationDetail>("get_reservation", { p_id: id }) });
}

export function useAvailability(propertyId: string | undefined, arrival: string, departure: string) {
  return useQuery({
    queryKey: ["reservations", "availability", propertyId, arrival, departure],
    enabled: !!propertyId && !!arrival && !!departure && departure > arrival,
    queryFn: () => callRpc<AvailabilityCell[]>("get_availability", { p_property_id: propertyId, p_arrival: arrival, p_departure: departure }),
  });
}

export function useResMutation<T = unknown>(name: string, success?: string | ((d: T) => string)) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) => callRpc<T>(name, args),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["guests"] });
      if (success) toast.success(typeof success === "function" ? success(d) : success);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

const ACTION_LABEL: Record<string, string> = {
  insert: "Booking created", update: "Booking changed", assign_room: "Room assigned", unassign_room: "Room removed",
  set_reservation_guests: "Guests changed", check_in: "Checked in", void_check_in: "Check-in voided", move_room: "Room moved", waive_cancellation_fee: "Cancellation fee waived", waive_no_show_fee: "No-show fee waived",
};
const FIELD_LABEL: Record<string, string> = {
  arrival_date: "Arrival", departure_date: "Departure", room_type_id: "Room type", rate_plan_id: "Rate plan",
  adults: "Adults", children: "Children", status: "Status", source: "Source", company_name: "Company",
  special_requests: "Special requests", notes: "Notes", guarantee: "Guarantee", hold_until: "Hold until",
  group_id: "Group", rate_override: "Rate override", total_amount: "Total", deposit_required: "Deposit required",
  guest_id: "Main guest", cancellation_fee: "Cancellation fee", no_show_fee: "No-show fee", fee_waived: "Fee waived",
};

export function describeEvent(e: HistoryEvent): { title: string; changes: string[] } {
  let title = ACTION_LABEL[e.action] ?? e.action;
  const changes: string[] = [];
  if (e.action === "update" && e.before && e.after) {
    const b = e.before, a = e.after;
    if (b["status"] !== a["status"]) title = `Status: ${RES_STATUS[String(b["status"])] ?? String(b["status"])} → ${RES_STATUS[String(a["status"])] ?? String(a["status"])}`;
    for (const k of Object.keys(FIELD_LABEL)) {
      if (k === "status" || k.endsWith("_id") && k !== "guest_id") {
        if (k.endsWith("_id") && JSON.stringify(b[k]) !== JSON.stringify(a[k])) changes.push(`${FIELD_LABEL[k]} changed`);
        continue;
      }
      if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) {
        const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
        changes.push(`${FIELD_LABEL[k]}: ${fmt(b[k])} → ${fmt(a[k])}`);
      }
    }
  }
  if (e.action === "assign_room" && e.after?.["room_number"]) title = `Room ${String(e.after["room_number"])} assigned`;
  return { title, changes };
}
