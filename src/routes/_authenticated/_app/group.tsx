import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Copy } from "lucide-react";
import { useAccess } from "@/lib/access";
import { Field, FormDialog, NoAccess, useSetupMutation } from "@/lib/setup";
import { useGroupOverview } from "@/lib/group";
import { formatPercent } from "@/lib/reports";
import { formatDay } from "@/lib/reservations";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/group")({
  head: () => ({
    meta: [
      { title: "All branches — Zikora" },
      { name: "description", content: "Occupancy, arrivals, approvals and last night's revenue for every branch in one view." },
    ],
  }),
  component: GroupPage,
});

function GroupPage() {
  const { can, ctx, setPropertyId } = useAccess();
  const navigate = useNavigate();
  const allowed = can("rpt.group.view");
  const q = useGroupOverview(allowed);
  const [copyOpen, setCopyOpen] = useState(false);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const copy = useSetupMutation("copy_property_setup", [], (d: { room_types: number; rate_plans: number }) =>
    `Copied ${d.room_types} room types and ${d.rate_plans} rate plans.`);
  const branches = ctx.properties ?? [];

  if (!allowed) return <NoAccess />;
  const rows = q.data?.properties ?? [];
  const t = q.data?.totals;

  function openBranch(id: string) {
    setPropertyId(id);
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="All branches"
        description="One look at every branch you manage. Figures come from each branch's own business date."
        actions={can("setup.room.manage") && can("setup.rate.manage") && branches.length > 1 ? (
          <Button variant="outline" onClick={() => setCopyOpen(true)}><Copy className="mr-2 size-4" /> Copy setup to a branch</Button>
        ) : undefined}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile icon={Building2} tone="accent" label="Branches" value={t?.properties} sub={`${t?.rooms_total ?? 0} rooms in total`} />
        <StatTile icon={Building2} tone="info" label="Occupancy now" value={formatPercent(t?.occupancy == null ? null : Number(t.occupancy))} sub={`${t?.rooms_occupied ?? 0} rooms occupied`} />
        <StatTile icon={Building2} tone="accent" label="Arrivals still to come" value={t?.arrivals_pending} sub={`${t?.departures_pending ?? 0} still to leave`} />
        <StatTile icon={Building2} tone="warning" label="Waiting for approval" value={t?.pending_approvals} sub={`${t?.urgent_tickets ?? 0} urgent repairs`} />
      </div>

      {t && Object.keys(t.revenue_by_currency).length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>Last night's revenue:</span>
          {Object.entries(t.revenue_by_currency).map(([cur, amount]) => (
            <span key={cur} className="font-semibold text-foreground"><Money amount={amount} currency={cur} /></span>
          ))}
        </div>
      )}

      <Table wide>
        <TableHeader>
          <TableRow>
            <TableHead>Branch</TableHead>
            <TableHead>Business date</TableHead>
            <TableHead className="text-right">Occupancy</TableHead>
            <TableHead className="text-right">In house</TableHead>
            <TableHead className="text-right">Arrivals to come</TableHead>
            <TableHead className="text-right">Departures to go</TableHead>
            <TableHead className="text-right">Approvals</TableHead>
            <TableHead className="text-right">Repairs</TableHead>
            <TableHead className="text-right">Last night</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading ? <TableSkeletonRows rows={3} cols={9} /> : rows.length === 0 ? (
            <TableStateRow colSpan={9} title="No branches to show" description="Ask an administrator to give you the Group Manager role on each branch." />
          ) : rows.map((r) => (
            <TableRow key={r.property_id}>
              <TableCell>
                <button type="button" className="min-h-9 text-left font-semibold text-primary hover:underline" onClick={() => openBranch(r.property_id)}>{r.name}</button>
                <div className="text-xs text-muted-foreground">{[r.city, r.code].filter(Boolean).join(" · ")}</div>
              </TableCell>
              <TableCell className="tabular">{formatDay(r.business_date)}</TableCell>
              <TableCell className="text-right tabular">{formatPercent(r.occupancy == null ? null : Number(r.occupancy))}</TableCell>
              <TableCell className="text-right tabular">{r.in_house}</TableCell>
              <TableCell className="text-right tabular">{r.arrivals_pending}</TableCell>
              <TableCell className="text-right tabular">{r.departures_pending}</TableCell>
              <TableCell className="text-right tabular">{r.pending_approvals > 0 ? <Badge variant="warning">{r.pending_approvals}</Badge> : 0}</TableCell>
              <TableCell className="text-right tabular">
                {r.open_tickets}{r.urgent_tickets > 0 && <> <Badge variant="danger">{r.urgent_tickets} urgent</Badge></>}
              </TableCell>
              <TableCell className="text-right"><Money amount={r.last_night_revenue} currency={r.base_currency} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <FormDialog
        open={copyOpen} onOpenChange={setCopyOpen} title="Copy setup to a branch" busy={copy.isPending}
        submitLabel="Copy" submitDisabled={!source || !target || source === target}
        onSubmit={() => copy.mutate({ p_source_property_id: source, p_target_property_id: target }, { onSuccess: () => setCopyOpen(false) })}
      >
        <Field label="Copy from" htmlFor="cp-src">
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger id="cp-src"><SelectValue placeholder="Choose a branch" /></SelectTrigger>
            <SelectContent>{branches.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Copy to" htmlFor="cp-dst" hint="The new branch must have no room types or rates yet.">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="cp-dst"><SelectValue placeholder="Choose a branch" /></SelectTrigger>
            <SelectContent>{branches.filter((p) => p.id !== source).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <p className="text-sm text-muted-foreground">Copies room types, rate plans and prices. Rooms are not copied, so add the new branch's own rooms after.</p>
      </FormDialog>
    </div>
  );
}
