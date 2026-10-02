import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAccess } from "@/lib/access";
import { NoAccess } from "@/lib/setup";
import { PriorityBadge, TASK_TYPES, TaskStatusBadge, useHkMutation, useHkTasks, type ChecklistItem, type HkTask } from "@/lib/housekeeping";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/_app/housekeeping/my-tasks")({ component: MyTasks });

function MyTasks() {
  const { can } = useAccess();
  const { data = [], isLoading } = useHkTasks({ mine: true });
  if (!can("hk.task.complete")) return <NoAccess />;
  const sorted = [...data].sort((a, b) => Number(b.status === "in_progress") - Number(a.status === "in_progress"));
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="My tasks" description="Start a room, tick the checklist, then complete it." />
      {isLoading ? <LoadingState label="Loading your tasks…" />
        : sorted.length === 0 ? <EmptyState title="No tasks for you" description="New tasks appear here when a supervisor assigns them." />
        : <div className="space-y-3">{sorted.map((t) => <TaskCard key={t.id} task={t} />)}</div>}
    </div>
  );
}

function TaskCard({ task }: { task: HkTask }) {
  const start = useHkMutation("start_hk_task", "Task started.");
  const complete = useHkMutation("complete_hk_task", "Done. Waiting for inspection.");
  const [list, setList] = useState<ChecklistItem[]>(task.checklist ?? []);
  const [notes, setNotes] = useState("");
  useEffect(() => setList(task.checklist ?? []), [task.id, task.status, task.checklist]);
  const working = task.status === "in_progress";
  const allDone = list.every((i) => i.done);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-2xl font-semibold">Room {task.room_number}</div>
            <div className="text-[15px] text-muted-foreground">{TASK_TYPES[task.type]} · {task.room_type_name}{task.floor ? ` · Floor ${task.floor}` : ""}</div>
          </div>
          <div className="flex flex-col items-end gap-1"><TaskStatusBadge status={task.status} /><PriorityBadge priority={task.priority} /></div>
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
            {allDone ? "Complete" : `Tick every item to complete (${list.filter((i) => i.done).length}/${list.length})`}
          </Button>
        ) : (
          <Button className="h-12 w-full text-base" disabled={start.isPending} onClick={() => start.mutate({ p_id: task.id })}>Start</Button>
        )}
      </CardContent>
    </Card>
  );
}
