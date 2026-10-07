import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { errorMessage } from "@/lib/errors";
import { callRpc, NoAccess } from "@/lib/setup";
import { ADMIN_PERMS } from "@/lib/admin";
import { formatDateTime, formatDay } from "@/lib/reservations";
import { NightAuditFlags } from "@/lib/cashier";
import { UsersPanel } from "@/components/admin/users-panel";
import { RolesPanel } from "@/components/admin/roles-panel";
import { LimitsPanel } from "@/components/admin/limits-panel";
import { AuditPanel } from "@/components/admin/audit-panel";
import { SubscriptionPanel } from "@/components/admin/subscription-panel";
import { OutboxPanel } from "@/components/admin/outbox-panel";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { AiPanel } from "@/components/admin/ai-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/_authenticated/_app/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Hotel Desk" },
      { name: "description", content: "Staff, roles, approval limits, audit log, subscription and the business date." },
      { property: "og:title", content: "Admin — Hotel Desk" },
      { property: "og:description", content: "Staff, roles, approval limits, audit log, subscription and the business date." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { can, canAny } = useAccess();
  const [tab, setTab] = useState<string | null>(null);
  // Coming back from the payment page lands on /admin#plan: open the Subscription tab.
  useEffect(() => { if (window.location.hash === "#plan") setTab("plan"); }, []);
  if (!canAny(["fin.nightaudit.run", ...ADMIN_PERMS])) return <NoAccess />;

  const tabs = [
    can("adm.user.manage") && { value: "users", label: "Staff", node: <UsersPanel /> },
    canAny(["adm.role.manage", "adm.user.manage"]) && { value: "roles", label: "Roles", node: <RolesPanel /> },
    can("adm.role.manage") && { value: "limits", label: "Approval limits", node: <LimitsPanel /> },
    can("adm.audit.view") && { value: "audit", label: "Audit log", node: <AuditPanel /> },
    canAny(["adm.subscription.manage", "adm.user.manage"]) && { value: "plan", label: "Subscription", node: <SubscriptionPanel /> },
    canAny(["fin.nightaudit.run", "adm.audit.view"]) && { value: "date", label: "Business date", node: <BusinessDate /> },
    can("adm.user.manage") && { value: "outbox", label: "Messages", node: <OutboxPanel /> },
    can("adm.ai.manage") && { value: "ai", label: "AI helpers", node: <AiPanel /> },
  ].filter(Boolean) as { value: string; label: string; node: React.ReactNode }[];

  if (tabs.length === 0) return <NoAccess />;

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" description="Staff, roles, limits, history and your subscription." />
      <Tabs value={tabs.some((t) => t.value === tab) ? tab! : tabs[0]!.value} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {tabs.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
        {tabs.map((t) => <TabsContent key={t.value} value={t.value} className="mt-4">{t.node}</TabsContent>)}
      </Tabs>
    </div>
  );
}

interface RollStatus { business_date: string; rollover_time: string; timezone: string; next_roll_at: string; is_due: boolean }
interface LogRow { id: string; from_date: string; to_date: string; status: string; trigger: string; finished_at: string; details: { room_charges?: number; holds_expired?: number; no_shows?: number; stayover_tasks?: number }; error: string | null }

function BusinessDate() {
  const { property, can } = useAccess();
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["admin", "roll-status", property?.id], enabled: !!property,
    queryFn: () => callRpc<RollStatus>("rollover_status", { p_property_id: property!.id }),
  });
  const log = useQuery({
    queryKey: ["admin", "roll-log", property?.id], enabled: !!property,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("business_date_log").select("*").eq("property_id", property!.id).order("finished_at", { ascending: false }).limit(60);
      if (error) throw error;
      return data as LogRow[];
    },
  });
  const [time, setTime] = useState("03:00");
  useEffect(() => { if (status.data) setTime(status.data.rollover_time.slice(0, 5)); }, [status.data]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["reports"] }); };
  const save = useMutation({
    mutationFn: () => callRpc("set_rollover_time", { p_property_id: property!.id, p_time: time }),
    onSuccess: () => { toast.success("Roll time saved."); refresh(); }, onError: (e) => toast.error(errorMessage(e)),
  });
  const run = useMutation({
    mutationFn: () => callRpc<{ status: string; error?: string }[]>("run_due_rollovers_now", {}),
    onSuccess: (res) => {
      const failed = res.filter((r) => r.status === "failed");
      if (res.length === 0) toast.info("No property is due to roll yet.");
      else if (failed.length) toast.error(`Roll failed: ${errorMessage({ message: failed[0]!.error })}`);
      else toast.success(`Business date rolled (${res.length}).`);
      // A roll changes the business date and nearly every screen's figures, so refetch everything.
      if (res.length) qc.invalidateQueries(); else refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const manager = can("fin.nightaudit.run");
  const s = status.data;

  return (
    <div className="space-y-6">
      <NightAuditFlags />
      <Card>
        <CardHeader><CardTitle>Business date</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><div className="text-sm text-muted-foreground">Current business date</div><div className="text-2xl font-semibold tabular">{s ? formatDay(s.business_date) : "—"}</div></div>
            <div><div className="text-sm text-muted-foreground">Next roll</div><div className="text-lg tabular">{s ? `${formatDay(s.next_roll_at.slice(0, 10))} at ${s.rollover_time.slice(0, 5)}` : "—"}</div><div className="text-sm text-muted-foreground">{s?.timezone}</div></div>
            <div>{s?.is_due ? <Badge variant="warning">Due now</Badge> : <Badge variant="success">Up to date</Badge>}</div>
          </div>
          <p className="text-sm text-muted-foreground">
            The date rolls by itself within 5 minutes of the roll time. Each roll posts room charges, cancels expired tentative holds,
            marks confirmed guests who did not arrive as no-shows, creates stayover cleaning tasks and saves the day's figures.
            If anything fails, nothing changes and managers get a notification.
          </p>
          {manager && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5"><Label htmlFor="roll-time">Roll time (property time)</Label><Input id="roll-time" type="time" className="w-36" value={time} onChange={(e) => setTime(e.target.value)} /></div>
              <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>Save time</Button>
              <Button disabled={run.isPending} onClick={() => run.mutate()}>Run due rolls now</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Roll history</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Closed date</TableHead><TableHead>Result</TableHead><TableHead>How</TableHead><TableHead>What happened</TableHead><TableHead>When</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {log.isLoading && <TableSkeletonRows cols={5} />}
              {!log.isLoading && (log.data ?? []).length === 0 && <TableStateRow colSpan={5} title="No rolls yet" />}
              {(log.data ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="tabular">{formatDay(l.from_date)} → {formatDay(l.to_date)}</TableCell>
                  <TableCell>{l.status === "success" ? <Badge variant="success">Done</Badge> : <Badge variant="danger">Failed</Badge>}</TableCell>
                  <TableCell>{l.trigger === "schedule" ? "Automatic" : "By hand"}</TableCell>
                  <TableCell className="text-sm">
                    {l.status === "success"
                      ? `${l.details.room_charges ?? 0} room charges · ${l.details.holds_expired ?? 0} holds expired · ${l.details.no_shows ?? 0} no-shows · ${l.details.stayover_tasks ?? 0} stayover tasks`
                      : <span className="text-destructive">{errorMessage({ message: l.error })}</span>}
                  </TableCell>
                  <TableCell className="tabular text-sm">{formatDateTime(l.finished_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
