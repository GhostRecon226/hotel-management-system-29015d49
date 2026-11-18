import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";
import { formatAmount } from "@/components/ui/money";
import { formatDateTime, formatDay } from "@/lib/reservations";
import { usePlatformHistory, type PlatformTenant } from "@/lib/platform";
import type { Call, NextStep } from "@/lib/platform-view";

export const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  trial: { label: "Trial", tone: "info" }, active: { label: "Active", tone: "success" }, past_due: { label: "Past due", tone: "warning" },
  expired: { label: "Trial ended", tone: "danger" }, suspended: { label: "Suspended", tone: "danger" }, cancelled: { label: "Cancelled", tone: "neutral" },
};
export const StatusBadge = ({ s }: { s: string }) => <Badge variant={STATUS[s]?.tone ?? "neutral"} dot>{STATUS[s]?.label ?? s}</Badge>;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The reason chip for one call. */
function callChip(c: Call): { label: string; tone: "danger" | "warning" | "neutral" | "info" } {
  switch (c.kind) {
    case "trial": return { label: c.days == null || c.days <= 0 ? "Trial ends today" : `Trial ends in ${plural(c.days, "day")}`, tone: c.days != null && c.days <= 3 ? "danger" : "warning" };
    case "past_due": return { label: "Past due", tone: "warning" };
    case "payment_failed": return { label: "Payment failed", tone: "danger" };
    case "payment_waiting": return { label: "Payment not finished", tone: "warning" };
    default: return { label: "Gone quiet", tone: "neutral" };
  }
}
function callText(c: Call): string {
  if (c.kind === "past_due") return c.date ? `${c.country} · read-only on ${formatDay(c.date)}` : c.country;
  if (c.kind === "quiet") return `${c.country} · ${c.days == null ? "never signed in" : `no sign-in for ${plural(c.days, "day")}`}`;
  if (c.kind === "trial") return `${c.country} · ends ${formatDay(c.date)}`;
  if (c.amount != null && c.currency) return `${formatAmount(c.amount, c.currency)} · ${c.detail}`;
  return c.detail;
}

/** Every hotel the operator should contact today, most urgent first, with one button on each row (PLT-036). */
export function CallsToday({ calls, onView, hasTenant }: { calls: Call[]; onView: (tenantId: string) => void; hasTenant: (tenantId: string) => boolean }) {
  return (
    <section aria-labelledby="calls-today" className="mb-6 rounded-xl border border-border/70 bg-card p-3 shadow-card sm:p-4">
      <h2 id="calls-today" className="mb-2 flex items-center gap-2 text-base font-bold">
        <CalendarClock className="size-5 text-warning-strong" aria-hidden /> Calls to make today <span className="tabular text-muted-foreground">({calls.length})</span>
      </h2>
      {calls.length === 0 ? <p className="text-sm text-muted-foreground">Nobody needs a call today. No trial ends soon, nothing is past due, and no payment needs follow-up.</p> : (
        <ul className="grid gap-2">
          {calls.map((c, i) => {
            const chip = callChip(c);
            const urgent = c.kind === "trial" || c.kind === "past_due";
            return (
              <li key={`${c.tenantId}-${c.kind}-${i}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg bg-muted/50 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={chip.tone}>{chip.label}</Badge>
                    <span className="font-semibold [overflow-wrap:anywhere]">{c.hotel}</span>
                  </div>
                  <span className="block text-sm text-muted-foreground [overflow-wrap:anywhere]">{callText(c)}</span>
                </div>
                <Button size="sm" variant={urgent ? "default" : "outline"} className="pointer-coarse:h-11" disabled={!hasTenant(c.tenantId)} onClick={() => onView(c.tenantId)} aria-label={`View ${c.hotel}`}>
                  {urgent ? "Manage" : "View"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The plain-words next step at the top of a hotel's panel. The main button sits beside it, in the panel. */
export function nextStepText(n: NextStep): { headline: string; detail: string } {
  const date = n.date ? formatDay(n.date) : "";
  switch (n.kind) {
    case "trial_ending": return { headline: n.days != null && n.days > 0 ? `Trial ends in ${plural(n.days, "day")} (${date}).` : "Trial ends today.", detail: "Activate when payment arrives, or extend the trial." };
    case "trial": return { headline: `On trial until ${date}.`, detail: "Nothing is due yet. Activate early when the hotel pays." };
    case "past_due": return { headline: date ? `Past due. Read-only on ${date}.` : "Past due.", detail: "The hotel still works. Activate when payment arrives." };
    case "suspended": return { headline: date ? `Suspended since ${date}.` : "Suspended.", detail: "The hotel is read-only. Activate to restore it." };
    case "cancelled": return { headline: date ? `Cancelled on ${date}.` : "Cancelled.", detail: "The hotel is read-only. Activate to restore it." };
    case "expired": return { headline: "Trial ended.", detail: "Activate when payment arrives, or extend the trial." };
    case "active_ending": return { headline: n.days != null && n.days > 0 ? `Paid period ends in ${plural(n.days, "day")} (${date}).` : `Paid period ends ${date}.`, detail: "Extend it when the next payment arrives." };
    default: return { headline: date ? `Paid until ${date}.` : "Active.", detail: "Nothing to do now." };
  }
}

/** A hotel's subscription history, newest first. */
export function HistoryList({ tenantId }: { tenantId: string }) {
  const history = usePlatformHistory(tenantId);
  return (
    <section aria-labelledby="hist-title">
      <h3 id="hist-title" className="sr-only">History</h3>
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
  );
}

/** The facts about a hotel account. Counts only; no guests, bookings or money. */
export function AccountFacts({ t }: { t: PlatformTenant }) {
  const rows: Array<[string, string]> = [
    ["Plan", t.plan_name], ["Trial ends", t.trial_ends_at ? formatDay(t.trial_ends_at) : "—"], ["Paid until", t.paid_until ? formatDay(t.paid_until) : "—"],
    ["Properties", String(t.properties)], ["Rooms", String(t.rooms)], ["Active staff", String(t.active_users)],
    ["Last change", t.last_change_at ? formatDateTime(t.last_change_at) : "—"],
  ];
  return (
    <dl>
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-3 gap-2 border-b py-3 text-[15px] last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="col-span-2 tabular">{v}</dd></div>
      ))}
    </dl>
  );
}
