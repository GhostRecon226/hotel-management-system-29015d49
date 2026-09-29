import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { errorMessage } from "@/lib/errors";
import { callRpc, Field, FormDialog } from "@/lib/setup";
import { addDays } from "@/lib/reservations";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BoardRoom {
  id: string; property_id: string; room_number: string; floor: string | null; room_type_id: string;
  room_type_code: string; room_type_name: string; condition: string; is_occupied: boolean; is_active: boolean;
  block_id: string | null; block_type: string | null; block_to_date: string | null; is_sellable: boolean;
  current_reservation_id: string | null; current_number: string | null; current_guest_name: string | null; current_departure_date: string | null;
  next_reservation_id: string | null; next_number: string | null; next_guest_name: string | null; next_arrival_date: string | null;
  pending_blocks: number;
}
export interface RoomBlock {
  id: string; room_id: string; block_type: string; from_date: string; to_date: string; reason: string;
  status: string; decision_reason: string | null; release_reason: string | null; created_at: string;
}

export const CONDITIONS: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  clean: { label: "Clean", tone: "success" }, inspected: { label: "Inspected", tone: "success" },
  dirty: { label: "Dirty", tone: "warning" }, out_of_order: { label: "Out of order", tone: "danger" },
};
export const BLOCK_TYPES: Record<string, string> = { out_of_order: "Out of order", out_of_service: "Out of service", hold: "Hold" };
const BLOCK_STATUS: Record<string, { label: string; tone: "warning" | "danger" | "neutral" | "info" }> = {
  pending: { label: "Waiting for approval", tone: "warning" }, approved: { label: "Approved", tone: "danger" },
  rejected: { label: "Rejected", tone: "neutral" }, released: { label: "Released", tone: "neutral" }, cancelled: { label: "Cancelled", tone: "neutral" },
};

export function ConditionBadge({ condition }: { condition: string }) {
  const c = CONDITIONS[condition] ?? { label: condition, tone: "warning" as const };
  return <Badge variant={c.tone} dot>{c.label}</Badge>;
}
export function BlockStatusBadge({ status }: { status: string }) {
  const s = BLOCK_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge variant={s.tone}>{s.label}</Badge>;
}

export function useRoomBoard(propertyId?: string) {
  return useQuery({
    queryKey: ["rooms", "board", propertyId], enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("v_room_board").select("*").eq("property_id", propertyId);
      if (error) throw error;
      return (data as BoardRoom[]).sort((a, b) => a.room_number.length - b.room_number.length || a.room_number.localeCompare(b.room_number));
    },
  });
}
export function useBoardRoom(id: string) {
  return useQuery({
    queryKey: ["rooms", "board-room", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("v_room_board").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as BoardRoom | null;
    },
  });
}
export function useRoomBlocks(roomId: string) {
  return useQuery({
    queryKey: ["rooms", "blocks", roomId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("room_blocks").select("*").eq("room_id", roomId).order("from_date", { ascending: false });
      if (error) throw error;
      return data as RoomBlock[];
    },
  });
}

export function useRoomMutation(name: string, success: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) => callRpc(name, args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["setup", "rooms"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      toast.success(success);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function SetConditionDialog({ room, onOpenChange }: { room: BoardRoom | null; onOpenChange: (o: boolean) => void }) {
  const m = useRoomMutation("set_room_condition", "Room condition updated.");
  const [condition, setCondition] = useState("clean");
  const [reason, setReason] = useState("");
  useEffect(() => { if (room) { setCondition(room.condition === "out_of_order" ? "dirty" : room.condition); setReason(""); } }, [room]);
  return (
    <FormDialog open={!!room} onOpenChange={onOpenChange} title={`Set condition · Room ${room?.room_number ?? ""}`} busy={m.isPending}
      onSubmit={() => m.mutate({ p_room_id: room!.id, p_condition: condition, p_reason: reason || null }, { onSuccess: () => onOpenChange(false) })}>
      <Field label="Condition" htmlFor="c-cond" hint="To take a room out of use, block it instead.">
        <Select value={condition} onValueChange={setCondition}>
          <SelectTrigger id="c-cond"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["clean", "dirty", "inspected"].map((c) => <SelectItem key={c} value={c}>{CONDITIONS[c]!.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label={room?.condition === "out_of_order" ? "Reason (required)" : "Reason (optional)"} htmlFor="c-reason">
        <Input id="c-reason" value={reason} onChange={(e) => setReason(e.target.value)} required={room?.condition === "out_of_order"} />
      </Field>
    </FormDialog>
  );
}

export function BlockRoomDialog({ room, onOpenChange }: { room: BoardRoom | null; onOpenChange: (o: boolean) => void }) {
  const { property, can } = useAccess();
  const m = useRoomMutation("request_room_block", can("room.block.approve") ? "Room blocked." : "Block sent for approval.");
  const today = property?.business_date ?? "";
  const [f, setF] = useState({ type: "out_of_order", from: today, to: today ? addDays(today, 1) : "", reason: "" });
  useEffect(() => { if (room) setF({ type: "out_of_order", from: today, to: today ? addDays(today, 1) : "", reason: "" }); }, [room, today]);
  return (
    <FormDialog open={!!room} onOpenChange={onOpenChange} title={`Block room ${room?.room_number ?? ""}`} busy={m.isPending}
      onSubmit={() => m.mutate({ p_room_id: room!.id, p_type: f.type, p_from: f.from, p_to: f.to, p_reason: f.reason }, { onSuccess: () => onOpenChange(false) })}>
      {!can("room.block.approve") && <p className="text-sm text-muted-foreground">A manager must approve this block before the room stops being sold.</p>}
      <Field label="Type" htmlFor="b-type">
        <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
          <SelectTrigger id="b-type"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(BLOCK_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First night blocked" htmlFor="b-from"><Input id="b-from" type="date" min={today} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} required /></Field>
        <Field label="Back in use on" htmlFor="b-to"><Input id="b-to" type="date" min={f.from} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} required /></Field>
      </div>
      <Field label="Reason" htmlFor="b-reason"><Textarea id="b-reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required /></Field>
    </FormDialog>
  );
}

export function ReasonDialog({ open, title, label, required, busy, onOpenChange, onSubmit }: {
  open: boolean; title: string; label: string; required?: boolean; busy: boolean;
  onOpenChange: (o: boolean) => void; onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={title} busy={busy} onSubmit={() => onSubmit(reason)}>
      <Field label={label} htmlFor="r-reason"><Input id="r-reason" value={reason} onChange={(e) => setReason(e.target.value)} required={required} /></Field>
    </FormDialog>
  );
}
