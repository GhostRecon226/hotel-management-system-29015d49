import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAccess } from "@/lib/access";
import { NoAccess } from "@/lib/setup";
import { PriorityBadge, TASK_TYPES, TaskStatusBadge, useHkMutation, useHkTasks, type ChecklistItem, type HkTask } from "@/lib/housekeeping";
import { checklistProgress, dayProgress, groupByFloor, nextUp } from "@/lib/housekeeping-view";
import { ProgressBar } from "@/components/housekeeping-board";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/housekeeping/my-tasks")({
  head: () => ({ meta: [{ title: "My tasks · Zikora" }] }),
  component: MyTasks,
});

const LIVE = ["open", "assigned", "in_progress", "failed"];

function MyTasks() {
  const { can, property } = useAccess();
  const { data = [], isLoading } = useHkTasks({ mine: true, withFinished: true });
  if (!can("hk.task.complete")) return <NoAccess />;

  const bdate = property?.business_date ?? "";
  const today = data.filter((t) => LIVE.includes(t.status) || t.business_date === bdate || (t.completed_at ?? "").slice(0, 10) >= bdate);
  const todo = today.filter((t) => LIVE.includes(t.status));
  const { finished, total } = dayProgress(today);
  const next = nextUp(todo);
  const groups = groupByFloor(todo);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="My tasks" description="Start a room, tick the checklist, then complete it." />
      {isLoading ? <LoadingState label="Loading your tasks…" />
        : total === 0 ? <EmptyState title="No tasks for you" description="New tasks appear here when a supervisor assigns them." />
        : (
          <div className="space-y-5">
            <section aria-label="Your day" className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
              <p className="text-lg font-semibold tabular">{finished} of {total} rooms done today</p>
              <ProgressBar done={finished} total={total} label="Rooms done today" className="mt-2" />
              {todo.length === 0 && <p className="mt-2 text-sm text-muted-foreground">All your rooms are done. Well done.</p>}
            </section>
            {groups.map((g) => (
              <section key={g.floor || "none"} aria-labelledby={`floor-${g.floor || "none"}`} className="space-y-3">
                <h2 id={`floor-${g.floor || "none"}`} className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{g.floor ? `Floor ${g.floor}` : "No floor"}</h2>
                {g.tasks.map((t) => <TaskCard key={t.id} task={t} isNext={t.id === next?.id && todo.length > 1} />)}
              </section>
            ))}
          </div>
        )}
    </div>
  );
}

function TaskCard({ task, isNext }: { task: HkTask; isNext: boolean }) {
  const start = useHkMutation("start_hk_task", "Task started.");
  const complete = useHkMutation("complete_hk_task", "Done. Waiting for inspection.");
  const [list, setList] = useState<ChecklistItem[]>(task.checklist ?? []);
  const [notes, setNotes] = useState("");
  useEffect(() => setList(task.checklist ?? []), [task.id, task.status, task.checklist]);
  const working = task.status === "in_progress";
  const allDone = list.every((i) => i.done);
  const p = checklistProgress(list);

  return (
    <Card className={cn(isNext && "ring-2 ring-primary/60")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-2xl font-semibold">{task.room_number}</div>
            <div className="text-[15px] text-muted-foreground">{TASK_TYPES[task.type]} · {task.room_type_name}{task.floor ? ` · Floor ${task.floor}` : ""}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isNext && !working && <Badge variant="brand">Next up</Badge>}
            <TaskStatusBadge status={task.status} /><PriorityBadge priority={task.priority} />
          </div>
        </div>
        {task.status === "failed" && task.defects.length > 0 && (
          <div className="rounded-xl border border-destructive/30 bg-danger-soft px-4 py-2.5 text-sm text-danger-strong">
            <div className="font-medium">Inspection failed. Please fix:</div>
            <ul className="ml-5 list-disc">{task.defects.map((d) => <li key={d}>{d}</li>)}</ul>
          </div>
        )}
        {task.notes && <p className="text-[15px]">{task.notes}</p>}
        {working && (
          <>
            <div className="space-y-1">
              <ProgressBar done={p.done} total={p.total} label={`Checklist for room ${task.room_number}`} />
              <p className="text-sm text-muted-foreground tabular">{p.done} of {p.total} ticked</p>
            </div>
            <ul className="divide-y rounded-md border">
              {list.map((item, i) => (
                <li key={item.label}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 text-[15px]">
                    <Checkbox className="h-6 w-6" checked={item.done}
                      onCheckedChange={(v) => setList(list.map((x, j) => (j === i ? { ...x, done: !!v } : x)))} />
                    <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <Textarea placeholder="Notes for the supervisor (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </>
        )}
        {working ? (
          <Button className="h-12 w-full text-base" disabled={complete.isPending || !allDone}
            onClick={() => complete.mutate({ p_id: task.id, p_checklist: list, p_notes: notes || null })}>
            {allDone ? "Complete" : `Tick every item to complete (${p.done}/${p.total})`}
          </Button>
        ) : (
          <Button className="h-12 w-full text-base" disabled={start.isPending} onClick={() => start.mutate({ p_id: task.id })}>Start</Button>
        )}
      </CardContent>
    </Card>
  );
}
