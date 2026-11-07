import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Initials } from "@/components/dashboard-parts";
import { RoomName } from "@/components/room-name";
import { ConditionBadge } from "@/lib/rooms";
import { PriorityBadge, TASK_TYPES, TaskStatusBadge, type HkTask } from "@/lib/housekeeping";
import { checklistProgress, type Workload } from "@/lib/housekeeping-view";
import { cn } from "@/lib/utils";

/** A thin bar with the figures in words next to it, so colour is never the only signal. */
export function ProgressBar({ done, total, label, className }: { done: number; total: number; label: string; className?: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className={className}>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-2 overflow-hidden rounded-full bg-chart-track">
        <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** One task on the supervisor board. */
export function BoardCard({ t, actions }: { t: HkTask; actions?: ReactNode }) {
  const p = checklistProgress(t.checklist);
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-card p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base"><RoomName label={t.room_number} typeName={t.room_type_name} className="font-bold" /></div>
          <div className="text-sm text-muted-foreground">{TASK_TYPES[t.type]}{t.floor ? ` · Floor ${t.floor}` : ""}</div>
        </div>
        <PriorityBadge priority={t.priority} />
      </div>
      <div className="flex flex-wrap gap-1">
        <ConditionBadge condition={t.room_condition} />
        {t.is_occupied && <Badge variant="info">Occupied</Badge>}
        {t.status === "failed" && <TaskStatusBadge status="failed" />}
      </div>
      {t.defects.length > 0 && t.status === "failed" && <p className="text-sm text-danger-strong">Fix: {t.defects.join(", ")}</p>}
      {t.status === "in_progress" && p.total > 0 && (
        <div className="space-y-1">
          <ProgressBar done={p.done} total={p.total} label={`Checklist for room ${t.room_number}`} />
          <p className="text-sm text-muted-foreground tabular">{p.done} of {p.total} ticked</p>
        </div>
      )}
      <div className="flex items-center gap-2 text-sm">
        {t.assignee_name
          ? <><Initials name={t.assignee_name} className="size-6 text-[11px]" /><span className="min-w-0 truncate">{t.assignee_name}</span></>
          : <span className="text-muted-foreground">Not assigned</span>}
      </div>
      {t.inspected_by_name && t.status === "inspected" && <p className="text-sm text-muted-foreground">Inspected by {t.inspected_by_name}</p>}
      {actions}
    </div>
  );
}

/** Rooms a supervisor must act on now, with the action beside each. Hidden when there is nothing to do. */
export function NeedsAttention({ tasks, action }: { tasks: HkTask[]; action: (t: HkTask) => ReactNode }) {
  if (tasks.length === 0) return null;
  const shown = tasks.slice(0, 5);
  return (
    <section aria-labelledby="hk-attention" className="mb-5 rounded-xl border border-warning/40 bg-warning-soft/60 p-3 sm:p-4">
      <h2 id="hk-attention" className="mb-2 flex items-center gap-2 text-base font-bold">
        <AlertTriangle className="size-4 text-warning-strong" aria-hidden /> Needs attention <span className="tabular text-muted-foreground">({tasks.length})</span>
      </h2>
      <ul className="grid gap-2">
        {shown.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg bg-card px-3 py-2.5 shadow-xs">
            <div className="min-w-0">
              <RoomName label={t.room_number} typeName={t.room_type_name} className="font-bold" />
              <span className="block text-sm text-muted-foreground">
                {t.status === "failed" ? `Failed inspection${t.defects.length ? `: ${t.defects.join(", ")}` : ""}` : "Nobody assigned yet"} · {TASK_TYPES[t.type]}
              </span>
            </div>
            <div className="flex items-center gap-2"><PriorityBadge priority={t.priority} />{action(t)}</div>
          </li>
        ))}
      </ul>
      {tasks.length > shown.length && <p className="mt-2 text-sm text-muted-foreground">and {tasks.length - shown.length} more in the lists below.</p>}
    </section>
  );
}

/** Open work for each attendant, so a supervisor sees at a glance who has room for more. */
export function WorkloadStrip({ people }: { people: Workload[] }) {
  if (people.length === 0) return null;
  return (
    <section aria-labelledby="hk-load" className="mb-5">
      <h2 id="hk-load" className="mb-2 text-base font-bold">Workload</h2>
      <ul className="flex flex-wrap gap-2">
        {people.map((w) => (
          <li key={w.id} className={cn("flex items-center gap-2.5 rounded-full border border-border/70 bg-card py-1.5 pl-1.5 pr-3.5 shadow-xs")}>
            <Initials name={w.name} className="size-8" />
            <span className="text-sm font-semibold">{w.name}</span>
            <span className="text-sm text-muted-foreground tabular">{w.todo} to do · {w.working} working</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReassignButtons({ t, onAssign, onCancel }: { t: HkTask; onAssign: () => void; onCancel?: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" className="pointer-coarse:h-11" onClick={onAssign}>{t.assignee_id ? "Reassign" : "Assign"}</Button>
      {onCancel && <Button size="sm" variant="ghost" className="pointer-coarse:h-11" onClick={onCancel}>Cancel</Button>}
    </div>
  );
}
