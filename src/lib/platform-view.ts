import type { FailedPayment, PlatformAction, PlatformSummary, PlatformTenant } from "@/lib/platform";

/** Pure helpers for the platform console: who needs a call today, the hotel list filter, and the next step for a hotel (PLT-036 to PLT-038). Dates only, no money arithmetic. */

const DAY = 86_400_000;
/** Same limits the console has always used. */
export const TRIAL_CALL_DAYS = 14;
export const ENDING_SOON_DAYS = 14;
/** A hotel that does not pay within this many days of its period ending becomes read-only (the daily subscription clock). */
export const GRACE_DAYS = 14;

/** Whole days from now to a date, rounded up (negative when past). */
const daysTo = (iso: string, now: number) => Math.ceil((Date.parse(iso) - now) / DAY);

/** The day a past-due hotel becomes read-only: its paid period end plus 14 days, as a date. */
export function readOnlyOn(paidUntil: string | null): string | null {
  if (!paidUntil) return null;
  return new Date(Date.parse(paidUntil) + GRACE_DAYS * DAY).toISOString().slice(0, 10);
}

export type CallKind = "trial" | "past_due" | "payment_failed" | "payment_waiting" | "quiet";
export interface Call { kind: CallKind; tenantId: string; hotel: string; country: string; days: number | null; date: string | null; detail: string; amount?: number; currency?: string }
const KIND_ORDER: CallKind[] = ["trial", "past_due", "payment_failed", "payment_waiting", "quiet"];

/** Everyone the operator should contact today, most urgent first: trials ending, past due, failed payments, payments left waiting, quiet hotels. */
export function callsToday(tenants: PlatformTenant[], payments: FailedPayment[], quiet: PlatformSummary["quiet"], now: number): Call[] {
  const calls: Call[] = [];
  for (const t of tenants) {
    const base = { tenantId: t.tenant_id, hotel: t.hotel_name, country: t.country };
    if (t.subscription_status === "trial" && t.trial_ends_at) {
      const d = daysTo(t.trial_ends_at, now);
      if (d <= TRIAL_CALL_DAYS && Date.parse(t.trial_ends_at) >= now - DAY) calls.push({ ...base, kind: "trial", days: d, date: t.trial_ends_at, detail: t.country });
    }
    if (t.subscription_status === "past_due") calls.push({ ...base, kind: "past_due", days: null, date: readOnlyOn(t.paid_until), detail: t.country });
  }
  const names = new Map(tenants.map((t) => [t.tenant_id, t]));
  for (const p of payments) {
    const t = names.get(p.tenant_id);
    const plan = `${p.plan_code[0]?.toUpperCase() ?? ""}${p.plan_code.slice(1)}, ${p.period === "year" ? "yearly" : "monthly"}`;
    const detail = p.status === "failed" ? [plan, p.failure_reason].filter(Boolean).join(" · ") : `${plan} · waiting over a day`;
    calls.push({ kind: p.status === "failed" ? "payment_failed" : "payment_waiting", tenantId: p.tenant_id, hotel: t?.hotel_name ?? p.tenant_name, country: t?.country ?? "", days: null, date: null, detail: `${detail} · ref ${p.reference}`, amount: p.amount, currency: p.currency });
  }
  for (const q of quiet) {
    calls.push({ kind: "quiet", tenantId: q.tenant_id, hotel: q.hotel_name, country: q.country, days: q.days_inactive, date: q.last_sign_in_at, detail: q.country });
  }
  return calls.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.kind === "trial" ? (a.days ?? 0) - (b.days ?? 0) : 0));
}

/** How many hotels are in each status, plus "all". Only statuses that have a hotel appear. */
export function statusCounts(tenants: PlatformTenant[]): Record<string, number> {
  const out: Record<string, number> = { all: tenants.length };
  for (const t of tenants) out[t.subscription_status] = (out[t.subscription_status] ?? 0) + 1;
  return out;
}

/** The hotel list after the status chip and the search box. Search matches the hotel name or the country. */
export function filterTenants(tenants: PlatformTenant[], status: string, query: string): PlatformTenant[] {
  const q = query.trim().toLowerCase();
  return tenants.filter((t) => (status === "all" || t.subscription_status === status) && (!q || `${t.hotel_name} ${t.country}`.toLowerCase().includes(q)));
}

export type StepKind = "trial_ending" | "trial" | "past_due" | "suspended" | "cancelled" | "expired" | "active_ending" | "active";
export interface NextStep { kind: StepKind; days: number | null; date: string | null; main: PlatformAction | null }

/** What the operator should do about this hotel now. Activate is the main action for every hotel that is not comfortably paid up. */
export function nextStep(t: PlatformTenant, now: number): NextStep {
  switch (t.subscription_status) {
    case "trial": {
      const d = t.trial_ends_at ? daysTo(t.trial_ends_at, now) : null;
      return { kind: d != null && d <= ENDING_SOON_DAYS ? "trial_ending" : "trial", days: d, date: t.trial_ends_at, main: "activate" };
    }
    case "past_due": return { kind: "past_due", days: null, date: readOnlyOn(t.paid_until), main: "activate" };
    case "suspended": return { kind: "suspended", days: null, date: t.last_change_at, main: "activate" };
    case "cancelled": return { kind: "cancelled", days: null, date: t.last_change_at, main: "activate" };
    case "expired": return { kind: "expired", days: null, date: t.trial_ends_at, main: "activate" };
    default: {
      const d = t.paid_until ? daysTo(t.paid_until, now) : null;
      return d != null && d <= ENDING_SOON_DAYS ? { kind: "active_ending", days: d, date: t.paid_until, main: "activate" } : { kind: "active", days: d, date: t.paid_until, main: null };
    }
  }
}

/** The "Next date" column: a short label and the date it refers to. Null when there is nothing to show. */
export function nextDate(t: PlatformTenant, now: number): { label: string; date: string } | null {
  if (t.subscription_status === "trial" && t.trial_ends_at) {
    const d = daysTo(t.trial_ends_at, now);
    return { label: d <= 0 ? "Ends today" : `${d} day${d === 1 ? "" : "s"} left`, date: t.trial_ends_at };
  }
  if (t.subscription_status === "past_due") { const r = readOnlyOn(t.paid_until); return r ? { label: "Read-only on", date: r } : null; }
  if (t.subscription_status === "active") return t.paid_until ? { label: "Paid until", date: t.paid_until } : null;
  return t.last_change_at ? { label: "Since", date: t.last_change_at } : null;
}
