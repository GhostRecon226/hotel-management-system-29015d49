import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccess } from "@/lib/access";
import { callRpc, Field, NoAccess, SectionHeader } from "@/lib/setup";
import { formatDateTime } from "@/lib/reservations";
import { useAdminUsers, type AuditRow } from "@/lib/admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ANY = "__any";

const ACTION_LABEL: Record<string, string> = { insert: "Added", update: "Changed", delete: "Removed" };

function Diff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]))
    .filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
  if (keys.length === 0) return <span className="text-sm text-muted-foreground">No field changes</span>;
  const show = (v: unknown) => (v === undefined || v === null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return (
    <div className="space-y-0.5 text-sm">
      {keys.slice(0, 8).map((k) => (
        <div key={k}>
          <span className="text-muted-foreground">{k.replace(/_/g, " ")}: </span>
          <span className="line-through opacity-70">{show(before?.[k])}</span>
          <span className="mx-1">→</span>
          <span className="font-medium">{show(after?.[k])}</span>
        </div>
      ))}
      {keys.length > 8 && <div className="text-muted-foreground">and {keys.length - 8} more</div>}
    </div>
  );
}

export function AuditPanel() {
  const { can } = useAccess();
  const allowed = can("adm.audit.view");
  const users = useAdminUsers(allowed && can("adm.user.manage"));
  const [actor, setActor] = useState(ANY);
  const [table, setTable] = useState(ANY);
  const [action, setAction] = useState(ANY);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filters = useQuery({
    queryKey: ["admin", "audit-filters"], enabled: allowed,
    queryFn: () => callRpc<{ tables: string[]; actions: string[]; people: { id: string; full_name: string }[] }>("audit_filters", {}),
  });

  const log = useQuery({
    queryKey: ["admin", "audit", actor, table, action, from, to], enabled: allowed,
    queryFn: () => callRpc<AuditRow[]>("audit_log", {
      p_actor: actor === ANY ? null : actor,
      p_table: table === ANY ? null : table,
      p_action: action === ANY ? null : action,
      p_from: from || null,
      p_to: to || null,
      p_limit: 200,
    }),
  });

  if (!allowed) return <NoAccess />;
  const people = filters.data?.people ?? (users.data ?? []).map((u) => ({ id: u.id, full_name: u.full_name }));
  const rows = log.data ?? [];

  return (
    <Card>
      <CardContent className="pt-6">
        <SectionHeader title="Audit log" description="Who changed what, and when. The 200 most recent matches are shown." />
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Person" htmlFor="au-actor">
            <Select value={actor} onValueChange={setActor}>
              <SelectTrigger id="au-actor"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Everyone</SelectItem>
                {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Record type" htmlFor="au-table">
            <Select value={table} onValueChange={setTable}>
              <SelectTrigger id="au-table"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All</SelectItem>
                {(filters.data?.tables ?? []).map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="What happened" htmlFor="au-action">
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger id="au-action"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All</SelectItem>
                {(filters.data?.actions ?? []).map((a) => <SelectItem key={a} value={a}>{ACTION_LABEL[a] ?? a}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="From" htmlFor="au-from"><Input id="au-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To" htmlFor="au-to"><Input id="au-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-44">When</TableHead><TableHead>Person</TableHead><TableHead>Record</TableHead>
            <TableHead className="w-28">Action</TableHead><TableHead>Change</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {log.isLoading && <TableSkeletonRows cols={5} />}
            {!log.isLoading && rows.length === 0 && <TableStateRow colSpan={5} title="Nothing found" description="Try a wider date range." />}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular text-sm">{formatDateTime(r.created_at)}</TableCell>
                <TableCell className="text-sm">{r.actor_name}</TableCell>
                <TableCell className="text-sm">{(r.table_name ?? "—").replace(/_/g, " ")}</TableCell>
                <TableCell><Badge variant={r.action === "delete" ? "danger" : r.action === "insert" ? "success" : "info"}>{ACTION_LABEL[r.action] ?? r.action}</Badge></TableCell>
                <TableCell>
                  <Diff before={r.before} after={r.after} />
                  {r.reason && <div className="mt-1 text-sm text-muted-foreground">Reason: {r.reason}</div>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
