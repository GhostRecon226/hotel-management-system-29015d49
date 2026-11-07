import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAccess } from "@/lib/access";
import { Field, FormDialog, NoAccess } from "@/lib/setup";
import { formatDateTime } from "@/lib/reservations";
import { TASK_TYPES, useHkMutation, useHkTasks, type HkTask } from "@/lib/housekeeping";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { Initials } from "@/components/dashboard-parts";
import { ProgressBar } from "@/components/housekeeping-board";
import { addDefectLine, checklistProgress, COMMON_DEFECTS, removeDefectLine } from "@/lib/housekeeping-view";
import { cn } from "@/lib/utils";
import { RoomName } from "@/components/room-name";

export const Route = createFileRoute("/_authenticated/_app/housekeeping/inspections")({
  head: () => ({ meta: [{ title: "Inspections · Zikora" }] }),
  component: Inspections,
});

function Inspections() {
  const { can, ctx } = useAccess();
  const { data = [], isLoading } = useHkTasks({ column: "waiting_inspection" });
  const [pass, setPass] = useState<HkTask | null>(null);
  const [fail, setFail] = useState<HkTask | null>(null);
  if (!can("hk.inspect")) return <NoAccess />;

  return (
    <div>
      <PageHeader title="Inspections" description="Rooms cleaned and waiting for a check. You cannot inspect a room you cleaned." />
      {isLoading ? <LoadingState label="Loading rooms…" />
        : data.length === 0 ? <EmptyState title="Nothing waiting" description="Completed rooms appear here for inspection." />
        : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.map((t) => {
              const own = t.completed_by === ctx.user_id;
              const p = checklistProgress(t.checklist);
              return (
                <li key={t.id} className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-base"><RoomName label={t.room_number} typeName={t.room_type_name} className="font-bold" /></div>
                      <div className="text-sm text-muted-foreground">{TASK_TYPES[t.type]}{t.floor ? ` · Floor ${t.floor}` : ""}</div>
                    </div>
                    {t.fail_count > 0 && <Badge variant="warning">Re-clean</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Initials name={t.completed_by_name} className="size-6 text-[11px]" />
                    <span className="min-w-0">Cleaned by {t.completed_by_name ?? "unknown"} <span className="text-muted-foreground tabular">· {formatDateTime(t.completed_at)}</span></span>
                  </div>
                  {p.total > 0 && (
                    <div className="space-y-1">
                      <ProgressBar done={p.done} total={p.total} label={`Checklist for room ${t.room_number}`} />
                      <p className="text-sm text-muted-foreground tabular">Checklist: {p.done} of {p.total} ticked</p>
                    </div>
                  )}
                  {t.notes && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{t.notes}</p>}
                  {own ? <p className="text-sm text-muted-foreground">You cleaned this room</p> : (
                    <div className="flex gap-2">
                      <Button className="h-11 flex-1" onClick={() => setPass(t)}>Pass</Button>
                      <Button className="h-11 flex-1" variant="destructive" onClick={() => setFail(t)}>Fail</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      <PassDialog task={pass} onOpenChange={(o) => !o && setPass(null)} />
      <FailDialog task={fail} onOpenChange={(o) => !o && setFail(null)} />
    </div>
  );
}

function PassDialog({ task, onOpenChange }: { task: HkTask | null; onOpenChange: (o: boolean) => void }) {
  const m = useHkMutation("inspect_hk_task", "Inspection passed. Room updated.");
  const [result, setResult] = useState("inspected");
  const [notes, setNotes] = useState("");
  useEffect(() => { if (task) { setResult("inspected"); setNotes(""); } }, [task]);
  return (
    <FormDialog open={!!task} onOpenChange={onOpenChange} title={`Pass · ${task?.room_number ?? ""}`} busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: task!.id, p_pass: true, p_result: result, p_notes: notes || null }, { onSuccess: () => onOpenChange(false) })}>
      <Field label="Mark room as" htmlFor="p-res">
        <Select value={result} onValueChange={setResult}>
          <SelectTrigger id="p-res"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="inspected">Inspected</SelectItem><SelectItem value="clean">Clean</SelectItem></SelectContent>
        </Select>
      </Field>
      <Field label="Notes (optional)" htmlFor="p-notes"><Textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    </FormDialog>
  );
}

function FailDialog({ task, onOpenChange }: { task: HkTask | null; onOpenChange: (o: boolean) => void }) {
  const m = useHkMutation("inspect_hk_task", "Inspection failed. Task sent back to the attendant.");
  const [defects, setDefects] = useState("");
  useEffect(() => { if (task) setDefects(""); }, [task]);
  return (
    <FormDialog open={!!task} onOpenChange={onOpenChange} title={`Fail · ${task?.room_number ?? ""}`} busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: task!.id, p_pass: false, p_defects: defects.split("\n").map((d) => d.trim()).filter(Boolean) },
        { onSuccess: () => onOpenChange(false) })}>
      <div role="group" aria-label="Common problems" className="flex flex-wrap gap-2">
        {COMMON_DEFECTS.map((d) => {
          const on = defects.split("\n").some((l) => l.trim().toLowerCase() === d.toLowerCase());
          return (
            <button key={d} type="button" aria-pressed={on} onClick={() => setDefects(on ? removeDefectLine(defects, d) : addDefectLine(defects, d))}
              className={cn("min-h-11 rounded-full border px-3.5 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                on ? "border-destructive/40 bg-danger-soft text-danger-strong" : "border-border bg-card text-foreground hover:bg-muted")}>{d}</button>
          );
        })}
      </div>
      <Field label="What needs fixing" htmlFor="f-def" hint="One item per line. The task goes back to the attendant with this list.">
        <Textarea id="f-def" required rows={5} value={defects} onChange={(e) => setDefects(e.target.value)} placeholder={"Hair in the shower\nTowels missing"} />
      </Field>
    </FormDialog>
  );
}
