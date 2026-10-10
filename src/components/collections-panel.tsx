// Collections follow-up (FIN-021): guests who left owing money, and a log of each chase.
// The balance and the next action date come from the database (collections_list). Nothing is added up here.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import { callRpc, Field, FormDialog } from "@/lib/setup";
import { useAccess } from "@/lib/access";
import { useReport } from "@/lib/reports";
import { formatDay } from "@/lib/reservations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export interface CollectionRow {
  folio_id: string; folio_number: string; reservation_id: string; reservation_number: string; guest_id: string | null;
  guest_name: string | null; phone: string | null; email: string | null; departure_date: string; days_overdue: number;
  currency: string; balance: number; notes_count: number; last_outcome: string | null; last_note: string | null;
  last_note_date: string | null; promised_date: string | null; next_action_date: string; follow_up_due: boolean;
}

const OUTCOMES: Record<string, string> = {
  called: "Called", promised: "Promised to pay", unreachable: "Unreachable", disputed: "Disputed", note: "Note",
};

export function CollectionsPanel() {
  const { property, can } = useAccess();
  const qc = useQueryClient();
  const list = useReport<CollectionRow>("collections_list", {}, true);
  const canLog = can("fin.payment.post");
  const [row, setRow] = useState<CollectionRow | null>(null);
  const [outcome, setOutcome] = useState("called");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const close = () => { setRow(null); setOutcome("called"); setNote(""); setDate(""); };
  const save = useMutation({
    mutationFn: () => callRpc("add_collection_note", {
      p_folio_id: row!.folio_id, p_outcome: outcome, p_note: note, p_promised_date: outcome === "promised" ? date : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reports", "collections_list"] }); toast.success("Follow-up saved."); close(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const due = (list.data ?? []).filter((r) => r.follow_up_due).length;
  const valid = note.trim().length > 0 && (outcome !== "promised" || !!date);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Guests who left without paying in full. A guest comes back to the top when it is time to chase again:
        the day after a promised date, or 7 days after the last note.
        {list.data && list.data.length > 0 ? ` ${due} due now.` : ""}
      </p>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Guest</TableHead><TableHead>Contact</TableHead><TableHead>Left</TableHead>
          <TableHead className="text-right">Owes</TableHead><TableHead>Last follow-up</TableHead><TableHead>Next</TableHead>
          {canLog && <TableHead className="text-right">Action</TableHead>}
        </TableRow></TableHeader>
        <TableBody>
          {list.isLoading && <TableSkeletonRows cols={canLog ? 7 : 6} />}
          {list.isError && <TableStateRow colSpan={canLog ? 7 : 6} title={errorMessage(list.error)} />}
          {!list.isLoading && !list.isError && (list.data ?? []).length === 0 && <TableStateRow colSpan={canLog ? 7 : 6} title="Nobody owes you money after check-out" />}
          {(list.data ?? []).map((r) => (
            <TableRow key={r.folio_id}>
              <TableCell>
                <Link to="/folios/$id" params={{ id: r.folio_id }} className="font-semibold text-primary underline-offset-4 hover:underline">{r.guest_name ?? "Guest"}</Link>
                <div className="text-sm text-muted-foreground">{r.reservation_number} · {r.folio_number}</div>
              </TableCell>
              <TableCell className="text-sm">{r.phone ?? "—"}{r.email && <div className="text-muted-foreground">{r.email}</div>}</TableCell>
              <TableCell className="tabular">{formatDay(r.departure_date)}<div className="text-sm text-muted-foreground">{r.days_overdue} {r.days_overdue === 1 ? "day" : "days"} ago</div></TableCell>
              <TableCell><Money amount={r.balance} currency={r.currency || property?.base_currency || "NGN"} className="font-semibold" /></TableCell>
              <TableCell className="max-w-xs text-sm">
                {r.last_outcome ? (
                  <>
                    <Badge variant={r.last_outcome === "disputed" ? "danger" : r.last_outcome === "promised" ? "info" : "neutral"}>{OUTCOMES[r.last_outcome] ?? r.last_outcome}</Badge>
                    {r.promised_date && <span className="ml-2 text-muted-foreground">by {formatDay(r.promised_date)}</span>}
                    <div className="mt-1 line-clamp-2 text-muted-foreground">{r.last_note}</div>
                  </>
                ) : <span className="text-muted-foreground">Not chased yet</span>}
              </TableCell>
              <TableCell>
                {r.follow_up_due ? <Badge variant="warning" dot>Due now</Badge> : <span className="tabular text-sm text-muted-foreground">{formatDay(r.next_action_date)}</span>}
              </TableCell>
              {canLog && <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setRow(r)}>Log follow-up</Button></TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {row && (
        <FormDialog open onOpenChange={(o) => !o && close()} title={`Follow-up: ${row.guest_name ?? "Guest"}`} busy={save.isPending}
          submitLabel="Save follow-up" submitDisabled={!valid} onSubmit={() => save.mutate()}>
          <Field label="What happened?" htmlFor="col-outcome">
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger id="col-outcome"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(OUTCOMES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {outcome === "promised" && (
            <Field label="Promised to pay by" htmlFor="col-date">
              <Input id="col-date" type="date" min={property?.business_date} value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
          )}
          <Field label="Note" htmlFor="col-note" hint="Who you spoke to and what they said. Do not write ID or card numbers.">
            <Textarea id="col-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} required />
          </Field>
        </FormDialog>
      )}
    </div>
  );
}
