import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tile tones. Status tones keep their fixed meanings (see theme.css); "accent" and "neutral" carry no status. */
export type Tone = "accent" | "neutral" | "success" | "warning" | "danger" | "info";

const TILE: Record<Tone, { tile: string; chip: string }> = {
  accent: { tile: "from-primary-tint", chip: "bg-primary-soft text-primary-strong" },
  neutral: { tile: "from-muted", chip: "bg-muted text-muted-foreground" },
  success: { tile: "from-success-soft/70", chip: "bg-success-soft text-success-strong" },
  warning: { tile: "from-warning-soft/70", chip: "bg-warning-soft text-warning-strong" },
  danger: { tile: "from-danger-soft/70", chip: "bg-danger-soft text-danger-strong" },
  info: { tile: "from-info-soft/70", chip: "bg-info-soft text-info-strong" },
};

type LinkTo = "/front-desk" | "/rooms" | "/approvals" | "/maintenance" | "/folios" | "/reports";

function Wrap({ to, children, className }: { to?: LinkTo | undefined; children: ReactNode; className: string }) {
  return to
    ? <Link to={to} className={cn("block outline-none transition-shadow hover:shadow-raised focus-visible:ring-3 focus-visible:ring-ring/40", className)}>{children}</Link>
    : <div className={className}>{children}</div>;
}

/** Pastel stat tile: icon chip, label, figure, one line underneath. `compact` puts it all on one row. */
export function StatTile({ label, value, sub, icon: Icon, tone = "accent", to, className, compact }: {
  label: string; value: ReactNode; sub?: ReactNode | undefined; icon: LucideIcon; tone?: Tone; to?: LinkTo | undefined; className?: string; compact?: boolean;
}) {
  const t = TILE[tone];
  if (compact) {
    return (
      <Wrap to={to} className={cn("flex h-full items-center gap-3 rounded-xl border border-border/70 bg-card bg-gradient-to-br to-card to-70% px-4 py-3.5 shadow-card", t.tile, className)}>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", t.chip)} aria-hidden><Icon className="size-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
          {sub && <div className="truncate text-[13px] text-muted-foreground">{sub}</div>}
        </div>
        <div className="text-[26px] font-bold leading-none tracking-tight tabular">{value ?? "—"}</div>
      </Wrap>
    );
  }
  return (
    <Wrap to={to} className={cn("h-full rounded-xl border border-border/70 bg-card bg-gradient-to-br to-card to-70% p-4 shadow-card", t.tile, className)}>
      <span className={cn("grid size-9 place-items-center rounded-lg", t.chip)} aria-hidden><Icon className="size-[18px]" /></span>
      <div className="mt-3 text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight tabular">{value ?? "—"}</div>
      {sub && <div className="mt-1 text-[13px] text-muted-foreground">{sub}</div>}
    </Wrap>
  );
}

/** The one filled (accent) card on a page, for the figure that matters most there. */
export function FilledStat({ label, value, sub, icon: Icon, children, className }: {
  label: string; value: ReactNode; sub?: ReactNode; icon: LucideIcon; children?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("relative h-full overflow-hidden rounded-xl bg-accent-fill p-4 text-primary-foreground shadow-accent", className)}>
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-white/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-14 right-10 size-28 rounded-full bg-white/[0.06]" />
      <span className="relative grid size-9 place-items-center rounded-lg bg-white/15" aria-hidden><Icon className="size-[18px]" /></span>
      <div className="relative mt-3 text-sm font-medium text-on-primary-muted">{label}</div>
      <div className="relative mt-0.5 text-[30px] font-bold leading-tight tracking-tight tabular">{value ?? "—"}</div>
      {sub && <div className="relative mt-1 text-[13px] text-on-primary-muted">{sub}</div>}
      {children && <div className="relative mt-3">{children}</div>}
    </div>
  );
}

export type BarPart = { label: string; count: number; tone: Exclude<Tone, "accent" | "neutral"> | "neutral" };
const SEGMENT: Record<BarPart["tone"], string> = {
  success: "bg-success", warning: "bg-warning", danger: "bg-destructive", info: "bg-info", neutral: "bg-chart-track",
};

/** Room availability: one bar split by room state, with a labelled count for every part (never colour alone). */
export function AvailabilityBar({ parts, className }: { parts: BarPart[]; className?: string }) {
  const rooms = parts.reduce((n, p) => n + p.count, 0);
  return (
    <div className={className}>
      <div className="flex h-3.5 w-full gap-1 overflow-hidden rounded-full bg-chart-track" role="img"
        aria-label={parts.map((p) => `${p.label} ${p.count}`).join(", ")}>
        {rooms > 0 && parts.filter((p) => p.count > 0).map((p) => (
          <div key={p.label} className={cn("h-full first:rounded-l-full last:rounded-r-full", SEGMENT[p.tone])} style={{ width: `${(p.count / rooms) * 100}%` }} />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {parts.map((p) => (
          <div key={p.label} className="flex items-start gap-2">
            <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", SEGMENT[p.tone])} aria-hidden />
            <div>
              <dt className="text-[13px] text-muted-foreground">{p.label}</dt>
              <dd className="text-xl font-bold tabular">{p.count}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
