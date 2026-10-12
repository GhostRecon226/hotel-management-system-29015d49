import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { setLabelHint } from "@/lib/offline/queue";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { callRpc, Field, FormDialog, useSetupList } from "@/lib/setup";
import { DOC_TYPES } from "@/lib/guests";
import { addDays, formatDay, nightsBetween, nightsLabel, useResMutation } from "@/lib/reservations";
import { GuestPicker } from "@/components/reservation-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatAmount } from "@/components/ui/money";
import { sortByRoom } from "@/lib/room-label";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import { IdPhotoPicker, uploadIdPhoto, useGuestIdPhotos, useIdPhotoAccess, useIdPhotosChanged } from "@/lib/id-photos";

export interface ArrivalRow {
  id: string; number: string; guest_id: string; guest_name: string | null; guest_phone: string | null;
  arrival_date: string; departure_date: string; nights: number; adults: number; children: number;
  /** Deposit still to take, from the database (v_arrivals.deposit_due). */
  deposit_due: number;
  arrival_ready?: boolean;
  room_type_id: string; room_type_code: string; status: string; hold_until: string | null; company_name: string | null;
  special_requests: string | null; total_amount: number; currency: string; deposit_required: number; deposit_paid: number;
  room_id: string | null; room_number: string | null; room_condition: string | null; room_is_occupied: boolean | null;
  room_is_ready: boolean; is_late: boolean;
}
export interface InHouseRow {
  stay_id: string; reservation_id: string; number: string; guest_id: string; guest_name: string | null; guest_phone: string | null;
  room_id: string; room_number: string; room_type_id: string; room_type_code: string; arrival_date: string; departure_date: string;
  checked_in_at: string; adults: number; children: number; company_name: string | null; total_amount: number; currency: string;
  is_departing: boolean; can_void: boolean;
}
interface FdRoom { id: string; room_number: string; floor: string | null; room_type_id: string; room_type_code: string; condition: string; is_occupied: boolean; is_ready: boolean }

export function useArrivals(propertyId?: string) {
  return useQuery({
    queryKey: ["reservations", "fd", "arrivals", propertyId], enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("v_arrivals").select("*").eq("property_id", propertyId).order("arrival_date").order("number");
      if (error) throw error;
      return data as ArrivalRow[];
    },
  });
}
export function useInHouse(propertyId?: string) {
  return useQuery({
    queryKey: ["reservations", "fd", "in-house", propertyId], enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("v_in_house").select("*").eq("property_id", propertyId);
      if (error) throw error;
      return sortByRoom(data as InHouseRow[]);
    },
  });
}

function useFdRooms(roomTypeId: string | null, from: string, to: string, reservationId: string | null, enabled: boolean) {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["reservations", "fd", "rooms", property?.id, roomTypeId, from, to, reservationId],
    enabled: enabled && !!property && !!from && !!to && to >= from,
    queryFn: () => callRpc<FdRoom[]>("get_front_desk_rooms", {
      p_property_id: property!.id, p_room_type_id: roomTypeId, p_from: from, p_to: to, p_reservation_id: reservationId,
    }),
  });
}

const CONDITION: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" }> = {
  clean: { label: "Clean", tone: "success" }, inspected: { label: "Inspected", tone: "success" },
  dirty: { label: "Dirty", tone: "warning" }, out_of_order: { label: "Out of order", tone: "danger" },
};
export function RoomStateBadge({ condition, occupied }: { condition: string | null; occupied?: boolean | null }) {
  if (!condition) return null;
  if (occupied) return <Badge variant="info" dot>Occupied</Badge>;
  const c = CONDITION[condition] ?? { label: condition, tone: "warning" as const };
  return <Badge variant={c.tone} dot>{c.label}</Badge>;
}

