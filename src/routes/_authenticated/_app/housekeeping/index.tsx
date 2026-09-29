import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useAccess } from "@/lib/access";
import {
  AssignDialog, CancelTaskDialog, NewTaskDialog, PriorityBadge, TASK_TYPES, TaskStatusBadge, useHkTasks, type HkTask,
} from "@/lib/housekeeping";
import { ConditionBadge } from "@/lib/rooms";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/_app/housekeeping/")({ component: Board });

const COLUMNS = [
  { key: "open", label: "Open" }, { key: "assigned", label: "Assigned" }, { key: "in_progress", label: "In progress" },
  { key: "waiting_inspection", label: "Waiting inspection" }, { key: "done", label: "Done" },
];

function Board() {
  const { can } = useAccess();
  const { data = [], isLoading } = useHkTasks();
  const [adding, setAdding] = useState(false);
  const [assign, setAssign] = useState<HkTask | null>(null);
  const [cancel, setCancel] = useState<HkTask | null>(null);
  const manage = can("hk.task.assign");

  return (
    <div>
      <PageHeader title="Housekeeping" description="Every cleaning task for today, from open to inspected."
        actions={manage && <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> New task</Button>} />
      {isLoading ? <LoadingState label="Loading tasks…" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {COLUMNS.map((c) => {
            const items = data.filter((t) => t.board_column === c.key);
            return (
              <section key={c.key} className="min-w-0 rounded-lg bg-muted/50 p-2">
                <h2 className="flex items-center justify-between px-1 pb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {c.label}<span className="tabular">{items.length}</span>
                </h2>
                <div className="space-y-2">
                  {items.length === 0 && <p className="px-1 py-4 text-center text-sm text-muted-foreground">Nothing here</p>}
                  {items.map((t) => (
                    <Card key={t.id}>
                      <CardContent className="space-y-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-lg font-semibold">Room {t.room_number}</div>
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
                        <p className="text-sm">{t.assignee_name ?? <span className="text-muted-foreground">Not assigned</span>}
                          {t.inspected_by_name && t.status === "inspected" && <span className="block text-muted-foreground">Inspected by {t.inspected_by_name}</span>}</p>
                        {manage && ["open", "assigned", "failed"].includes(t.status) && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setAssign(t)}>{t.assignee_id ? "Reassign" : "Assign"}</Button>
                            <Button size="sm" variant="ghost" onClick={() => setCancel(t)}>Cancel</Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <NewTaskDialog open={adding} onOpenChange={setAdding} />
      <AssignDialog task={assign} onOpenChange={(o) => !o && setAssign(null)} />
      <CancelTaskDialog task={cancel} onOpenChange={(o) => !o && setCancel(null)} />
    </div>
  );
}
