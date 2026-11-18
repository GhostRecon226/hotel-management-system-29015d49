import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { ChipPicker } from "@/components/chip-picker";
import { SupportSection } from "@/components/platform-support";
import { SummaryTiles } from "@/components/platform-summary";
import { AccountFacts, CallsToday, HistoryList, nextStepText, STATUS, StatusBadge } from "@/components/platform-parts";
import { Field, FormDialog } from "@/lib/setup";
import { formatDay } from "@/lib/reservations";
import {
  endOfDay, type PlatformAction, type PlatformTenant, TwoStepGate, usePlans, usePlatformChange, usePlatformFailedPayments, usePlatformSummary, usePlatformTenants,
} from "@/lib/platform";
import { callsToday, filterTenants, nextDate, nextStep, statusCounts } from "@/lib/platform-view";
import { whoamiQuery } from "@/lib/queries";

// Platform console (PLT-008, PLT-009, PLT-013): hotels' accounts only, never their guests, bookings or money.
export const Route = createFileRoute("/_authenticated/platform")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(whoamiQuery);
    if (!me.operator) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Platform console · Zikora" }] }),
  component: PlatformConsole,
});

type Filter = string; // "all" or a subscription status

function PlatformConsole() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useQuery(whoamiQuery);
  const mfa = !!me.data?.mfa;
  const tenants = usePlatformTenants(mfa);
  const summary = usePlatformSummary(mfa);
  const failed = usePlatformFailedPayments(mfa);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const now = Date.now();
  const all = tenants.data ?? [];
  const rows = useMemo(() => filterTenants(all, filter, q), [all, filter, q]);
  const counts = statusCounts(all);
  const calls = useMemo(() => callsToday(all, failed.data ?? [], summary.data?.quiet ?? [], Date.now()), [all, failed.data, summary.data]);
  const current = openId ? all.find((t) => t.tenant_id === openId) ?? null : null;
  const chips = [["all", "All"], ...Object.entries(STATUS).filter(([k]) => (counts[k] ?? 0) > 0).map(([k, v]) => [k, v.label === "Trial" ? "On trial" : v.label])]
    .map(([k, label]) => ({ key: k!, label: `${label} ${counts[k!] ?? 0}` }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <PageHeader title="Platform console" description="Hotel accounts only: status, plan and dates. Guests, bookings and money are never shown here."
        actions={<Button variant="outline" onClick={async () => { await supabase.auth.signOut(); qc.clear(); navigate({ to: "/auth" }); }}>Sign out</Button>} />
      {!mfa ? (
        <TwoStepGate onDone={async () => { await supabase.auth.refreshSession(); await qc.invalidateQueries({ queryKey: ["platform"] }); }} />
      ) : (
        <>
          <SummaryTiles summary={summary.data} loading={summary.isLoading} failed={summary.isError} calls={calls.length} />
          {!tenants.isLoading && <CallsToday calls={calls} onView={setOpenId} hasTenant={(id) => all.some((t) => t.tenant_id === id)} />}
          <section aria-labelledby="hotel-list" className="space-y-3">
            <h2 id="hotel-list" className="sr-only">Hotels</h2>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Input className="w-full sm:w-72" placeholder="Search hotel or country" aria-label="Search hotels" value={q} onChange={(e) => setQ(e.target.value)} />
              <ChipPicker label="Filter hotels by status" selected={filter} options={chips} onPick={setFilter} />
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Hotel</TableHead><TableHead>Status</TableHead><TableHead>Plan</TableHead><TableHead>Next date</TableHead><TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {tenants.isLoading && <TableSkeletonRows cols={5} />}
                {!tenants.isLoading && rows.length === 0 && <TableStateRow colSpan={5} title="No hotels match" description="Clear the search or pick All." />}
                {rows.map((t) => {
                  const next = nextDate(t, now);
                  return (
                    <TableRow key={t.tenant_id}>
                      <TableCell><span className="font-medium">{t.hotel_name}</span><span className="block text-sm text-muted-foreground">{t.country} · since {formatDay(t.created_at)}</span></TableCell>
                      <TableCell><StatusBadge s={t.subscription_status} /></TableCell>
                      <TableCell>{t.plan_name}</TableCell>
                      <TableCell>{next ? <>{next.label}<span className="block text-sm text-muted-foreground">{formatDay(next.date)}</span></> : "—"}</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="outline" className="pointer-coarse:h-11" onClick={() => setOpenId(t.tenant_id)} aria-label={`Manage ${t.hotel_name}`}>Manage</Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </section>
          <HotelPanel tenant={current} onOpenChange={(o) => !o && setOpenId(null)} />
        </>
      )}
    </div>
  );
}

const ACTIONS: Array<{ action: PlatformAction; label: string; when: (t: PlatformTenant) => boolean }> = [
  { action: "activate", label: "Activate or extend paid period", when: () => true },
  { action: "extend_trial", label: "Extend trial", when: (t) => ["trial", "expired"].includes(t.subscription_status) },
  { action: "change_plan", label: "Change plan", when: () => true },
  { action: "suspend", label: "Suspend", when: (t) => t.subscription_status !== "suspended" },
  { action: "cancel", label: "Cancel", when: (t) => t.subscription_status !== "cancelled" },
];

function HotelPanel({ tenant, onOpenChange }: { tenant: PlatformTenant | null; onOpenChange: (o: boolean) => void }) {
  const [action, setAction] = useState<PlatformAction | null>(null);
  const [tab, setTab] = useState("account");
  useEffect(() => { setTab("account"); setAction(null); }, [tenant?.tenant_id]);
  const step = tenant ? nextStep(tenant, Date.now()) : null;
  const text = step ? nextStepText(step) : null;
  const available = tenant ? ACTIONS.filter((a) => a.when(tenant)) : [];
  const main = available.find((a) => a.action === step?.main);
  const more = available.filter((a) => a !== main);
  return (
    <Sheet open={!!tenant} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">{tenant?.hotel_name}{tenant && <StatusBadge s={tenant.subscription_status} />}</SheetTitle>
          {tenant && <p className="text-sm text-muted-foreground">{tenant.country} · since {formatDay(tenant.created_at)} · {tenant.plan_name} plan</p>}
        </SheetHeader>
        {tenant && text && (
          <div className="mt-4 space-y-4 px-1">
            <div className="space-y-2 rounded-xl border border-primary/30 bg-primary-soft/60 p-3">
              <p className="font-semibold">{text.headline}</p>
              <p className="text-sm text-muted-foreground">{text.detail}</p>
              <div className="flex flex-wrap gap-2">
                {main && <Button className="pointer-coarse:h-11" onClick={() => setAction(main.action)}>{main.label}</Button>}
                {more.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="pointer-coarse:h-11">More <ChevronDown className="h-4 w-4" aria-hidden /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {more.map((a) => <DropdownMenuItem key={a.action} className={a.action === "suspend" || a.action === "cancel" ? "h-11 text-destructive" : "h-11"} onClick={() => setAction(a.action)}>{a.label}</DropdownMenuItem>)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList aria-label="Hotel">
                <TabsTrigger value="account">Account</TabsTrigger><TabsTrigger value="support">Support</TabsTrigger><TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TabsContent value="account" className="mt-3"><AccountFacts t={tenant} /></TabsContent>
              <TabsContent value="support" className="mt-3"><SupportSection tenantId={tenant.tenant_id} /></TabsContent>
              <TabsContent value="history" className="mt-3"><HistoryList tenantId={tenant.tenant_id} /></TabsContent>
            </Tabs>
          </div>
        )}
        {tenant && action && <ActionDialog tenant={tenant} action={action} onClose={() => setAction(null)} onSaved={() => setTab("history")} />}
      </SheetContent>
    </Sheet>
  );
}

const TITLES: Record<PlatformAction, string> = {
  activate: "Activate or extend the paid period", extend_trial: "Extend the trial", change_plan: "Change the plan",
  suspend: "Suspend the hotel", cancel: "Cancel the hotel's subscription",
};

function ActionDialog({ tenant, action, onClose, onSaved }: { tenant: PlatformTenant; action: PlatformAction; onClose: () => void; onSaved: () => void }) {
  const plans = usePlans();
  const m = usePlatformChange();
  const [date, setDate] = useState("");
  const [plan, setPlan] = useState(action === "change_plan" ? "" : tenant.plan_code);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const needsDate = action === "activate" || action === "extend_trial";
  const needsPlan = action === "activate" || action === "change_plan";
  const today = new Date().toISOString().slice(0, 10);
  const planName = plans.data?.find((p) => p.code === plan)?.name ?? plan;
  const summary = {
    activate: `${tenant.hotel_name} becomes active on the ${planName} plan, paid until ${date ? formatDay(date) : "…"}. Staff can work normally.`,
    extend_trial: `${tenant.hotel_name}'s trial ends on ${date ? formatDay(date) : "…"} instead of ${tenant.trial_ends_at ? formatDay(tenant.trial_ends_at) : "now"}.`,
    change_plan: `${tenant.hotel_name} moves from ${tenant.plan_name} to ${planName}. The status stays ${STATUS[tenant.subscription_status]?.label ?? tenant.subscription_status}.`,
    suspend: `${tenant.hotel_name} becomes read-only now. Staff can still sign in, read, settle bills and check guests out.`,
    cancel: `${tenant.hotel_name}'s subscription is cancelled and the hotel becomes read-only. Nothing is deleted.`,
  }[action];
  const ready = reason.trim() !== "" && (!needsDate || !!date) && (!needsPlan || !!plan);

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={TITLES[action]} busy={m.isPending}
      submitLabel={confirming ? "Yes, save this change" : "Continue"} submitDisabled={!ready}
      onSubmit={() => {
        if (!confirming) { setConfirming(true); return; }
        m.mutate({ tenant: tenant.tenant_id, action, reason: reason.trim(), until: needsDate ? endOfDay(date) : null, plan: needsPlan ? plan : null },
          { onSuccess: () => { onSaved(); onClose(); } });
      }}>
      {!confirming ? (
        <>
          {needsDate && (
            <Field label={action === "activate" ? "Paid until" : "New trial end"} htmlFor="pf-date">
              <Input id="pf-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
          )}
          {needsPlan && (
            <Field label="Plan" htmlFor="pf-plan">
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger id="pf-plan"><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                <SelectContent>{(plans.data ?? []).filter((p) => action !== "change_plan" || p.code !== tenant.plan_code).map((p) => (
                  <SelectItem key={p.code} value={p.code}>{p.name} ({p.max_rooms ?? "any number of"} rooms, {p.max_properties ?? "any number of"} properties, {p.max_users ?? "any number of"} staff)</SelectItem>
                ))}</SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Reason" htmlFor="pf-reason" hint="Saved in the hotel's history, for example the invoice paid.">
            <Textarea id="pf-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
          </Field>
        </>
      ) : (
        <div className="space-y-2 text-[15px]" role="status">
          <p className="font-medium">Check before saving:</p>
          <p>{summary}</p>
          <p className="text-muted-foreground">Reason: {reason.trim()}</p>
          <Button type="button" variant="link" className="px-0" onClick={() => setConfirming(false)}>Change something</Button>
        </div>
      )}
    </FormDialog>
  );
}
