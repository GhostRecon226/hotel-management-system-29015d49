import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { errorMessage } from "@/lib/errors";
import { callRpc, Field, FormDialog } from "@/lib/setup";
import { callRpcQueued, QUEUED } from "@/lib/offline/queue";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sortByRoom } from "@/lib/room-label";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ChecklistItem { label: string; done: boolean }
export interface HkTask {
  id: string; property_id: string; room_id: string; type: string; status: string; priority: string;
  assignee_id: string | null; assignee_name: string | null; checklist: ChecklistItem[]; defects: string[]; notes: string | null;
  business_date: string; created_at: string; started_at: string | null; completed_at: string | null; completed_by: string | null;
  completed_by_name: string | null; inspected_at: string | null; inspected_by_name: string | null; inspection_result: string | null;
  fail_count: number; cancel_reason: string | null; room_number: string; floor: string | null; room_condition: string;
  is_occupied: boolean; room_type_name: string; board_column: string;
}
export interface LostFoundItem {
  id: string; description: string; found_at: string; location: string; status: string; room_id: string | null;
  claimed_by_name: string | null; status_note: string | null;
}

export const TASK_TYPES: Record<string, string> = { turnover: "Turnover", stayover: "Stayover", deep_clean: "Deep clean", inspection: "Inspection" };
export const PRIORITIES: Record<string, { label: string; tone: "neutral" | "info" | "warning" | "danger" }> = {
  low: { label: "Low", tone: "neutral" }, normal: { label: "Normal", tone: "neutral" },
  high: { label: "High", tone: "warning" }, urgent: { label: "Urgent", tone: "danger" },
};
const STATUS: Record<string, { label: string; tone: "neutral" | "info" | "warning" | "danger" | "success" }> = {
  open: { label: "Open", tone: "neutral" }, assigned: { label: "Assigned", tone: "info" }, in_progress: { label: "In progress", tone: "info" },
  done: { label: "Waiting inspection", tone: "warning" }, inspected: { label: "Passed", tone: "success" },
  failed: { label: "Failed inspection", tone: "danger" }, cancelled: { label: "Cancelled", tone: "neutral" },
};
export const LF_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "success" | "warning" }> = {
  stored: { label: "Stored", tone: "info" }, claimed: { label: "Claimed", tone: "warning" },
  returned: { label: "Returned", tone: "success" }, disposed: { label: "Disposed", tone: "neutral" },
};

export function TaskStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge variant={s.tone}>{s.label}</Badge>;
}
export function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "normal") return null;
  const p = PRIORITIES[priority] ?? PRIORITIES['normal']!;
  return <Badge variant={p.tone}>{p.label}</Badge>;
}

/** Tasks for the current property; finished ones only for the business date. */
export function useHkTasks(filter?: { mine?: boolean; column?: string }) {
  const { property, ctx } = useAccess();
  return useQuery({
    queryKey: ["housekeeping", "tasks", property?.id, filter],
    enabled: !!property,
    refetchInterval: 30_000,
    queryFn: async () => {
      let q = (supabase.from as any)("v_hk_board").select("*").eq("property_id", property!.id).neq("status", "cancelled");
      if (filter?.mine) q = q.eq("assignee_id", ctx.user_id).in("status", ["assigned", "in_progress", "failed", "open"]);
      if (filter?.column) q = q.eq("board_column", filter.column);
      const { data, error } = await q.order("created_at");
      if (error) throw error;
      const bdate = property!.business_date;
      return (data as HkTask[]).filter((t) => t.status !== "inspected" || (t.inspected_at ?? "").slice(0, 10) >= bdate || t.business_date === bdate);
    },
  });
}

export function useHkStaff() {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["housekeeping", "staff", property?.id],
    enabled: !!property,
    queryFn: () => callRpc<{ id: string; full_name: string }[]>("hk_staff", { p_property_id: property!.id }),
  });
}

