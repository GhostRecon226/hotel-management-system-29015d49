import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { Field, useSetupList } from "@/lib/setup";
import { fullName, GuestFormDialog, useGuestSearch } from "@/lib/guests";
import {
  addDays, GUARANTEES, nightsBetween, SOURCES, useAvailability, useResMutation, formatDay, type Reservation,
} from "@/lib/reservations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RoomType { id: string; code: string; name: string; max_adults: number; max_children: number; is_active: boolean }
interface RatePlan { id: string; code: string; name: string; is_active: boolean }
interface Group { id: string; name: string; status: string }

export interface ResFormValues {
  guest_id: string; guest_label: string; arrival: string; departure: string; room_type_id: string; rate_plan_id: string;
  adults: string; children: string; status: "tentative" | "confirmed"; hold_until: string; source: string; company_name: string;
  guarantee: string; group_id: string; special_requests: string; notes: string; override: boolean; rate_override: string; override_reason: string;
}

export function emptyForm(businessDate: string): ResFormValues {
  return {
    guest_id: "", guest_label: "", arrival: businessDate, departure: addDays(businessDate, 1), room_type_id: "", rate_plan_id: "",
    adults: "1", children: "0", status: "confirmed", hold_until: "", source: "direct", company_name: "", guarantee: "none",
    group_id: "none", special_requests: "", notes: "", override: false, rate_override: "", override_reason: "",
  };
}

export function formFromReservation(r: Reservation, guestLabel: string): ResFormValues {
  return {
    guest_id: r.guest_id, guest_label: guestLabel, arrival: r.arrival_date, departure: r.departure_date,
    room_type_id: r.room_type_id, rate_plan_id: r.rate_plan_id, adults: String(r.adults), children: String(r.children),
    status: r.status === "tentative" ? "tentative" : "confirmed",
    hold_until: r.hold_until ? toLocalInput(r.hold_until) : "", source: r.source, company_name: r.company_name ?? "",
    guarantee: r.guarantee, group_id: r.group_id ?? "none", special_requests: r.special_requests ?? "", notes: r.notes ?? "",
    override: r.rate_override !== null, rate_override: r.rate_override !== null ? String(r.rate_override) : "", override_reason: r.override_reason ?? "",
  };
}

function toLocalInput(ts: string) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function GuestPicker({ value, label, onPick, disabled }: { value: string; label: string; onPick: (id: string, label: string) => void; disabled?: boolean }) {
  const { can } = useAccess();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data = [], isFetching } = useGuestSearch(q, 8);
  if (value) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border px-3 py-2">
        <span className="font-medium">{label}</span>
        {!disabled && <Button type="button" size="sm" variant="outline" onClick={() => onPick("", "")}>Change</Button>}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input id="guest" placeholder="Search guests by name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
        {can("guest.create") && <Button type="button" variant="outline" onClick={() => setOpen(true)}>New guest</Button>}
      </div>
      {q.trim() && (
        <div className="max-h-56 overflow-y-auto rounded-md border">
          {data.length === 0 && <p className="p-3 text-sm text-muted-foreground">{isFetching ? "Searching…" : "No guests found."}</p>}
          {data.map((g) => (
            <button type="button" key={g.id} onClick={() => onPick(g.id, fullName(g))}
              className="flex min-h-11 w-full items-center justify-between gap-2 border-b px-3 py-2 text-left last:border-0 hover:bg-muted">
              <span className="font-medium">{fullName(g)}</span>
              <span className="text-sm text-muted-foreground">{g.phone ?? g.email ?? ""}</span>
            </button>
          ))}
        </div>
      )}
      <GuestFormDialog open={open} onOpenChange={setOpen} onSaved={(id, name) => onPick(id, name)} />
    </div>
  );
}

