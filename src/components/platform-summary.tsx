import { Building2, CalendarClock, CalendarPlus, Coins, MoonStar, TrendingDown, TrendingUp, UserPlus, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/components/ui/money";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatTile } from "@/components/stats";
import { formatDay } from "@/lib/reservations";
import { type PlatformTenant, usePlatformSummary } from "@/lib/platform";

const ORDER: Array<[string, string, "info" | "success" | "warning" | "danger" | "neutral"]> = [
  ["trial", "On trial", "info"], ["active", "Active", "success"], ["past_due", "Past due", "warning"],
  ["expired", "Trial ended", "danger"], ["suspended", "Suspended", "danger"], ["cancelled", "Cancelled", "neutral"],
];

const daysText = (n: number) => (n === 0 ? "Today" : `${n} day${n === 1 ? "" : "s"}`);

function Change({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const Icon = pct < 0 ? TrendingDown : TrendingUp;
  return (
    <Badge variant={pct > 0 ? "success" : pct < 0 ? "danger" : "neutral"} title="Change on the week before">
      <Icon className="size-3.5" aria-hidden />{pct > 0 ? "+" : ""}{pct}%
    </Badge>
  );
}

function Card({ id, icon: Icon, tone, title, note, children }: {
  id: string; icon: typeof CalendarClock; tone: string; title: string; note?: string; children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
      <h3 id={id} className="flex items-center gap-2 text-base font-semibold"><Icon className={`size-5 ${tone}`} aria-hidden />{title}</h3>
      {note && <p className="mt-0.5 text-[13px] text-muted-foreground">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

// Platform console, top of the page (PLT-024): how many hotels, who is new, who needs a call. Every figure comes from
// public.platform_summary; the browser only shows them. Hotel account data only, never guests, bookings or balances.
export function PlatformSummary({ enabled, tenants, onView }: {
  enabled: boolean; tenants: PlatformTenant[] | undefined; onView: (t: PlatformTenant) => void;
}) {
  const q = usePlatformSummary(enabled);
  const s = q.data;
  if (q.isLoading) return <p className="mb-6 text-sm text-muted-foreground">Loading the summary…</p>;
  if (q.isError || !s) return <p className="mb-6 text-sm text-destructive">The summary could not be loaded. The hotel list below still works.</p>;
  const value = s.monthly_value.length === 0 ? "—" : s.monthly_value.map((v) => formatAmount(v.amount, v.currency)).join(" + ");
  const paying = s.by_status["active"] ?? 0;
  const view = (id: string, name: string) => {
    const t = tenants?.find((x) => x.tenant_id === id);
    return <Button size="sm" variant="outline" disabled={!t} onClick={() => t && onView(t)} aria-label={`View ${name}`}>View</Button>;
  };
  return (
    <section aria-labelledby="platform-summary" className="mb-8 space-y-4">
      <h2 id="platform-summary" className="sr-only">Summary</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Hotels on Zikora" value={s.hotels} icon={Building2} watermark={Building2} tone="accent"
          sub={`${paying} active, ${s.by_status["trial"] ?? 0} on trial`} />
        <StatTile label="New this week" value={s.joined_7d} icon={UserPlus} tone="success" badge={<Change pct={s.joined_change_pct} />}
          trend={s.joined_weekly} sub={`${s.joined_30d} in the last 30 days`} />
        <StatTile label="Monthly value" value={value} icon={Wallet} watermark={Coins} tone="info"
          sub={`List price of ${paying} active hotel${paying === 1 ? "" : "s"}`} />
        <StatTile label="Trials ending soon" value={s.trials_ending.length} icon={CalendarClock} watermark={CalendarPlus}
          tone={s.trials_ending.length > 0 ? "warning" : "neutral"} sub="Within 14 days" />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Hotels by status">
        {ORDER.map(([k, label, tone]) => <Badge key={k} variant={tone} dot>{label}: {s.by_status[k] ?? 0}</Badge>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="trials-ending" icon={CalendarClock} tone="text-warning-strong" title="Trials ending within 14 days">
          {s.trials_ending.length === 0 ? <p className="text-sm text-muted-foreground">No trial ends in the next 14 days.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Hotel</TableHead><TableHead>Trial ends</TableHead><TableHead>Days left</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {s.trials_ending.map((t) => (
                  <TableRow key={t.tenant_id}>
                    <TableCell><span className="font-medium">{t.hotel_name}</span><span className="block text-sm text-muted-foreground">{t.country}</span></TableCell>
                    <TableCell>{formatDay(t.trial_ends_at)}</TableCell>
                    <TableCell><Badge variant={t.days <= 3 ? "danger" : t.days <= 7 ? "warning" : "info"}>{daysText(t.days)}</Badge></TableCell>
                    <TableCell className="text-right">{view(t.tenant_id, t.hotel_name)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
        <Card id="gone-quiet" icon={MoonStar} tone="text-muted-foreground" title="Gone quiet" note="Joined over a week ago, and no staff member has signed in for 7 days.">
          {s.quiet.length === 0 ? <p className="text-sm text-muted-foreground">Every hotel has been in this week.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Hotel</TableHead><TableHead>Last sign-in</TableHead><TableHead>Days inactive</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {s.quiet.map((h) => (
                  <TableRow key={h.tenant_id}>
                    <TableCell><span className="font-medium">{h.hotel_name}</span><span className="block text-sm text-muted-foreground">{h.country}</span></TableCell>
                    <TableCell>{h.last_sign_in_at ? formatDay(h.last_sign_in_at) : "Never signed in"}</TableCell>
                    <TableCell>{h.days_inactive == null ? <Badge variant="neutral">N/A</Badge> : <Badge variant="warning">{daysText(h.days_inactive)}</Badge>}</TableCell>
                    <TableCell className="text-right">{view(h.tenant_id, h.hotel_name)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </section>
  );
}
