import { Link } from "@tanstack/react-router";
import { CalendarCheck, CheckCircle2, CircleDollarSign, Gauge, HandCoins, TrendingUp, Wallet } from "lucide-react";
import { useAccess } from "@/lib/access";
import { changeDirection, changeText } from "@/lib/change-note";
import { shiftNeedsReview, useNightAuditFlags, useShifts } from "@/lib/cashier";
import { formatDay } from "@/lib/reservations";
import { formatPercent, useOwnerFigures, type OwnerFigures as Figures } from "@/lib/reports";
import { StatTile } from "@/components/stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";

const WORD = { up: "up", down: "down", flat: "no change" } as const;

/** One change line under a figure. The database works the change out; this only shows it with an arrow and a word. */
function Change({ value, children, none = "No figure a week ago to compare" }: { value: number | string | null | undefined; children?: React.ReactNode; none?: string }) {
  const dir = changeDirection(value);
  if (!dir) return <span>{none}</span>;
  if (dir === "flat") return <span>No change on last week</span>;
  return (
    <span className={cn("font-semibold", dir === "up" ? "text-success-strong" : "text-danger-strong")}>
      <span aria-hidden>{dir === "up" ? "▲" : "▼"}</span> <span className="sr-only">{WORD[dir]} </span>{children} <span className="font-normal text-muted-foreground">on last week</span>
    </span>
  );
}

function MoneyChange({ value, currency }: { value: number | string | null | undefined; currency: string }) {
  return <Change value={value}><Money className="inline" amount={value} currency={currency} /></Change>;
}

/** "Yesterday": the last closed day's money and rooms, then what guests owe now. For people with finance report rights. */
export function OwnerFigures() {
  const { can } = useAccess();
  const q = useOwnerFigures(can("rpt.finance.view"));
  const f: Figures | undefined = q.data;
  if (!can("rpt.finance.view") || !f) return null;
  const cur = f.currency;
  return (
    <section aria-labelledby="of-h" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="of-h" className="text-lg font-semibold">Yesterday <span className="text-sm font-normal text-muted-foreground">{formatDay(f.date)}</span></h2>
        <Link to="/reports" className="text-sm font-semibold text-primary hover:underline">Open reports</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 2xl:grid-cols-6">
        <StatTile className="col-span-2 sm:col-span-1" icon={TrendingUp} tone="accent" label="Revenue" value={f.has_figures ? <Money amount={f.revenue} currency={cur} className="text-left text-[19px] sm:text-[22px]" /> : "—"}
          sub={f.has_figures ? <Change value={f.change.revenue_pct}>{changeText(f.change.revenue_pct, "%")}</Change> : "Shows after tonight's roll"} />
        <StatTile className="col-span-2 sm:col-span-1" icon={Wallet} tone="success" label="Collected" value={<Money amount={f.collected} currency={cur} className="text-left text-[19px] sm:text-[22px]" />}
          sub={<Change value={f.change.collected_pct} none="Nothing collected a week ago">{changeText(f.change.collected_pct, "%")}</Change>} />
        <StatTile icon={Gauge} tone="info" label="Occupancy" value={f.has_figures ? formatPercent(f.occupancy == null ? null : Number(f.occupancy)) : "—"}
          sub={f.has_figures ? <Change value={f.change.occupancy_points}>{changeText(f.change.occupancy_points, " points")}</Change> : undefined} />
        <StatTile icon={CircleDollarSign} tone="accent" label="ADR" value={f.has_figures ? <Money amount={f.adr} currency={cur} className="text-left text-[19px] sm:text-[22px]" /> : "—"}
          sub={f.has_figures ? <MoneyChange value={f.change.adr} currency={cur} /> : "Room revenue per room sold"} />
        <StatTile icon={CircleDollarSign} tone="accent" label="RevPAR" value={f.has_figures ? <Money amount={f.revpar} currency={cur} className="text-left text-[19px] sm:text-[22px]" /> : "—"}
          sub={f.has_figures ? <MoneyChange value={f.change.revpar} currency={cur} /> : "Room revenue per room available"} />
        <StatTile icon={HandCoins} tone={Number(f.owed) > 0 ? "warning" : "neutral"} label="Owed by guests" value={<Money amount={f.owed} currency={cur} className="text-left text-[19px] sm:text-[22px]" />}
          sub={`${f.owed_folios} open ${f.owed_folios === 1 ? "folio" : "folios"}`} to="/folios" />
      </div>
      <p className="text-xs text-muted-foreground">Changes compare with the same weekday a week earlier ({formatDay(f.compare_date)}).</p>
    </section>
  );
}

function DecisionRow({ title, detail, action }: { title: string; detail?: string; action: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border py-3 first:border-t-0">
      <div className="min-w-0"><div className="font-semibold">{title}</div>{detail && <div className="text-sm text-muted-foreground">{detail}</div>}</div>
      {action}
    </li>
  );
}

/** What waits for a person to decide: approvals, shifts to reconcile, urgent tickets, what is open before the day closes. */
export function NeedsDecision({ approvals, urgentTickets, openTickets }: { approvals: number | undefined; urgentTickets: number | undefined; openTickets: number | undefined }) {
  const { can, canAny } = useAccess();
  const reconcile = can("fin.shift.reconcile");
  const shifts = useShifts(null);
  const flags = useNightAuditFlags(can("fin.nightaudit.run"));
  const toReview = reconcile ? (shifts.data ?? []).filter(shiftNeedsReview) : [];
  const open = flags.data ? flags.data.blocking.length + flags.data.warnings.length : 0;
  const tickets = canAny(["mnt.view", "mnt.ticket.create"]);
  const rows: React.ReactNode[] = [];
  if (approvals) rows.push(<DecisionRow key="a" title={`${approvals} ${approvals === 1 ? "approval" : "approvals"} waiting`} detail="Discounts, adjustments, reversals and refunds wait for a manager."
    action={<Button asChild size="sm"><Link to="/approvals">Review approvals</Link></Button>} />);
  if (toReview.length) rows.push(<DecisionRow key="s" title={`${toReview.length} cashier ${toReview.length === 1 ? "shift" : "shifts"} to reconcile`} detail="Closed with a difference in the count."
    action={<Button asChild size="sm" variant="outline"><Link to="/cashier">Open cashier</Link></Button>} />);
  if (urgentTickets) rows.push(<DecisionRow key="t" title={`${urgentTickets} urgent maintenance ${urgentTickets === 1 ? "ticket" : "tickets"}`} detail={`${openTickets ?? urgentTickets} open in all.`}
    action={tickets ? <Button asChild size="sm" variant="outline"><Link to="/maintenance">Open tickets</Link></Button> : <Badge variant="danger">Urgent</Badge>} />);
  if (open) rows.push(<DecisionRow key="n" title={`${open} ${open === 1 ? "thing" : "things"} open before the day closes`} detail="The date still rolls by itself. Clear these first when you can."
    action={<Button asChild size="sm" variant="outline"><Link to="/admin">Business date</Link></Button>} />);
  return (
    <section aria-labelledby="nd-h" className="space-y-3">
      <h2 id="nd-h" className="text-lg font-semibold">Needs your decision</h2>
      <Card>
        <CardContent className="py-1">
          {rows.length === 0 ? (
            <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-success-strong" aria-hidden /> Nothing needs you right now.
              {flags.data && <Badge variant="success" className="ml-auto"><CalendarCheck className="mr-1 size-3" aria-hidden />Day ready to close</Badge>}</p>
          ) : <ul>{rows}</ul>}
        </CardContent>
      </Card>
    </section>
  );
}
