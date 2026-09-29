import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { errorCode, errorMessage } from "@/lib/errors";
import { callRpc, Field, FormDialog, useSetupList } from "@/lib/setup";
import { BLOCK_TYPES } from "@/lib/rooms";
import { useRoomsList } from "@/lib/housekeeping";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Tone = "neutral" | "info" | "warning" | "danger" | "success";

export interface Ticket {
  id: string; property_id: string; title: string; description: string | null; room_id: string | null; room_number: string | null;
  location: string | null; priority: string; status: string; assignee_id: string | null; assignee_name: string | null;
  wait_reason: string | null; resolution: string | null; resolved_by: string | null; resolved_by_name: string | null; resolved_at: string | null;
  closed_by_name: string | null; closed_at: string | null; cancel_reason: string | null; reopen_count: number; last_reopen_reason: string | null;
  created_by: string | null; created_by_name: string | null; created_at: string; updated_at: string; has_active_block: boolean;
}
export interface ServiceRequest {
  id: string; reservation_id: string; reservation_number: string; guest_name: string | null; room_number: string | null;
  category: string; description: string; chargeable: boolean; charge_amount: number | null; currency: string;
  charge_code_id: string | null; charge_code_name: string | null; status: string; assignee_id: string | null; assignee_name: string | null;
  posted_transaction_id: string | null; completed_by_name: string | null; completed_at: string | null; cancel_reason: string | null;
  created_by: string | null; created_at: string;
}

export const TICKET_STATUS: Record<string, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "neutral" }, assigned: { label: "Assigned", tone: "info" }, in_progress: { label: "In progress", tone: "info" },
  waiting: { label: "Waiting", tone: "warning" }, resolved: { label: "Resolved – check needed", tone: "warning" },
  closed: { label: "Closed", tone: "success" }, cancelled: { label: "Cancelled", tone: "neutral" },
};
export const PRIORITY: Record<string, { label: string; tone: Tone }> = {
  low: { label: "Low", tone: "neutral" }, normal: { label: "Normal", tone: "neutral" },
  high: { label: "High", tone: "warning" }, urgent: { label: "Urgent", tone: "danger" },
};
export const SVC_STATUS: Record<string, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "neutral" }, assigned: { label: "Assigned", tone: "info" }, in_progress: { label: "In progress", tone: "info" },
  completed: { label: "Completed", tone: "success" }, cancelled: { label: "Cancelled", tone: "neutral" },
};
export const SVC_CATEGORIES: Record<string, string> = {
  food: "Food and drink", laundry: "Laundry", housekeeping: "Housekeeping", amenities: "Extra amenities",
  transport: "Transport", wake_up: "Wake-up call", other: "Other",
};

export function StatusBadge({ map, value }: { map: Record<string, { label: string; tone: Tone }>; value: string }) {
  const s = map[value] ?? { label: value, tone: "neutral" as Tone };
  return <Badge variant={s.tone}>{s.label}</Badge>;
}

export function useTickets() {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["maintenance", "tickets", property?.id],
    enabled: !!property,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("v_maintenance_tickets").select("*").eq("property_id", property!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Ticket[];
    },
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ["maintenance", "ticket", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("v_maintenance_tickets").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Ticket | null;
    },
  });
}

export function useTicketBlocks(id: string) {
  return useQuery({
    queryKey: ["maintenance", "blocks", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("room_blocks").select("id, block_type, from_date, to_date, status, reason").eq("ticket_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; block_type: string; from_date: string; to_date: string; status: string; reason: string }[];
    },
  });
}

function useStaff(fn: "mnt_staff" | "svc_staff") {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["maintenance", fn, property?.id],
    enabled: !!property,
    queryFn: () => callRpc<{ id: string; full_name: string }[]>(fn, { p_property_id: property!.id }),
  });
}

export function useWorkMutation(name: string, success: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) => callRpc(name, args),
    onSuccess: () => {
      ["maintenance", "service-requests", "rooms", "folios", "notifications"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(success);
    },
    onError: (e) => {
      if (errorCode(e) === "E_SOD") toast.error("Someone else must do this", { description: errorMessage(e), duration: 8000 });
      else toast.error(errorMessage(e));
    },
  });
}

export function useServiceRequests() {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["service-requests", property?.id],
    enabled: !!property,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("v_service_requests").select("*").eq("property_id", property!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceRequest[];
    },
  });
}

