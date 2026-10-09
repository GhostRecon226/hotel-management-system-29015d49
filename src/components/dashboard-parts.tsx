import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BedDouble, CalendarPlus, LogOut, Sparkles, Wallet, type LucideIcon } from "lucide-react";
import { formatAmount } from "@/components/ui/money";
import type { ActivityRow } from "@/lib/reports";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

/** Round initials chip for a guest name. */
export function Initials({ name, className }: { name: string | null | undefined; className?: string }) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const text = ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1]![0] ?? "" : "")).toUpperCase();
  return <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-strong", className)}>{text}</span>;
}

/** Card with a title, an optional count and a "View all" link, used for the arrivals and departures lists. */
export function ListCard({ title, count, to, linkLabel, children, empty }: {
  title: string; count?: number | undefined; to?: "/front-desk" | undefined; linkLabel?: string; children: ReactNode; empty?: string | undefined;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-border/70 bg-card shadow-card" aria-label={title}>
      <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
        <h2 className="text-lg font-semibold">{title}{count != null && <span className="tabular"> ({count})</span>}</h2>
        {to && <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View all <ArrowRight className="size-3.5" aria-hidden /></Link>}
      </header>
      {empty ? <p className="px-5 pb-6 pt-3 text-sm text-muted-foreground">{empty}</p> : <div className="flex-1 pb-2">{children}</div>}
      {to && linkLabel && !empty && (
        <Link to={to} className="mt-auto flex items-center justify-center gap-1.5 border-t border-border/70 py-3 text-sm font-semibold text-primary hover:bg-primary-tint">
          {linkLabel} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </section>
  );
}

/** One list row. Stacks on a phone, lines up in columns from `md`. The grid template is given by `cols`. */
export function Row({ cols, children }: { cols: string; children: ReactNode }) {
  return <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t border-border/50 px-4 py-3 first:border-t-0 sm:px-5 md:py-2.5", cols)}>{children}</div>;
}
export function HeadRow({ cols, labels }: { cols: string; labels: string[] }) {
  return (
    <div className={cn("hidden items-center gap-x-3 border-y border-border/60 bg-muted/50 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid", cols)}>
      {labels.map((l, i) => <span key={l + i}>{l}</span>)}
    </div>
  );
}

export interface DonutPart { label: string; count: number; color: string }

/** Room status ring with a labelled count for every part (never colour alone). Total rooms sit in the middle. */
export function RoomStatusDonut({ parts, total }: { parts: DonutPart[]; total: number }) {
  const shown = total === 0 ? [{ label: "No rooms", count: 1, color: "var(--chart-track)" }] : parts.filter((p) => p.count > 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:flex-row">
      <div className="relative size-44 shrink-0" role="img" aria-label={`${total} rooms: ${parts.map((p) => `${p.count} ${p.label}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="count" nameKey="label" innerRadius="68%" outerRadius="100%" paddingAngle={shown.length > 1 ? 2 : 0} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={false}>
              {shown.map((p) => <Cell key={p.label} fill={p.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><div className="text-3xl font-bold leading-none tabular">{total}</div><div className="mt-1 text-xs text-muted-foreground">Total rooms</div></div>
        </div>
      </div>
      <ul className="space-y-2.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2.5">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="w-6 font-semibold tabular">{p.count}</span>
            <span className="text-muted-foreground">{p.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The small details under a guest name on a phone (room, reservation, status). From `md` they become columns of the row. */
export function Meta({ children }: { children: ReactNode }) {
  return <div className="col-start-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-12 md:contents md:pl-0">{children}</div>;
}
export const ROW_ACTION = "col-start-2 row-span-2 row-start-1 justify-self-end md:col-start-auto md:row-span-1 md:row-start-auto";

const FALLBACK_ICON = { icon: CalendarPlus, chip: "bg-primary-soft text-primary-strong" };
const ACTIVITY_ICON: Record<string, { icon: LucideIcon; chip: string }> = {
  reservation_created: { icon: CalendarPlus, chip: "bg-primary-soft text-primary-strong" },
  checked_in: { icon: BedDouble, chip: "bg-info-soft text-info-strong" },
  checked_out: { icon: LogOut, chip: "bg-warning-soft text-warning-strong" },
  payment: { icon: Wallet, chip: "bg-success-soft text-success-strong" },
  room_clean: { icon: Sparkles, chip: "bg-success-soft text-success-strong" },
};

/** "10:24 AM" for something that happened on the business date's calendar day, otherwise "5 Oct, 10:24 AM". */
export function activityTime(iso: string, timezone: string) {
  const d = new Date(iso);
  const day = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(x);
  const time = new Intl.DateTimeFormat("en-NG", { timeZone: timezone, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return day(d) === day(new Date()) ? time : `${new Intl.DateTimeFormat("en-NG", { timeZone: timezone, day: "numeric", month: "short" }).format(d)}, ${time}`;
}

/** One line of the Latest activity list. Amounts come from the database already as positive figures. */
export function ActivityItem({ row, timezone }: { row: ActivityRow; timezone: string }) {
  const m = ACTIVITY_ICON[row.kind] ?? FALLBACK_ICON;
  const Icon = m.icon;
  return (
    <li className="flex items-start gap-3 border-t border-border/50 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-lg", m.chip)}><Icon className="size-[18px]" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{row.title}</div>
        <div className="truncate text-[13px] text-muted-foreground">
          {row.detail}{row.amount != null ? ` - ${formatAmount(row.amount, row.currency ?? "NGN")}` : ""}
        </div>
      </div>
      <time dateTime={row.at} className="shrink-0 pt-0.5 text-xs text-muted-foreground tabular">{activityTime(row.at, timezone)}</time>
    </li>
  );
}
