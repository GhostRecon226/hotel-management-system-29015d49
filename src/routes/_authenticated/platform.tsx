import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { SupportSection } from "@/components/platform-support";
import { Field, FormDialog } from "@/lib/setup";
import { formatDateTime, formatDay } from "@/lib/reservations";
import {
  daysUntil, endOfDay, type PlatformAction, type PlatformTenant, TwoStepGate, usePlans, usePlatformChange, usePlatformHistory,
  usePlatformFailedPayments, usePlatformTenants, whoamiQuery,
} from "@/lib/platform";

// Platform console (PLT-008, PLT-009, PLT-013): hotels' accounts only, never their guests, bookings or money.
export const Route = createFileRoute("/_authenticated/platform")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(whoamiQuery);
    if (!me.operator) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Platform console · Hotel Desk" }] }),
  component: PlatformConsole,
});

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  trial: { label: "Trial", tone: "info" }, active: { label: "Active", tone: "success" }, past_due: { label: "Past due", tone: "warning" },
  expired: { label: "Trial ended", tone: "danger" }, suspended: { label: "Suspended", tone: "danger" }, cancelled: { label: "Cancelled", tone: "neutral" },
};
const StatusBadge = ({ s }: { s: string }) => <Badge variant={STATUS[s]?.tone ?? "neutral"} dot>{STATUS[s]?.label ?? s}</Badge>;

type Filter = "all" | "trial_soon" | "past_due" | "readonly";
const FILTERS: Array<[Filter, string]> = [["all", "All hotels"], ["trial_soon", "Trial ends within 7 days"], ["past_due", "Past due"], ["readonly", "Read-only"]];

