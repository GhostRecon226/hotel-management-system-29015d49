import { Building2, CalendarClock, MoonStar, UserPlus, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/components/ui/money";
import { StatTile } from "@/components/stats";
import { formatDay } from "@/lib/reservations";
import { usePlatformSummary } from "@/lib/platform";

const ORDER: Array<[string, string, "info" | "success" | "warning" | "danger" | "neutral"]> = [
  ["trial", "On trial", "info"], ["active", "Active", "success"], ["past_due", "Past due", "warning"],
  ["expired", "Trial ended", "danger"], ["suspended", "Suspended", "danger"], ["cancelled", "Cancelled", "neutral"],
];

// Platform console, top of the page (PLT-024): how many hotels, who is new, who needs a call. Every figure comes from
// public.platform_summary; the browser only shows them. Hotel account data only, never guests, bookings or balances.
export function PlatformSummary({ enabled }: { enabled: boolean }) {
  const q = usePlatformSummary(enabled);
  const s = q.data;
  if (q.isLoading) return <p className="mb-6 text-sm text-muted-foreground">Loading the summary…</p>;
  if (q.isError || !s) return <p className="mb-6 text-sm text-destructive">The summary could not be loaded. The hotel list below still works.</p>;
  const value = s.monthly_value.length === 0
    ? "—" : s.monthly_value.map((v) => formatAmount(v.amount, v.currency)).join(" + ");
  const paying = s.by_status["active"] ?? 0;
  return (
    <section aria-labelledby="platform-summary" className="mb-8 space-y-4">
      <h2 id="platform-summary" className="sr-only">Summary</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Hotels on Zikora" value={s.hotels} icon={Building2} tone="accent"
          sub={`${paying} active, ${s.by_status["trial"] ?? 0} on trial`} />
        <StatTile label="New this week" value={s.joined_7d} icon={UserPlus} tone="success" sub={`${s.joined_30d} in the last 30 days`} />
        <StatTile label="Monthly value" value={value} icon={Wallet} tone="info"
          sub={`List price of ${paying} active hotel${paying === 1 ? "" : "s"}`} />
        <StatTile label="Trials ending soon" value={s.trials_ending.length} icon={CalendarClock}
          tone={s.trials_ending.length > 0 ? "warning" : "neutral"} sub="Within 14 days" />
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Hotels by status">
        {ORDER.map(([k, label, tone]) => (
          <Badge key={k} variant={tone} dot>{label}: {s.by_status[k] ?? 0}</Badge>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
          <h3 className="flex items-center gap-2 font-semibold"><CalendarClock className="size-4 text-warning-strong" aria-hidden /> Trials ending within 14 days</h3>
          {s.trials_ending.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No trial ends in the next 14 days.</p> : (
            <ul className="mt-2 divide-y">
              {s.trials_ending.map((t) => (
                <li key={t.tenant_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="font-medium">{t.hotel_name}</span>
                  <span className="text-muted-foreground">{formatDay(t.trial_ends_at)} · {t.days === 0 ? "today" : `in ${t.days} day${t.days === 1 ? "" : "s"}`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
          <h3 className="flex items-center gap-2 font-semibold"><MoonStar className="size-4 text-muted-foreground" aria-hidden /> Gone quiet</h3>
          <p className="text-[13px] text-muted-foreground">Joined over a week ago, and no staff member has signed in for 7 days.</p>
          {s.quiet.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Every hotel has been in this week.</p> : (
            <ul className="mt-2 divide-y">
              {s.quiet.map((h) => (
                <li key={h.tenant_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="font-medium">{h.hotel_name}</span>
                  <span className="text-muted-foreground">{h.last_sign_in_at ? `last in ${formatDay(h.last_sign_in_at)}` : "never signed in"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
