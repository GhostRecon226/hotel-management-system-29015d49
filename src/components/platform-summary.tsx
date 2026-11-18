import { Building2, CalendarClock, CalendarPlus, Coins, TrendingDown, TrendingUp, UserPlus, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/components/ui/money";
import { StatTile } from "@/components/stats";
import type { PlatformSummary } from "@/lib/platform";

function Change({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const Icon = pct < 0 ? TrendingDown : TrendingUp;
  return (
    <Badge variant={pct > 0 ? "success" : pct < 0 ? "danger" : "neutral"} title="Change on the week before">
      <Icon className="size-3.5" aria-hidden />{pct > 0 ? "+" : ""}{pct}%
    </Badge>
  );
}

// Platform console, top of the page (PLT-024, PLT-036): how many hotels, who is new, what they pay, and how many calls to make today.
// Every figure comes from public.platform_summary and the hotel list; the browser only shows them. Hotel account data only, never guests, bookings or balances.
export function SummaryTiles({ summary, loading, failed, calls }: { summary: PlatformSummary | undefined; loading: boolean; failed: boolean; calls: number }) {
  if (loading) return <p className="mb-6 text-sm text-muted-foreground">Loading the summary…</p>;
  if (failed || !summary) return <p className="mb-6 text-sm text-destructive">The summary could not be loaded. The hotel list below still works.</p>;
  const s = summary;
  const value = s.monthly_value.length === 0 ? "—" : s.monthly_value.map((v) => formatAmount(v.amount, v.currency)).join(" + ");
  const paying = s.by_status["active"] ?? 0;
  return (
    <section aria-labelledby="platform-summary" className="mb-6">
      <h2 id="platform-summary" className="sr-only">Summary</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Hotels on Zikora" value={s.hotels} icon={Building2} watermark={Building2} tone="accent" sub={`${paying} active, ${s.by_status["trial"] ?? 0} on trial`} />
        <StatTile label="New this week" value={s.joined_7d} icon={UserPlus} tone="success" badge={<Change pct={s.joined_change_pct} />} trend={s.joined_weekly} sub={`${s.joined_30d} in the last 30 days`} />
        <StatTile label="Monthly value" value={value} icon={Wallet} watermark={Coins} tone="info" sub={`List price of ${paying} active hotel${paying === 1 ? "" : "s"}`} />
        <StatTile label="Calls to make today" value={calls} icon={CalendarClock} watermark={CalendarPlus} tone={calls > 0 ? "warning" : "neutral"} sub="Trials, payments, quiet hotels" />
      </div>
    </section>
  );
}
