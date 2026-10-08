// Support access (PLT-010): the hotel decides whether our support staff may look at its account.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import { callRpc, Field, FormDialog } from "@/lib/setup";
import { formatDateTime } from "@/lib/reservations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface SupportGrant {
  id: string; requested_by_email: string; reason: string; hours_requested: number; status: string;
  requested_at: string; decided_at: string | null; expires_at: string | null; views: number;
}
export const SUPPORT_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  requested: { label: "Waiting for you", tone: "warning" }, granted: { label: "Allowed", tone: "success" },
  denied: { label: "Refused", tone: "neutral" }, revoked: { label: "Stopped", tone: "neutral" }, expired: { label: "Ended", tone: "neutral" },
};

export function SupportPanel() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["support-access"], queryFn: () => callRpc<SupportGrant[]>("list_support_access", {}) });
  const [approving, setApproving] = useState<SupportGrant | null>(null);
  const [hours, setHours] = useState("24");
  const done = (msg: string) => { qc.invalidateQueries({ queryKey: ["support-access"] }); toast.success(msg); };
  const decide = useMutation({
    mutationFn: (v: { id: string; approve: boolean; hours: number | null }) =>
      callRpc("decide_support_access", { p_id: v.id, p_approve: v.approve, p_hours: v.hours }),
    onSuccess: (_d, v) => { done(v.approve ? "Access allowed." : "Request refused."); setApproving(null); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => callRpc("revoke_support_access", { p_id: id }),
    onSuccess: () => done("Access stopped."),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const h = Number(hours);
  const validHours = Number.isInteger(h) && h >= 1 && h <= 72;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Support access</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Our support team can ask to look at your hotel account when you need help. Nothing opens until you allow it, and it stops when the time ends or when you stop it.</p>
          <p>Support sees your plan, dates, room and staff counts, and whether messages and the daily rollover are working. Support never sees guests, ID documents, bookings or money.</p>
          <p>Every request, decision and view is saved in your audit log.</p>
        </CardContent>
      </Card>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Asked</TableHead><TableHead>By</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead>
          <TableHead>Ends</TableHead><TableHead>Views</TableHead><TableHead className="text-right">Action</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {list.isLoading && <TableSkeletonRows rows={3} cols={7} />}
          {list.isError && <TableStateRow colSpan={7} title={errorMessage(list.error)} />}
          {list.data?.length === 0 && <TableStateRow colSpan={7} title="No requests yet." />}
          {list.data?.map((g) => {
            const s = SUPPORT_STATUS[g.status] ?? { label: g.status, tone: "neutral" as const };
            return (
              <TableRow key={g.id}>
                <TableCell>{formatDateTime(g.requested_at)}</TableCell>
                <TableCell>{g.requested_by_email}</TableCell>
                <TableCell className="max-w-xs">{g.reason} <span className="text-muted-foreground">(asked for {g.hours_requested} h)</span></TableCell>
                <TableCell><Badge variant={s.tone} dot>{s.label}</Badge></TableCell>
                <TableCell>{g.status === "granted" && g.expires_at ? formatDateTime(g.expires_at) : "—"}</TableCell>
                <TableCell>{g.views}</TableCell>
                <TableCell className="space-x-2 text-right">
                  {g.status === "requested" && (<>
                    <Button size="sm" onClick={() => { setHours(String(g.hours_requested)); setApproving(g); }}>Allow</Button>
                    <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: g.id, approve: false, hours: null })}>Refuse</Button>
                  </>)}
                  {g.status === "granted" && (
                    <Button size="sm" variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate(g.id)}>Stop access</Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {approving && (
        <FormDialog open onOpenChange={(o) => !o && setApproving(null)} title="Allow support access" busy={decide.isPending}
          submitLabel="Allow access" submitDisabled={!validHours}
          onSubmit={() => decide.mutate({ id: approving.id, approve: true, hours: h })}>
          <p className="text-[15px]">{approving.requested_by_email} asked: {approving.reason}</p>
          <Field label="Allow for how many hours?" htmlFor="sa-hours" hint="Between 1 and 72. You can stop access earlier.">
            <Input id="sa-hours" type="number" min={1} max={72} value={hours} onChange={(e) => setHours(e.target.value)} required />
          </Field>
        </FormDialog>
      )}
    </div>
  );
}
