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
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/housekeeping/inspections")({ component: Inspections });

function Inspections() {
  const { can, ctx } = useAccess();
  const { data = [], isLoading } = useHkTasks({ column: "waiting_inspection" });
  const [pass, setPass] = useState<HkTask | null>(null);
  const [fail, setFail] = useState<HkTask | null>(null);
  if (!can("hk.inspect")) return <NoAccess />;

  return (
    <div>
      <PageHeader title="Inspections" description="Rooms cleaned and waiting for a check. You cannot inspect a room you cleaned." />
      <Table>
        <TableHeader><TableRow>
          <TableHead>Room</TableHead><TableHead>Task</TableHead><TableHead>Cleaned by</TableHead><TableHead>Finished</TableHead><TableHead className="w-56" />
        </TableRow></TableHeader>
        <TableBody>
          {isLoading && <TableSkeletonRows cols={5} />}
          {!isLoading && data.length === 0 && <TableStateRow colSpan={5} title="Nothing waiting" description="Completed rooms appear here for inspection." />}
          {data.map((t) => {
            const own = t.completed_by === ctx.user_id;
            return (
              <TableRow key={t.id}>
                <TableCell className="text-base font-semibold">Room {t.room_number}</TableCell>
                <TableCell>{TASK_TYPES[t.type]}{t.fail_count > 0 && <Badge variant="warning" className="ml-2">Re-clean</Badge>}
                  {t.notes && <span className="block text-sm text-muted-foreground">{t.notes}</span>}</TableCell>
                <TableCell>{t.completed_by_name ?? "—"}</TableCell>
                <TableCell className="tabular">{formatDateTime(t.completed_at)}</TableCell>
                <TableCell className="text-right">
                  {own ? <span className="text-sm text-muted-foreground">You cleaned this room</span> : (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => setPass(t)}>Pass</Button>
                      <Button size="sm" variant="destructive" onClick={() => setFail(t)}>Fail</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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
    <FormDialog open={!!task} onOpenChange={onOpenChange} title={`Pass · Room ${task?.room_number ?? ""}`} busy={m.isPending}
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
    <FormDialog open={!!task} onOpenChange={onOpenChange} title={`Fail · Room ${task?.room_number ?? ""}`} busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: task!.id, p_pass: false, p_defects: defects.split("\n").map((d) => d.trim()).filter(Boolean) },
        { onSuccess: () => onOpenChange(false) })}>
      <Field label="What needs fixing" htmlFor="f-def" hint="One item per line. The task goes back to the attendant with this list.">
        <Textarea id="f-def" required rows={5} value={defects} onChange={(e) => setDefects(e.target.value)} placeholder={"Hair in the shower\nTowels missing"} />
      </Field>
    </FormDialog>
  );
}