function PlatformConsole() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useQuery(whoamiQuery);
  const mfa = !!me.data?.mfa;
  const tenants = usePlatformTenants(mfa);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<PlatformTenant | null>(null);
  const rows = useMemo(() => (tenants.data ?? []).filter((t) => {
    if (filter === "trial_soon") { const d = daysUntil(t.trial_ends_at); return t.subscription_status === "trial" && d != null && d <= 7; }
    if (filter === "past_due") return t.subscription_status === "past_due";
    if (filter === "readonly") return ["expired", "suspended", "cancelled"].includes(t.access_status);
    return true;
  }), [tenants.data, filter]);
  const current = open ? (tenants.data ?? []).find((t) => t.tenant_id === open.tenant_id) ?? open : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <PageHeader title="Platform console" description="Hotel accounts only: status, plan and dates. Guests, bookings and money are never shown here."
        actions={<Button variant="outline" onClick={async () => { await supabase.auth.signOut(); qc.clear(); navigate({ to: "/auth" }); }}>Sign out</Button>} />
      {!mfa ? (
        <TwoStepGate onDone={async () => { await supabase.auth.refreshSession(); await qc.invalidateQueries({ queryKey: ["platform"] }); }} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter hotels">
            {FILTERS.map(([k, label]) => (
              <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</Button>
            ))}
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Hotel</TableHead><TableHead>Status</TableHead><TableHead>Plan</TableHead><TableHead>Trial ends</TableHead>
              <TableHead>Paid until</TableHead><TableHead className="text-right">Properties</TableHead><TableHead className="text-right">Rooms</TableHead>
              <TableHead className="text-right">Staff</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {tenants.isLoading && <TableSkeletonRows cols={9} />}
              {!tenants.isLoading && rows.length === 0 && <TableStateRow colSpan={9} title="No hotels match this filter" />}
              {rows.map((t) => {
                const d = daysUntil(t.trial_ends_at);
                return (
                  <TableRow key={t.tenant_id}>
                    <TableCell><span className="font-medium">{t.hotel_name}</span><span className="block text-sm text-muted-foreground">{t.country} · since {formatDay(t.created_at)}</span></TableCell>
                    <TableCell><StatusBadge s={t.subscription_status} /></TableCell>
                    <TableCell>{t.plan_name}</TableCell>
                    <TableCell>{t.trial_ends_at ? <>{formatDay(t.trial_ends_at)}{t.subscription_status === "trial" && d != null && <span className="block text-sm text-muted-foreground">{d > 0 ? `in ${d} day${d === 1 ? "" : "s"}` : "today"}</span>}</> : "—"}</TableCell>
                    <TableCell>{t.paid_until ? formatDay(t.paid_until) : "—"}</TableCell>
                    <TableCell className="text-right tabular">{t.properties}</TableCell>
                    <TableCell className="text-right tabular">{t.rooms}</TableCell>
                    <TableCell className="text-right tabular">{t.active_users}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setOpen(t)} aria-label={`Manage ${t.hotel_name}`}>Manage</Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <FailedPayments enabled={mfa} />
          <HotelPanel tenant={current} onOpenChange={(o) => !o && setOpen(null)} />
        </>
      )}
    </div>
  );
}

// Subscription payments that failed, or that a hotel started and never finished. Contact the hotel, or activate by hand.
function FailedPayments({ enabled }: { enabled: boolean }) {
  const q = usePlatformFailedPayments(enabled);
  const rows = q.data ?? [];
  if (q.isLoading || rows.length === 0) return null;
  return (
    <section className="mt-10" aria-labelledby="failed-payments">
      <h2 id="failed-payments" className="mb-1 text-lg font-semibold">Payments to follow up</h2>
      <p className="mb-3 text-sm text-muted-foreground">Failed payments from the last 60 days, and payments left waiting for more than a day.</p>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Started</TableHead><TableHead>Hotel</TableHead><TableHead>Plan</TableHead>
          <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Reference</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.payment_id}>
              <TableCell>{formatDateTime(r.created_at)}</TableCell>
              <TableCell className="font-medium">{r.tenant_name}</TableCell>
              <TableCell><span className="capitalize">{r.plan_code}</span><span className="block text-sm text-muted-foreground">{r.period === "year" ? "Yearly" : "Monthly"}</span></TableCell>
              <TableCell className="text-right"><Money amount={r.amount} currency={r.currency} /></TableCell>
              <TableCell>
                <Badge variant={r.status === "failed" ? "danger" : "warning"} dot>{r.status === "failed" ? "Failed" : "Not finished"}</Badge>
                {r.failure_reason && <span className="block text-sm text-muted-foreground">{r.failure_reason}</span>}
              </TableCell>
              <TableCell className="font-mono text-xs">{r.reference}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
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
  const history = usePlatformHistory(tenant?.tenant_id ?? null);
  const [action, setAction] = useState<PlatformAction | null>(null);
  return (
    <Sheet open={!!tenant} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>{tenant?.hotel_name}</SheetTitle></SheetHeader>
        {tenant && (
          <div className="mt-4 space-y-6 px-1">
            <dl className="grid grid-cols-2 gap-3 text-[15px]">
              <div><dt className="text-sm text-muted-foreground">Status</dt><dd><StatusBadge s={tenant.subscription_status} /></dd></div>
              <div><dt className="text-sm text-muted-foreground">Plan</dt><dd>{tenant.plan_name}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Trial ends</dt><dd>{tenant.trial_ends_at ? formatDay(tenant.trial_ends_at) : "—"}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Paid until</dt><dd>{tenant.paid_until ? formatDay(tenant.paid_until) : "—"}</dd></div>
            </dl>
            <div className="flex flex-wrap gap-2">
              {ACTIONS.filter((a) => a.when(tenant)).map((a) => (
                <Button key={a.action} size="sm" variant={a.action === "suspend" || a.action === "cancel" ? "outline" : "default"} onClick={() => setAction(a.action)}>{a.label}</Button>
              ))}
            </div>
            <SupportSection tenantId={tenant.tenant_id} />
            <section aria-labelledby="hist-title">
              <h3 id="hist-title" className="mb-2 font-semibold">History</h3>
              {history.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {history.data?.length === 0 && <p className="text-sm text-muted-foreground">No changes yet.</p>}
              <ol className="space-y-3">
                {history.data?.map((h, i) => (
                  <li key={`${h.created_at}-${i}`} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {h.from_status && <><StatusBadge s={h.from_status} /><span aria-hidden>→</span></>}<StatusBadge s={h.to_status} />
                      <span className="text-muted-foreground">{formatDateTime(h.created_at)}</span>
                    </div>
                    <p className="mt-1">{h.reason}</p>
                    <p className="text-muted-foreground">{h.source === "platform" ? `By ${h.operator_email ?? "a platform operator"}` : h.source === "clock" ? "By the daily clock" : "By the hotel"}{h.period_end ? ` · period ends ${formatDay(h.period_end)}` : ""}{h.plan_code ? ` · plan ${h.plan_code}` : ""}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
        {tenant && action && <ActionDialog tenant={tenant} action={action} onClose={() => setAction(null)} />}
      </SheetContent>
    </Sheet>
  );
}

const TITLES: Record<PlatformAction, string> = {
  activate: "Activate or extend the paid period", extend_trial: "Extend the trial", change_plan: "Change the plan",
  suspend: "Suspend the hotel", cancel: "Cancel the hotel's subscription",
};

function ActionDialog({ tenant, action, onClose }: { tenant: PlatformTenant; action: PlatformAction; onClose: () => void }) {
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
          { onSuccess: onClose });
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