function StaffSelect({ id, fn, value, onChange, noneLabel }: { id: string; fn: "mnt_staff" | "svc_staff"; value: string; onChange: (v: string) => void; noneLabel: string }) {
  const staff = useStaff(fn);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{noneLabel}</SelectItem>
        {(staff.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function NewTicketDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (id: string) => void }) {
  const { property, can } = useAccess();
  const rooms = useRoomsList();
  const m = useWorkMutation("create_ticket", "Ticket created.");
  const blank = { title: "", description: "", room: "none", location: "", priority: "normal", assignee: "none" };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(blank); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Report a problem" busy={m.isPending}
      onSubmit={() => {
        if (f.room === "none" && !f.location.trim()) { toast.error("Pick a room or type where the problem is."); return; }
        m.mutate({
          p_property_id: property!.id, p_title: f.title, p_description: f.description || null,
          p_room_id: f.room === "none" ? null : f.room, p_location: f.location || null, p_priority: f.priority,
          p_assignee_id: f.assignee === "none" ? null : f.assignee,
        }, { onSuccess: (id) => { onOpenChange(false); onCreated?.(id as string); } });
      }}>
      <Field label="What is wrong?" htmlFor="t-title"><Input id="t-title" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. AC not cooling" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Room" htmlFor="t-room">
          <Select value={f.room} onValueChange={(v) => setF({ ...f, room: v })}>
            <SelectTrigger id="t-room"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not a room</SelectItem>
              {(rooms.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>Room {r.room_number}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label={f.room === "none" ? "Location" : "Location (optional)"} htmlFor="t-loc"><Input id="t-loc" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="e.g. Lobby toilet" /></Field>
        <Field label="Priority" htmlFor="t-pri">
          <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}>
            <SelectTrigger id="t-pri"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PRIORITY).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        {can("mnt.ticket.assign") && (
          <Field label="Assign to" htmlFor="t-who">
            <StaffSelect id="t-who" fn="mnt_staff" value={f.assignee} onChange={(v) => setF({ ...f, assignee: v })} noneLabel="Nobody yet" />
          </Field>
        )}
      </div>
      <Field label="Details (optional)" htmlFor="t-desc"><Textarea id="t-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
    </FormDialog>
  );
}

export function AssignTicketDialog({ ticket, onOpenChange }: { ticket: Ticket | null; onOpenChange: (o: boolean) => void }) {
  const m = useWorkMutation("assign_ticket", "Ticket assigned.");
  const [who, setWho] = useState("none");
  useEffect(() => { if (ticket) setWho(ticket.assignee_id ?? "none"); }, [ticket]);
  return (
    <FormDialog open={!!ticket} onOpenChange={onOpenChange} title="Assign ticket" busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: ticket!.id, p_assignee_id: who === "none" ? null : who }, { onSuccess: () => onOpenChange(false) })}>
      <Field label="Technician" htmlFor="a-who"><StaffSelect id="a-who" fn="mnt_staff" value={who} onChange={setWho} noneLabel="Nobody (unassign)" /></Field>
    </FormDialog>
  );
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

export function BlockTicketRoomDialog({ ticket, onOpenChange }: { ticket: Ticket | null; onOpenChange: (o: boolean) => void }) {
  const { property, can } = useAccess();
  const m = useWorkMutation("block_room_for_ticket", can("room.block.approve") ? "Room blocked." : "Block sent for approval.");
  const today = property?.business_date ?? "";
  const [f, setF] = useState({ type: "out_of_order", from: today, to: today ? addDays(today, 1) : "", reason: "" });
  useEffect(() => { if (ticket) setF({ type: "out_of_order", from: today, to: today ? addDays(today, 1) : "", reason: `Maintenance: ${ticket.title}` }); }, [ticket, today]);
  return (
    <FormDialog open={!!ticket} onOpenChange={onOpenChange} title={`Block room ${ticket?.room_number ?? ""}`} busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: ticket!.id, p_type: f.type, p_from: f.from, p_to: f.to, p_reason: f.reason }, { onSuccess: () => onOpenChange(false) })}>
      {!can("room.block.approve") && <p className="text-sm text-muted-foreground">A manager must approve this block before the room stops being sold.</p>}
      <Field label="Type" htmlFor="tb-type">
        <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
          <SelectTrigger id="tb-type"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(BLOCK_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First night blocked" htmlFor="tb-from"><Input id="tb-from" type="date" min={today} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} required /></Field>
        <Field label="Back in use on" htmlFor="tb-to"><Input id="tb-to" type="date" min={f.from} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} required /></Field>
      </div>
      <Field label="Reason" htmlFor="tb-reason"><Textarea id="tb-reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required /></Field>
    </FormDialog>
  );
}

