import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCheck, ClipboardCheck, Plus, Sparkles, SprayCan } from "lucide-react";
import { useAccess } from "@/lib/access";
import { AssignDialog, CancelTaskDialog, NewTaskDialog, useHkTasks, type HkTask } from "@/lib/housekeeping";
import { needsAttention, workload } from "@/lib/housekeeping-view";
import { BoardCard, NeedsAttention, ReassignButtons, WorkloadStrip } from "@/components/housekeeping-board";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stats";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/housekeeping/")({
  head: () => ({ meta: [{ title: "Housekeeping · Zikora" }] }),
  component: Board,
});

type Phone = "todo" | "working" | "inspect" | "done";

/** Five columns on a large screen. On a phone they fold into four lists: Open and Assigned share "To do". */
const COLUMNS: { key: string; label: string; phone: Phone }[] = [
  { key: "open", label: "Open", phone: "todo" }, { key: "assigned", label: "Assigned", phone: "todo" },
  { key: "in_progress", label: "In progress", phone: "working" }, { key: "waiting_inspection", label: "Waiting inspection", phone: "inspect" },
  { key: "done", label: "Done", phone: "done" },
];
const PHONE_LABEL: Record<Phone, string> = { todo: "To do", working: "Working", inspect: "Inspect", done: "Done" };

function Board() {
  const { can } = useAccess();
  const { data = [], isLoading } = useHkTasks();
  const [adding, setAdding] = useState(false);
  const [assign, setAssign] = useState<HkTask | null>(null);
  const [cancel, setCancel] = useState<HkTask | null>(null);
  const [view, setView] = useState<Phone>("todo");
  const manage = can("hk.task.assign");

  const count = (col: string) => data.filter((t) => t.board_column === col).length;
  const toClean = count("open") + count("assigned") + data.filter((t) => t.status === "failed").length;
  const attention = needsAttention(data);
  const phoneCount = (p: Phone) => COLUMNS.filter((c) => c.phone === p).reduce((n, c) => n + count(c.key), 0);

  return (
    <div>
      <PageHeader title="Housekeeping" description="Every cleaning task for today, from open to inspected."
        actions={manage && <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> New task</Button>} />
      {isLoading ? <LoadingState label="Loading tasks…" /> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile icon={SprayCan} tone="warning" label="To clean" value={toClean} sub="Open, assigned or sent back" />
            <StatTile icon={Sparkles} tone="info" label="Being cleaned" value={count("in_progress")} sub="Started by an attendant" />
            <StatTile icon={ClipboardCheck} tone="accent" label="Waiting inspection" value={count("waiting_inspection")} sub="Cleaned, not yet checked" />
            <StatTile icon={CheckCheck} tone="success" label="Rooms ready" value={count("done")} sub="Passed inspection today" />
          </div>

          {manage && <NeedsAttention tasks={attention} action={(t) => <ReassignButtons t={t} onAssign={() => setAssign(t)} />} />}
          <WorkloadStrip people={workload(data)} />

          <div role="group" aria-label="Show" className="mb-4 grid grid-cols-4 gap-1 rounded-xl bg-muted p-1 md:hidden">
            {(Object.keys(PHONE_LABEL) as Phone[]).map((p) => (
              <button key={p} type="button" aria-pressed={view === p} onClick={() => setView(p)}
                className={cn("min-h-11 rounded-lg px-1 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/40", view === p ? "bg-card text-foreground shadow-card" : "text-muted-foreground")}>
                {PHONE_LABEL[p]} <span className="tabular">{phoneCount(p)}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {COLUMNS.map((c) => {
              const items = data.filter((t) => t.board_column === c.key);
              return (
                <section key={c.key} className={cn("min-w-0 rounded-xl border border-border/60 bg-muted/60 p-2.5", c.phone !== view && "max-md:hidden")}>
                  <h2 className="flex items-center justify-between px-1 pb-2.5 text-sm font-bold text-foreground">
                    {c.label}<span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular shadow-xs">{items.length}</span>
                  </h2>
                  <div className="space-y-2">
                    {items.length === 0 && <p className="px-1 py-4 text-center text-sm text-muted-foreground">Nothing here</p>}
                    {items.map((t) => (
                      <BoardCard key={t.id} t={t}
                        actions={manage && ["open", "assigned", "failed"].includes(t.status)
                          ? <ReassignButtons t={t} onAssign={() => setAssign(t)} onCancel={() => setCancel(t)} /> : undefined} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
      <NewTaskDialog open={adding} onOpenChange={setAdding} />
      <AssignDialog task={assign} onOpenChange={(o) => !o && setAssign(null)} />
      <CancelTaskDialog task={cancel} onOpenChange={(o) => !o && setCancel(null)} />
    </div>
  );
}
