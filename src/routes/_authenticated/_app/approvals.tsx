import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAccess } from "@/lib/access";
import { NoAccess } from "@/lib/setup";
import { formatDateTime } from "@/lib/reservations";
import {
  APPROVAL_MENU_PERMS, APPROVE_PERM, DecideDialog, KIND_LABEL, useApprovals, useCanDecide, useWithdraw, type ApprovalRow,
} from "@/lib/approvals";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals — Zikora" },
      { name: "description", content: "Approve or reject discounts, adjustments, reversals and refunds." },
      { property: "og:title", content: "Approvals — Zikora" },
      { property: "og:description", content: "Approve or reject discounts, adjustments, reversals and refunds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Approvals,
});

const STATUS: Record<ApprovalRow["status"], { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  pending: { label: "Waiting", tone: "warning" }, approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" }, withdrawn: { label: "Withdrawn", tone: "neutral" },
};

function Approvals() {
  const { property, canAny, can, ctx } = useAccess();
  const { data = [], isLoading } = useApprovals(property?.id);
  const canDecide = useCanDecide();
  const withdraw = useWithdraw();
  const [decide, setDecide] = useState<{ a: ApprovalRow; approve: boolean } | null>(null);
  if (!canAny(APPROVAL_MENU_PERMS)) return <NoAccess />;

  const waiting = data.filter(canDecide);
  const mine = data.filter((a) => a.requested_by === ctx.user_id);
  const decided = data.filter((a) => a.status !== "pending");

  const table = (rows: ApprovalRow[], mode: "waiting" | "mine" | "decided", empty: string) => (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Request</TableHead><TableHead>Folio</TableHead><TableHead>Reason</TableHead>
        <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead className="w-56" />
      </TableRow></TableHeader>
      <TableBody>
        {isLoading && <TableSkeletonRows cols={6} />}
        {!isLoading && rows.length === 0 && <TableStateRow colSpan={6} title={empty} />}
        {rows.map((a) => (
          <TableRow key={a.id}>
            <TableCell>
              <span className="font-medium">{KIND_LABEL[a.kind]}</span>
              <span className="block text-sm text-muted-foreground">{a.requested_by_name ?? "—"} · {formatDateTime(a.requested_at)}</span>
            </TableCell>
            <TableCell>
              <Link to="/folios/$id" params={{ id: a.folio_id }} className="font-medium text-primary-strong hover:underline">{a.folio_number}</Link>
              <span className="block text-sm text-muted-foreground">{a.guest_name ?? ""}{a.transaction_description ? ` · ${a.transaction_description}` : ""}</span>
            </TableCell>
            <TableCell>{a.reason}
              {a.decision_reason && <span className="block text-sm text-muted-foreground">{a.decided_by_name ?? "Approver"}: {a.decision_reason}</span>}
            </TableCell>
            <TableCell><Money amount={Math.abs(a.amount)} currency={a.currency} /></TableCell>
            <TableCell><Badge variant={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge></TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {mode === "waiting" && <>
                  <Button size="sm" onClick={() => setDecide({ a, approve: true })}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => setDecide({ a, approve: false })}>Reject</Button>
                </>}
                {mode === "mine" && a.status === "pending" && <>
                  {can(APPROVE_PERM[a.kind]) && <Button size="sm" variant="ghost" onClick={() => setDecide({ a, approve: true })}>Approve</Button>}
                  <Button size="sm" variant="outline" onClick={() => withdraw(a.id)}>Withdraw</Button>
                </>}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div>
      <PageHeader title="Approvals" description="Discounts above a limit, adjustments, reversals and refunds need a second person to approve." />
      <Tabs defaultValue="waiting">
        <TabsList className="mb-3">
          <TabsTrigger value="waiting">Waiting for me ({waiting.length})</TabsTrigger>
          <TabsTrigger value="mine">My requests ({mine.filter((a) => a.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="decided">Decided</TabsTrigger>
        </TabsList>
        <TabsContent value="waiting">{table(waiting, "waiting", "Nothing is waiting for you")}</TabsContent>
        <TabsContent value="mine">{table(mine, "mine", "You have not asked for anything")}</TabsContent>
        <TabsContent value="decided">{table(decided, "decided", "No decided requests yet")}</TabsContent>
      </Tabs>
      <DecideDialog approval={decide?.a ?? null} approve={decide?.approve ?? true} onOpenChange={(o) => !o && setDecide(null)} />
    </div>
  );
}