export function TextReasonDialog({ open, title, label, busy, onOpenChange, onSubmit }: {
  open: boolean; title: string; label: string; busy: boolean; onOpenChange: (o: boolean) => void; onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  useEffect(() => { if (open) setText(""); }, [open]);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={title} busy={busy} onSubmit={() => onSubmit(text)}>
      <Field label={label} htmlFor="tr-text"><Textarea id="tr-text" required value={text} onChange={(e) => setText(e.target.value)} /></Field>
    </FormDialog>
  );
}

export interface ServiceGuest { reservation_id: string; guest_name: string | null; room_number: string }

export function NewServiceRequestDialog({ guest, onOpenChange }: { guest: ServiceGuest | null; onOpenChange: (o: boolean) => void }) {
  const { property } = useAccess();
  const { data: codes = [] } = useSetupList<{ id: string; code: string; name: string; category: string; is_active: boolean }>("charge_codes", "code");
  const active = codes.filter((c) => c.is_active && !["tax", "room"].includes(c.category));
  const m = useWorkMutation("create_service_request", "Service request created.");
  const blank = { category: "food", description: "", chargeable: false, amount: "", code: "", assignee: "none" };
  const [f, setF] = useState(blank);
  useEffect(() => { if (guest) setF(blank); }, [guest]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <FormDialog open={!!guest} onOpenChange={onOpenChange} title={`Service request · Room ${guest?.room_number ?? ""}`} busy={m.isPending}
      onSubmit={() => {
        if (f.chargeable && (!f.code || !(Number(f.amount) > 0))) { toast.error("Enter the amount and pick a charge code."); return; }
        m.mutate({
          p_reservation_id: guest!.reservation_id, p_category: f.category, p_description: f.description,
          p_chargeable: f.chargeable, p_charge_amount: f.chargeable ? Number(f.amount) : null, p_charge_code_id: f.chargeable ? f.code : null,
          p_assignee_id: f.assignee === "none" ? null : f.assignee,
        }, { onSuccess: () => onOpenChange(false) });
      }}>
      <p className="text-sm text-muted-foreground">For {guest?.guest_name ?? "guest"}.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="s-cat">
          <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
            <SelectTrigger id="s-cat"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(SVC_CATEGORIES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Assign to" htmlFor="s-who"><StaffSelect id="s-who" fn="svc_staff" value={f.assignee} onChange={(v) => setF({ ...f, assignee: v })} noneLabel="Nobody yet" /></Field>
      </div>
      <Field label="What does the guest need?" htmlFor="s-desc"><Textarea id="s-desc" required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div className="flex min-h-11 items-center gap-3">
        <Checkbox id="s-charge" checked={f.chargeable} onCheckedChange={(v) => setF({ ...f, chargeable: v === true })} />
        <Label htmlFor="s-charge">Charge the guest when done</Label>
      </div>
      {f.chargeable && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Amount before tax (${property?.base_currency === "NGN" ? "₦" : property?.base_currency ?? ""})`} htmlFor="s-amt">
            <Input id="s-amt" type="number" inputMode="decimal" min="0" step="0.01" className="text-right" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <Field label="Charge code" htmlFor="s-code">
            <Select value={f.code} onValueChange={(v) => setF({ ...f, code: v })}>
              <SelectTrigger id="s-code"><SelectValue placeholder="Pick a charge code" /></SelectTrigger>
              <SelectContent>{active.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
      )}
      {f.chargeable && <p className="text-sm text-muted-foreground">The charge goes on the guest's main folio once, when the request is completed. Taxes are added if the charge code is taxable.</p>}
    </FormDialog>
  );
}

export function AssignServiceDialog({ req, onOpenChange }: { req: ServiceRequest | null; onOpenChange: (o: boolean) => void }) {
  const m = useWorkMutation("assign_service_request", "Request assigned.");
  const [who, setWho] = useState("none");
  useEffect(() => { if (req) setWho(req.assignee_id ?? "none"); }, [req]);
  return (
    <FormDialog open={!!req} onOpenChange={onOpenChange} title="Assign request" busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: req!.id, p_assignee_id: who === "none" ? null : who }, { onSuccess: () => onOpenChange(false) })}>
      <Field label="Staff member" htmlFor="sa-who"><StaffSelect id="sa-who" fn="svc_staff" value={who} onChange={setWho} noneLabel="Nobody (unassign)" /></Field>
    </FormDialog>
  );
}