export function ReservationForm({ initial, mode, reservationId, onDone, onCancel }: {
  initial: ResFormValues; mode: "create" | "edit"; reservationId?: string;
  onDone: (id: string) => void; onCancel: () => void;
}) {
  const { property, can } = useAccess();
  const qc = useQueryClient();
  const [f, setF] = useState(initial);
  const [key] = useState(() => crypto.randomUUID());
  const [newGroup, setNewGroup] = useState("");
  const set = <K extends keyof ResFormValues>(k: K, v: ResFormValues[K]) => setF((x) => ({ ...x, [k]: v }));

  const roomTypes = useSetupList<RoomType>("room_types", "code");
  const ratePlans = useSetupList<RatePlan>("rate_plans", "code");
  const groups = useQuery({
    queryKey: ["reservations", "groups", property?.id],
    enabled: !!property,
    queryFn: async () => {
      const { data, error } = await supabase.from("group_bookings").select("id, name, status").eq("property_id", property!.id).order("name");
      if (error) throw error;
      return data as Group[];
    },
  });
  const avail = useAvailability(property?.id, f.arrival, f.departure);
  const create = useResMutation<string>("create_reservation", "Booking created.");
  const modify = useResMutation("modify_reservation", "Booking updated.");
  const saveGroup = useResMutation<string>("save_group_booking", "Group created.");

  const nights = nightsBetween(f.arrival, f.departure);
  const rt = roomTypes.data?.find((r) => r.id === f.room_type_id);
  const minFree = useMemo(() => {
    if (!avail.data || !f.room_type_id) return null;
    const cells = avail.data.filter((c) => c.room_type_id === f.room_type_id);
    return cells.length ? Math.min(...cells.map((c) => c.available)) : null;
  }, [avail.data, f.room_type_id]);
  const canOverride = can("res.rate.override");
  const busy = create.isPending || modify.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const common = {
      p_arrival: f.arrival, p_departure: f.departure, p_room_type_id: f.room_type_id || null, p_rate_plan_id: f.rate_plan_id || null,
      p_adults: Number(f.adults), p_children: Number(f.children || 0), p_source: f.source, p_company_name: f.company_name,
      p_special_requests: f.special_requests, p_notes: f.notes, p_guarantee: f.guarantee,
      p_hold_until: f.status === "tentative" && f.hold_until ? new Date(f.hold_until).toISOString() : null,
      p_group_id: f.group_id === "none" ? null : f.group_id,
      p_rate_override: f.override && f.rate_override !== "" ? f.rate_override : null,
      p_override_reason: f.override ? f.override_reason : null,
    };
    if (mode === "create") {
      create.mutate({ ...common, p_property_id: property!.id, p_idempotency_key: key, p_guest_id: f.guest_id || null, p_status: f.status },
        { onSuccess: (id) => onDone(id) });
    } else {
      modify.mutate({ ...common, p_id: reservationId }, { onSuccess: () => onDone(reservationId!) });
    }
  };

  const addGroup = () => saveGroup.mutate(
    { p_property_id: property!.id, p_id: null, p_name: newGroup, p_contact_name: null, p_contact_phone: null, p_notes: null },
    { onSuccess: (id) => { setNewGroup(""); set("group_id", id); qc.invalidateQueries({ queryKey: ["reservations", "groups"] }); } },
  );

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Guest and stay</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {mode === "create" && (
              <Field label="Main guest" htmlFor="guest">
                <GuestPicker value={f.guest_id} label={f.guest_label} onPick={(id, l) => setF((x) => ({ ...x, guest_id: id, guest_label: l }))} />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Arrival" htmlFor="arrival"><Input id="arrival" type="date" required value={f.arrival}
                onChange={(e) => { const v = e.target.value; setF((x) => ({ ...x, arrival: v, departure: x.departure < v ? addDays(v, 1) : x.departure })); }} /></Field>
              <Field label="Departure" htmlFor="departure"><Input id="departure" type="date" required min={f.arrival || undefined}
                value={f.departure} onChange={(e) => set("departure", e.target.value)} /></Field>
              <Field label="Nights" htmlFor="nights"><Input id="nights" readOnly value={nights > 0 ? nights : nights === 0 && f.arrival ? "Same day (1 night charged)" : "—"} className="bg-muted" /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Room type" htmlFor="room_type">
                <Select value={f.room_type_id} onValueChange={(v) => set("room_type_id", v)}>
                  <SelectTrigger id="room_type"><SelectValue placeholder="Choose a room type" /></SelectTrigger>
                  <SelectContent>{(roomTypes.data ?? []).filter((r) => r.is_active).map((r) => <SelectItem key={r.id} value={r.id}>{r.code} — {r.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Rate plan" htmlFor="rate_plan">
                <Select value={f.rate_plan_id} onValueChange={(v) => set("rate_plan_id", v)}>
                  <SelectTrigger id="rate_plan"><SelectValue placeholder="Choose a rate plan" /></SelectTrigger>
                  <SelectContent>{(ratePlans.data ?? []).filter((r) => r.is_active).map((r) => <SelectItem key={r.id} value={r.id}>{r.code} — {r.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Adults" htmlFor="adults" {...(rt ? { hint: `Up to ${rt.max_adults}` } : {})}>
                <Input id="adults" type="number" min={1} max={rt?.max_adults} required value={f.adults} onChange={(e) => set("adults", e.target.value)} /></Field>
              <Field label="Children" htmlFor="children" {...(rt ? { hint: `Up to ${rt.max_children}` } : {})}>
                <Input id="children" type="number" min={0} max={rt?.max_children} value={f.children} onChange={(e) => set("children", e.target.value)} /></Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Booking details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {mode === "create" && (
                <Field label="Status" htmlFor="status">
                  <Select value={f.status} onValueChange={(v) => set("status", v as ResFormValues["status"])}>
                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="confirmed">Confirmed</SelectItem><SelectItem value="tentative">Tentative (held)</SelectItem></SelectContent>
                  </Select>
                </Field>
              )}
              {f.status === "tentative" && (
                <Field label="Hold until" htmlFor="hold" hint="Leave empty to use the property's default hold time.">
                  <Input id="hold" type="datetime-local" value={f.hold_until} onChange={(e) => set("hold_until", e.target.value)} />
                </Field>
              )}
              <Field label="Source" htmlFor="source">
                <Select value={f.source} onValueChange={(v) => set("source", v)}>
                  <SelectTrigger id="source"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(SOURCES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Guarantee" htmlFor="guarantee">
                <Select value={f.guarantee} onValueChange={(v) => set("guarantee", v)}>
                  <SelectTrigger id="guarantee"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(GUARANTEES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Company" htmlFor="company"><Input id="company" value={f.company_name} onChange={(e) => set("company_name", e.target.value)} /></Field>
              <Field label="Group" htmlFor="group">
                <Select value={f.group_id} onValueChange={(v) => set("group_id", v)}>
                  <SelectTrigger id="group"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No group</SelectItem>
                    {(groups.data ?? []).filter((g) => g.status === "active" || g.id === f.group_id).map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {can("res.group.manage") && (
              <div className="flex gap-2">
                <Input placeholder="New group name" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} aria-label="New group name" />
                <Button type="button" variant="outline" disabled={!newGroup.trim() || saveGroup.isPending} onClick={addGroup}>Add group</Button>
              </div>
            )}
            <Field label="Special requests" htmlFor="requests"><Textarea id="requests" value={f.special_requests} onChange={(e) => set("special_requests", e.target.value)} /></Field>
            <Field label="Notes (staff only)" htmlFor="notes"><Textarea id="notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          </CardContent>
        </Card>

        {canOverride && (
          <Card>
            <CardHeader><CardTitle className="text-base">Rate override</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="flex min-h-11 items-center gap-3 text-[15px]">
                <input type="checkbox" className="size-6 shrink-0 accent-primary pointer-fine:size-5" checked={f.override} onChange={(e) => set("override", e.target.checked)} />
                Use a different nightly rate from the rate plan
              </label>
              {f.override && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nightly rate (₦)" htmlFor="override"><Input id="override" type="number" min={0} step="0.01" required value={f.rate_override} onChange={(e) => set("rate_override", e.target.value)} /></Field>
                  <Field label="Reason" htmlFor="override_reason"><Input id="override_reason" required value={f.override_reason} onChange={(e) => set("override_reason", e.target.value)} /></Field>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card className="lg:sticky lg:top-20">
          <CardHeader><CardTitle className="text-base">Availability</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-[15px]">
            {nights > 0 ? <p>{formatDay(f.arrival)} → {formatDay(f.departure)} · {nights} night{nights === 1 ? "" : "s"}</p> : <p className="text-destructive">Departure must be after arrival.</p>}
            {!f.room_type_id ? <p className="text-muted-foreground">Choose a room type to see free rooms.</p>
              : avail.isLoading ? <p className="text-muted-foreground">Checking…</p>
              : minFree === null ? null
              : minFree > 0 ? <Badge variant="success" dot>{minFree} free on every night</Badge>
              : <Badge variant="danger" dot>Full on at least one night</Badge>}
            <p className="text-sm text-muted-foreground">The price is taken from the rate plan when you save. The total and any deposit show on the booking.</p>
            <div className="flex flex-col gap-2 pt-2">
              <Button type="submit" disabled={busy || (mode === "create" && !f.guest_id)}>{busy ? "Saving…" : mode === "create" ? "Create booking" : "Save changes"}</Button>
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