/** Room select: ready rooms always; rooms that are not ready only for users who can override. */
function RoomSelect({ rooms, value, onChange, loading }: { rooms: FdRoom[]; value: string; onChange: (id: string) => void; loading: boolean }) {
  const { can } = useAccess();
  const canOverride = can("fo.room.override");
  const shown = rooms.filter((r) => !r.is_occupied && (r.is_ready || canOverride));
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id="fd-room" aria-label="Room"><SelectValue placeholder={loading ? "Loading rooms…" : shown.length ? "Choose a room" : "No free rooms"} /></SelectTrigger>
      <SelectContent>
        {shown.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.room_number} · {r.room_type_code}{r.floor ? ` · Floor ${r.floor}` : ""}{r.is_ready ? " · Ready" : ` · ${CONDITION[r.condition]?.label ?? r.condition} (not ready)`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface Registration { id_type: string; id_number: string; id_expiry: string; nationality: string; address: string; vehicle_plate: string; accepted: boolean }
const EMPTY_REG: Registration = { id_type: "national_id", id_number: "", id_expiry: "", nationality: "", address: "", vehicle_plate: "", accepted: false };

/** The ID photo step of check-in and walk-in (SET-009). Shown only when the hotel allows ID photos. */
function usePhotoStep(guestId: string | null | undefined, open: boolean) {
  const { property } = useAccess();
  const access = useIdPhotoAccess();
  const existing = useGuestIdPhotos(guestId ?? undefined, open && access.canView);
  const changed = useIdPhotosChanged();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const hasPhoto = (existing.data?.length ?? 0) > 0;
  /** Uploads the chosen photo first. Returns false (and says why) if check-in should not go ahead. */
  const run = async (reg: Registration) => {
    if (!file) return true;
    if (!guestId) { toast.error("Choose the guest first."); return false; }
    setUploading(true);
    try {
      await uploadIdPhoto({ propertyId: property!.id, guestId, docType: reg.id_type, docNumber: reg.id_number,
        expiry: reg.id_expiry || null, side: "front", file });
      changed();
      return true;
    } catch (e) { toast.error(errorMessage(e)); return false; }
    finally { setUploading(false); }
  };
  return { show: access.canUpload, required: access.required && !hasPhoto, hasPhoto, file, setFile, uploading, run, reset: () => setFile(null) };
}
type PhotoStep = ReturnType<typeof usePhotoStep>;

function RegistrationFields({ reg, setReg, photo }: { reg: Registration; setReg: (r: Registration) => void; photo?: PhotoStep }) {
  const set = (k: keyof Registration) => (e: { target: { value: string } }) => setReg({ ...reg, [k]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="ID type" htmlFor="reg-type">
        <Select value={reg.id_type} onValueChange={(v) => setReg({ ...reg, id_type: v })}>
          <SelectTrigger id="reg-type"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(DOC_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="ID number" htmlFor="reg-num"><Input id="reg-num" value={reg.id_number} onChange={set("id_number")} required maxLength={50} autoComplete="off" /></Field>
      <Field label="ID expiry" htmlFor="reg-exp" hint="Optional."><Input id="reg-exp" type="date" value={reg.id_expiry} onChange={set("id_expiry")} /></Field>
      {photo?.show && (
        <div className="sm:col-span-2">
          {photo.hasPhoto && !photo.file
            ? <p className="text-sm text-muted-foreground">An ID photo is already on file for this guest. Add a new one only if it has changed.</p> : null}
          <IdPhotoPicker id="reg-photo" label={photo.required ? "ID photo (required by this hotel)" : "ID photo"} file={photo.file} onFile={photo.setFile} required={photo.required} />
        </div>
      )}
      <Field label="Nationality" htmlFor="reg-nat"><Input id="reg-nat" placeholder="Nigerian" value={reg.nationality} onChange={set("nationality")} maxLength={60} /></Field>
      <Field label="Vehicle plate" htmlFor="reg-plate" hint="Leave empty if none."><Input id="reg-plate" value={reg.vehicle_plate} onChange={set("vehicle_plate")} maxLength={20} /></Field>
      <div className="sm:col-span-2">
        <Field label="Address" htmlFor="reg-addr"><Textarea id="reg-addr" rows={2} value={reg.address} onChange={set("address")} maxLength={500} /></Field>
      </div>
      {/* FO-003: required before check-in. A drawn signature comes later. */}
      <label htmlFor="reg-accept" className="flex items-start gap-3 text-[15px] sm:col-span-2">
        <Checkbox id="reg-accept" className="mt-0.5" checked={reg.accepted} onCheckedChange={(v) => setReg({ ...reg, accepted: v === true })} />
        <span>Guest has read and signed the registration card</span>
      </label>
    </div>
  );
}

function OverrideReason({ show, value, onChange }: { show: boolean; value: string; onChange: (v: string) => void }) {
  if (!show) return null;
  return (
    <Field label="Reason for using a room that is not ready" htmlFor="fd-ovr">
      <Input id="fd-ovr" value={value} onChange={(e) => onChange(e.target.value)} required maxLength={300} />
    </Field>
  );
}

function DepositBlock({ due, currency, value, onChange }: { due: number; currency: string; value: string; onChange: (v: string) => void }) {
  const { can } = useAccess();
  if (due <= 0) return null;
  return (
    <Alert>
      <AlertDescription className="space-y-3">
        <p>A deposit of <strong>{formatAmount(due, currency)}</strong> is required before check-in. Record the deposit as a payment on the folio, then check in.</p>
        {can("fo.deposit.waive")
          ? <Field label="Reason for waiving the deposit" htmlFor="fd-waive"><Input id="fd-waive" value={value} onChange={(e) => onChange(e.target.value)} maxLength={300} /></Field>
          : <p className="text-sm">Ask a manager to waive the deposit.</p>}
      </AlertDescription>
    </Alert>
  );
}

const regArgs = (r: Registration) => ({ id_type: r.id_type, id_number: r.id_number, id_expiry: r.id_expiry || null, nationality: r.nationality, address: r.address, vehicle_plate: r.vehicle_plate, registration_accepted: r.accepted });

export function CheckInDialog({ arrival, onOpenChange }: { arrival: ArrivalRow | null; onOpenChange: (o: boolean) => void }) {
  const { property } = useAccess();
  const [reg, setReg] = useState(EMPTY_REG);
  const [room, setRoom] = useState("");
  const [ovr, setOvr] = useState("");
  const [waive, setWaive] = useState("");
  const open = !!arrival;
  const rooms = useFdRooms(arrival?.room_type_id ?? null, property?.business_date ?? "", arrival?.departure_date ?? "", arrival?.id ?? null, open);
  const m = useResMutation("check_in", "Guest checked in.");
  const photo = usePhotoStep(arrival?.guest_id, open);
  useEffect(() => { if (arrival) { setReg(EMPTY_REG); setRoom(arrival.room_id ?? ""); setOvr(""); setWaive(""); photo.reset(); } }, [arrival]); // eslint-disable-line react-hooks/exhaustive-deps
  const picked = rooms.data?.find((r) => r.id === room);
  const notReady = !!picked && !picked.is_ready;
  // Deposit still to take, from the database (v_arrivals.deposit_due).
  const due = arrival ? Number(arrival.deposit_due) : 0;

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`Check in ${arrival?.guest_name ?? ""}`} busy={m.isPending || photo.uploading} submitDisabled={!reg.accepted}
      onSubmit={async () => {
        if (!(await photo.run(reg))) return;
        m.mutate({
          p_id: arrival!.id, p_registration: regArgs(reg), p_room_id: room || null,
          p_room_override_reason: notReady ? ovr : null, p_deposit_waive_reason: due > 0 ? waive : null,
        }, { onSuccess: () => onOpenChange(false) });
      }}>
      {arrival && (
        <p className="text-sm text-muted-foreground">
          {arrival.number} · {arrival.room_type_code} · {formatDay(arrival.arrival_date)} to {formatDay(arrival.departure_date)} ({nightsLabel(arrival.nights)})
        </p>
      )}
      <Field label="Room" htmlFor="fd-room"><RoomSelect rooms={rooms.data ?? []} value={room} onChange={setRoom} loading={rooms.isLoading} /></Field>
      <OverrideReason show={notReady} value={ovr} onChange={setOvr} />
      <DepositBlock due={due} currency={arrival?.currency ?? "NGN"} value={waive} onChange={setWaive} />
      <RegistrationFields reg={reg} setReg={setReg} photo={photo} />
    </FormDialog>
  );
}

interface RoomType { id: string; code: string; name: string; is_active: boolean }
interface RatePlan { id: string; code: string; name: string; is_active: boolean }

export function WalkInDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { property } = useAccess();
  const bdate = property?.business_date ?? "";
  const roomTypes = useSetupList<RoomType>("room_types", "code");
  const ratePlans = useSetupList<RatePlan>("rate_plans", "code");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [guest, setGuest] = useState({ id: "", label: "" });
  const [f, setF] = useState({ departure: "", room_type_id: "", rate_plan_id: "", adults: "1", children: "0", company_name: "", room: "", ovr: "" });
  const [reg, setReg] = useState(EMPTY_REG);
  const rooms = useFdRooms(f.room_type_id || null, bdate, f.departure, null, open && !!f.room_type_id);
  const m = useResMutation<string>("walk_in_check_in", "Walk-in checked in.");
  const photo = usePhotoStep(guest.id || null, open);
  useEffect(() => {
    if (!open) return;
    setKey(crypto.randomUUID()); setGuest({ id: "", label: "" }); setReg(EMPTY_REG); photo.reset();
    setF({ departure: addDays(bdate, 1), room_type_id: "", rate_plan_id: "", adults: "1", children: "0", company_name: "", room: "", ovr: "" });
  }, [open, bdate]); // eslint-disable-line react-hooks/exhaustive-deps
  const picked = rooms.data?.find((r) => r.id === f.room);
  const notReady = !!picked && !picked.is_ready;
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v, ...(k === "room_type_id" || k === "departure" ? { room: "" } : {}) }));

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Walk-in guest" busy={m.isPending || photo.uploading} submitDisabled={!reg.accepted}
      onSubmit={async () => { if (!(await photo.run(reg))) return; m.mutate({
        p_property_id: property!.id, p_idempotency_key: key, p_guest_id: guest.id || null, p_departure: f.departure,
        p_room_type_id: f.room_type_id || null, p_rate_plan_id: f.rate_plan_id || null, p_adults: Number(f.adults),
        p_children: Number(f.children || 0), p_room_id: f.room || null, p_registration: regArgs(reg),
        p_company_name: f.company_name || null, p_room_override_reason: notReady ? f.ovr : null,
      }, { onSuccess: () => onOpenChange(false) }); }}>
      <p className="text-sm text-muted-foreground">Creates the booking and checks the guest in. Arrival is today, {formatDay(bdate)}.</p>
      <Field label="Guest" htmlFor="guest"><GuestPicker value={guest.id} label={guest.label} onPick={(id, label) => setGuest({ id, label })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Departure" htmlFor="wi-dep" hint={nightsLabel(Math.max(nightsBetween(bdate, f.departure), 0))}>
          <Input id="wi-dep" type="date" min={bdate} value={f.departure} onChange={(e) => set("departure", e.target.value)} required />
        </Field>
        <Field label="Room type" htmlFor="wi-rt">
          <Select value={f.room_type_id} onValueChange={(v) => set("room_type_id", v)}>
            <SelectTrigger id="wi-rt"><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>{(roomTypes.data ?? []).filter((r) => r.is_active).map((r) => <SelectItem key={r.id} value={r.id}>{r.code} · {r.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Rate plan" htmlFor="wi-rp">
          <Select value={f.rate_plan_id} onValueChange={(v) => set("rate_plan_id", v)}>
            <SelectTrigger id="wi-rp"><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>{(ratePlans.data ?? []).filter((r) => r.is_active).map((r) => <SelectItem key={r.id} value={r.id}>{r.code} · {r.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Room" htmlFor="fd-room"><RoomSelect rooms={rooms.data ?? []} value={f.room} onChange={(v) => set("room", v)} loading={rooms.isLoading} /></Field>
        <Field label="Adults" htmlFor="wi-ad"><Input id="wi-ad" type="number" min={1} value={f.adults} onChange={(e) => set("adults", e.target.value)} required /></Field>
        <Field label="Children" htmlFor="wi-ch"><Input id="wi-ch" type="number" min={0} value={f.children} onChange={(e) => set("children", e.target.value)} /></Field>
      </div>
      <OverrideReason show={notReady} value={f.ovr} onChange={(v) => set("ovr", v)} />
      <Field label="Company" htmlFor="wi-co" hint="Optional."><Input id="wi-co" value={f.company_name} onChange={(e) => set("company_name", e.target.value)} maxLength={200} /></Field>
      <RegistrationFields reg={reg} setReg={setReg} photo={photo} />
    </FormDialog>
  );
}

interface MoveQuote { same_type: boolean; is_upgrade: boolean; can_keep_rate: boolean; current_total?: string; new_total?: string | null; currency?: string }

export function MoveRoomDialog({ stay, onOpenChange }: { stay: InHouseRow | null; onOpenChange: (o: boolean) => void }) {
  const { property } = useAccess();
  const [room, setRoom] = useState("");
  const [reason, setReason] = useState("");
  const [ovr, setOvr] = useState("");
  const from = property?.business_date ?? "";
  const rooms = useFdRooms(null, from, stay?.departure_date ?? "", stay?.reservation_id ?? null, !!stay);
  const m = useResMutation("move_room", "Guest moved.");
  useEffect(() => { if (stay) setLabelHint("move_room", stay.reservation_id, `Move ${stay.guest_name ?? "guest"} out of ${stay.room_number}`); }, [stay]);
  const [rate, setRate] = useState<"" | "keep" | "new">("");
  useEffect(() => { if (stay) { setRoom(""); setReason(""); setOvr(""); setRate(""); } }, [stay]);
  const picked = rooms.data?.find((r) => r.id === room);
  const notReady = !!picked && !picked.is_ready;
  const otherType = !!picked && picked.room_type_id !== stay?.room_type_id;
  // FO-007: the database says whether the new type costs more, both totals, and whether this user may keep the rate.
  const quote = useQuery({
    queryKey: ["reservations", "move-rate", stay?.reservation_id, room], enabled: !!stay && otherType,
    queryFn: () => callRpc<MoveQuote>("preview_move_rate", { p_id: stay!.reservation_id, p_room_id: room }),
  });
  const q = otherType ? quote.data : undefined;
  useEffect(() => { if (q) setRate(q.is_upgrade ? "new" : "keep"); }, [q]);
  return (
    <FormDialog open={!!stay} onOpenChange={onOpenChange} title={`Move ${stay?.guest_name ?? "guest"} from ${stay?.room_number ?? ""}`} busy={m.isPending}
      submitDisabled={otherType && !q}
      onSubmit={() => m.mutate({ p_id: stay!.reservation_id, p_room_id: room || null, p_reason: reason, p_room_override_reason: notReady ? ovr : null,
        p_keep_rate: otherType ? rate === "keep" : null },
        { onSuccess: () => onOpenChange(false) })}>
      <Field label="New room" htmlFor="fd-room">
        <RoomSelect rooms={(rooms.data ?? []).filter((r) => r.id !== stay?.room_id)} value={room} onChange={setRoom} loading={rooms.isLoading} />
      </Field>
      {q && (
        <Field label="Rate for the new room" htmlFor="mv-rate"
          hint={q.is_upgrade ? "This room type costs more." : "This room type costs the same or less."}>
          <Select value={rate} onValueChange={(v) => setRate(v as "keep" | "new")}>
            <SelectTrigger id="mv-rate"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new" disabled={q.new_total == null}>
                Charge the new room type's rate{q.new_total != null ? ` (${formatAmount(q.new_total, q.currency ?? "NGN")} for the remaining nights)` : " (no price set)"}
              </SelectItem>
              {q.can_keep_rate && (
                <SelectItem value="keep">
                  {q.is_upgrade ? "Complimentary upgrade (keep rate)" : "Keep the booked rate"} ({formatAmount(q.current_total ?? "0", q.currency ?? "NGN")})
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </Field>
      )}
      {q?.is_upgrade && !q.can_keep_rate && <p className="text-sm text-muted-foreground">A complimentary upgrade needs the General Manager or Front Office Manager.</p>}
      {q?.is_upgrade && rate === "keep" && <p className="text-sm text-muted-foreground">The reason for the move is saved with the complimentary upgrade in the audit log.</p>}
      <OverrideReason show={notReady} value={ovr} onChange={setOvr} />
      <Field label="Reason for the move" htmlFor="mv-reason"><Input id="mv-reason" value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={300} /></Field>
      <p className="text-sm text-muted-foreground">{stay?.room_number} will be marked vacant and dirty.</p>
    </FormDialog>
  );
}

export function ExtendStayDialog({ stay, onOpenChange }: { stay: InHouseRow | null; onOpenChange: (o: boolean) => void }) {
  const { property } = useAccess();
  const [dep, setDep] = useState("");
  const [reason, setReason] = useState("");
  const m = useResMutation("extend_stay", "Departure changed.");
  useEffect(() => { if (stay) { setDep(addDays(stay.departure_date, 1)); setReason(""); } }, [stay]);
  // FO-008: later adds nights, earlier (but after the business date) removes the unused ones.
  const change = stay && dep ? nightsBetween(stay.departure_date, dep) : 0;
  const hint = change > 0 ? `${change} extra night${change === 1 ? "" : "s"}` : change < 0 ? `${-change} night${change === -1 ? "" : "s"} fewer` : "";
  return (
    <FormDialog open={!!stay} onOpenChange={onOpenChange} title={`Change departure · ${stay?.room_number ?? ""}`} busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: stay!.reservation_id, p_new_departure: dep, p_reason: reason || null }, { onSuccess: () => onOpenChange(false) })}>
      <p className="text-sm text-muted-foreground">Current departure: {formatDay(stay?.departure_date)}. Pick a later date to extend or an earlier one to shorten. To leave today, check the guest out.</p>
      <Field label="New departure" htmlFor="ex-dep" hint={hint}>
        <Input id="ex-dep" type="date" min={property?.business_date ? addDays(property.business_date, 1) : undefined} value={dep} onChange={(e) => setDep(e.target.value)} required />
      </Field>
      <Field label="Note" htmlFor="ex-reason" hint="Optional."><Input id="ex-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field>
    </FormDialog>
  );
}

export function VoidCheckInDialog({ stay, onOpenChange }: { stay: InHouseRow | null; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState("");
  const m = useResMutation("void_check_in", "Check-in voided.");
  useEffect(() => { if (stay) setReason(""); }, [stay]);
  return (
    <FormDialog open={!!stay} onOpenChange={onOpenChange} title="Void check-in" busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: stay!.reservation_id, p_reason: reason }, { onSuccess: () => onOpenChange(false) })}>
      <Alert variant="destructive">
        <AlertDescription>
          {stay?.guest_name} goes back to arrivals, and {stay?.room_number} is marked vacant and dirty. Use this only for a check-in made in error today.
        </AlertDescription>
      </Alert>
      <Field label="Reason" htmlFor="void-reason"><Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={300} /></Field>
    </FormDialog>
  );
}