export function useHkMutation(name: string, success: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) => callRpcQueued(name, args),
    onSuccess: (data) => {
      if (data === QUEUED) { toast.info("Saved on this device. It will be sent when the connection returns."); return; }
      ["housekeeping", "rooms", "notifications"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(success);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useLostFound() {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["housekeeping", "lost-found", property?.id],
    enabled: !!property,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("lost_found_items").select("*").eq("property_id", property!.id).order("found_at", { ascending: false });
      if (error) throw error;
      return data as LostFoundItem[];
    },
  });
}

export function useRoomsList() {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["housekeeping", "rooms-list", property?.id],
    enabled: !!property,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("rooms").select("id, room_number").eq("property_id", property!.id).eq("is_active", true);
      if (error) throw error;
      return sortByRoom(data as { id: string; room_number: string }[]);
    },
  });
}

export function NewTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const rooms = useRoomsList();
  const staff = useHkStaff();
  const m = useHkMutation("create_hk_task", "Task created.");
  const [f, setF] = useState({ room: "", type: "stayover", priority: "normal", assignee: "none", notes: "" });
  useEffect(() => { if (open) setF({ room: "", type: "stayover", priority: "normal", assignee: "none", notes: "" }); }, [open]);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="New housekeeping task" busy={m.isPending}
      onSubmit={() => {
        if (!f.room) { toast.error("Pick a room."); return; }
        m.mutate({ p_room_id: f.room, p_type: f.type, p_priority: f.priority, p_assignee_id: f.assignee === "none" ? null : f.assignee, p_notes: f.notes || null },
          { onSuccess: () => onOpenChange(false) });
      }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Room" htmlFor="t-room">
          <Select value={f.room} onValueChange={(v) => setF({ ...f, room: v })}>
            <SelectTrigger id="t-room"><SelectValue placeholder="Pick a room" /></SelectTrigger>
            <SelectContent>{(rooms.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.room_number}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Type" htmlFor="t-type">
          <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
            <SelectTrigger id="t-type"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(TASK_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Priority" htmlFor="t-pri">
          <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}>
            <SelectTrigger id="t-pri"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PRIORITIES).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Assign to" htmlFor="t-who">
          <Select value={f.assignee} onValueChange={(v) => setF({ ...f, assignee: v })}>
            <SelectTrigger id="t-who"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nobody yet</SelectItem>
              {(staff.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {f.type === "turnover" && <p className="text-sm text-muted-foreground">Any unstarted turnover for this room will be cancelled.</p>}
      <Field label="Notes (optional)" htmlFor="t-notes"><Textarea id="t-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </FormDialog>
  );
}

export function AssignDialog({ task, onOpenChange }: { task: HkTask | null; onOpenChange: (o: boolean) => void }) {
  const staff = useHkStaff();
  const m = useHkMutation("assign_hk_task", "Task assigned.");
  const [who, setWho] = useState("none");
  useEffect(() => { if (task) setWho(task.assignee_id ?? "none"); }, [task]);
  return (
    <FormDialog open={!!task} onOpenChange={onOpenChange} title={`Assign · ${task?.room_number ?? ""}`} busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: task!.id, p_assignee_id: who === "none" ? null : who }, { onSuccess: () => onOpenChange(false) })}>
      <Field label="Attendant" htmlFor="a-who">
        <Select value={who} onValueChange={setWho}>
          <SelectTrigger id="a-who"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nobody (unassign)</SelectItem>
            {(staff.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
    </FormDialog>
  );
}

export function CancelTaskDialog({ task, onOpenChange }: { task: HkTask | null; onOpenChange: (o: boolean) => void }) {
  const m = useHkMutation("cancel_hk_task", "Task cancelled.");
  const [reason, setReason] = useState("");
  useEffect(() => { if (task) setReason(""); }, [task]);
  return (
    <FormDialog open={!!task} onOpenChange={onOpenChange} title={`Cancel task · ${task?.room_number ?? ""}`} busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: task!.id, p_reason: reason }, { onSuccess: () => onOpenChange(false) })}>
      <Field label="Reason" htmlFor="c-reason"><Input id="c-reason" required value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </FormDialog>
  );
}
