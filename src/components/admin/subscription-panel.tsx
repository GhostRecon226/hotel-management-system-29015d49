import { useAccess } from "@/lib/access";
import { Field, NoAccess, SectionHeader } from "@/lib/setup";
import { formatDateTime } from "@/lib/reservations";
import { useAdminAction, useBillingOptions, useSubscriptionInfo, type SubscriptionInfo } from "@/lib/admin";
import { useState } from "react";
import { startPlanCheckout } from "@/lib/billing.functions";
import { errorMessage } from "@/lib/errors";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { LoadingState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

const STATUS: Record<string, { label: string; variant: BadgeTone }> = {
  trial: { label: "Free trial", variant: "info" },
  trialing: { label: "On trial", variant: "info" },
  active: { label: "Active", variant: "success" },
  past_due: { label: "Payment overdue", variant: "warning" },
  expired: { label: "Expired", variant: "danger" },
  suspended: { label: "Suspended", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "neutral" },
};

const PAYMENT: Record<string, { label: string; variant: BadgeTone }> = {
  pending: { label: "Waiting", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
};

/** Pay for a plan online. Prices and "can buy" come from the database; the amount is never sent from here. */
function PayForPlan() {
  const options = useBillingOptions(true);
  const qc = useQueryClient();
  const checkoutFn = useServerFn(startPlanCheckout);
  const pay = useMutation({
    mutationFn: (v: { plan: string; interval: "month" | "year" }) => checkoutFn({
      data: { ...v, key: crypto.randomUUID(), returnUrl: `${window.location.origin}/admin#plan` },
    }),
    onSuccess: (r) => { window.location.href = r.url; },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const b = options.data;
  if (options.isLoading) return <LoadingState />;
  if (!b) return null;
  const priced = b.plans.some((p) => p.month != null || p.year != null);

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <SectionHeader title="Choose a plan" description={priced
            ? "Pay online by card or bank transfer. Your plan starts as soon as the payment is confirmed. Paying again adds time to what you have already paid for."
            : "Online payment is not open yet. To start or change your plan, contact us."} />
          {priced && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Plan</TableHead><TableHead className="text-right">Per month</TableHead>
                <TableHead className="text-right">Per year</TableHead><TableHead className="text-right">Pay</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {b.plans.map((p) => (
                  <TableRow key={p.code}>
                    <TableCell className="font-medium">{p.name}
                      {!p.fits && <div className="text-xs font-normal text-muted-foreground">Your hotel is larger than this plan allows.</div>}
                    </TableCell>
                    <TableCell className="text-right">{p.month != null ? <Money amount={p.month} currency={b.currency} /> : "—"}</TableCell>
                    <TableCell className="text-right">{p.year != null ? <Money amount={p.year} currency={b.currency} /> : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" disabled={!p.can_buy || p.month == null || pay.isPending}
                          onClick={() => pay.mutate({ plan: p.code, interval: "month" })}>Pay monthly</Button>
                        <Button size="sm" disabled={!p.can_buy || p.year == null || pay.isPending}
                          onClick={() => pay.mutate({ plan: p.code, interval: "year" })}>Pay yearly</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {b.payments.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <SectionHeader title="Your payments" description="If you paid and the plan has not changed, wait a minute and refresh." />
            <Table>
              <TableHeader><TableRow>
                <TableHead>Started</TableHead><TableHead>Plan</TableHead><TableHead>Period</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {b.payments.map((x, i) => {
                  const st = PAYMENT[x.status] ?? { label: x.status, variant: "neutral" as const };
                  return (
                    <TableRow key={`${x.created_at}-${i}`}>
                      <TableCell>{formatDateTime(x.created_at)}</TableCell>
                      <TableCell className="capitalize">{x.plan_code}</TableCell>
                      <TableCell>{x.period === "year" ? "Yearly" : "Monthly"}</TableCell>
                      <TableCell className="text-right"><Money amount={x.amount} currency={x.currency} /></TableCell>
                      <TableCell>
                        <Badge variant={st.variant} dot>{st.label}</Badge>
                        {x.failure_reason && <div className="mt-1 text-xs text-muted-foreground">{x.failure_reason}</div>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="mt-3"><Button size="sm" variant="outline" onClick={() => { qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["my-context"] }); }}>Refresh</Button></div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** Ends the hotel's own subscription. The database keeps access until the paid period ends. Shown for paid, active plans only:
 *  cancelling a trial would stop access at once, because a trial has no paid period to run out. */
function CancelSubscription({ s }: { s: SubscriptionInfo }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const cancel = useAdminAction("cancel_subscription", "Subscription cancelled. Your hotel keeps working until the end of the paid period.");
  const ends = s.current_period_end ? formatDateTime(s.current_period_end) : null;
  return (
    <Card>
      <CardContent className="pt-6">
        <SectionHeader title="Cancel subscription" description="Stop the plan from continuing. You can ask us to start it again later." />
        <Button variant="destructive" onClick={() => { setReason(""); setOpen(true); }}>Cancel subscription</Button>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
              <AlertDialogDescription>
                Your hotel keeps working until the end of the paid period{ends ? ` (${ends})` : ""}. After that the hotel becomes read-only.
                Nothing is deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Field label="Reason for cancelling" htmlFor="cs-reason">
              <Textarea id="cs-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
            </Field>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep subscription</AlertDialogCancel>
              <Button variant="destructive" disabled={!reason.trim() || cancel.isPending}
                onClick={() => cancel.mutate({ p_reason: reason.trim() }, { onSuccess: () => setOpen(false) })}>
                {cancel.isPending ? "Cancelling…" : "Cancel subscription"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export function SubscriptionPanel() {
  const { can } = useAccess();
  const allowed = can("adm.subscription.manage") || can("adm.user.manage");
  const info = useSubscriptionInfo(allowed);

  if (!allowed) return <NoAccess />;
  if (info.isLoading) return <LoadingState />;
  const s = info.data;
  if (!s) return null;
  const st = STATUS[s.status] ?? { label: s.status, variant: "neutral" as const };

  const line = (label: string, value: string) => (
    <div><div className="text-sm text-muted-foreground">{label}</div><div className="text-[15px] font-medium">{value}</div></div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <SectionHeader title="Your plan" description="What your hotel is signed up to, and how much of it you are using." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {line("Hotel", s.tenant_name)}
            {line("Plan", s.plan_name)}
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="mt-0.5"><Badge variant={st.variant} dot>{st.label}</Badge></div>
            </div>
            {line("Trial ends", s.trial_ends_at ? `${formatDateTime(s.trial_ends_at)}${s.trial_days_left != null ? ` (${s.trial_days_left} days left)` : ""}` : "—")}
          </div>
          {!s.writable && (
            <p className="mt-4 rounded-xl border border-destructive/30 bg-danger-soft px-4 py-2.5 text-sm text-danger-strong">
              Your hotel is read-only. You can still settle bills and check guests out, but nothing new can be added until the subscription is active again.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <SectionHeader title="Limits" description="Adding more than your plan allows is blocked." />
          <Table>
            <TableHeader><TableRow>
              <TableHead>Item</TableHead><TableHead className="text-right">In use</TableHead><TableHead className="text-right">Allowed</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {([["Rooms", s.usage.rooms, s.limits.rooms], ["Properties", s.usage.properties, s.limits.properties], ["Staff", s.usage.users, s.limits.users]] as const).map(([label, used, max]) => (
                <TableRow key={label}>
                  <TableCell className="font-medium">{label}</TableCell>
                  <TableCell className="tabular text-right">{used}</TableCell>
                  <TableCell className="tabular text-right">{max == null ? "No limit" : max}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {can("adm.subscription.manage") && <PayForPlan />}

      {can("adm.subscription.manage") && s.status === "active" && <CancelSubscription s={s} />}

      <Card>
        <CardContent className="pt-6">
          <SectionHeader title="Plan sizes" description="What each plan includes." />
          <Table>
            <TableHeader><TableRow>
              <TableHead>Plan</TableHead><TableHead className="text-right">Rooms</TableHead>
              <TableHead className="text-right">Properties</TableHead><TableHead className="text-right">Staff</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {s.plans.map((p) => (
                <TableRow key={p.code} className={p.code === s.plan_code ? "bg-muted/50" : undefined}>
                  <TableCell className="font-medium">{p.name}{p.code === s.plan_code && <Badge variant="success" className="ml-2">Current</Badge>}</TableCell>
                  <TableCell className="tabular text-right">{p.max_rooms ?? "No limit"}</TableCell>
                  <TableCell className="tabular text-right">{p.max_properties ?? "No limit"}</TableCell>
                  <TableCell className="tabular text-right">{p.max_users ?? "No limit"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
