import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Check } from "lucide-react";
import { Initials } from "@/components/dashboard-parts";
import { RoomName } from "@/components/room-name";
import { Badge } from "@/components/ui/badge";
import { PRIORITY, StatusBadge, type Ticket } from "@/lib/maintenance";
import { ageText, TICKET_STEPS, ticketStep, type AttentionItem, type AttentionReason, type Workload } from "@/lib/maintenance-view";
import { cn } from "@/lib/utils";

/** Where a problem is: "204", "Lobby", or "204 · Bathroom". */
export function Where({ t, className }: { t: Pick<Ticket, "room_number" | "location">; className?: string }) {
  return (
    <span className={className}>
      {t.room_number ? <RoomName label={t.room_number} /> : null}
      {t.room_number && t.location ? " · " : null}
      {t.location ?? (t.room_number ? null : "No place given")}
    </span>
  );
}

/** Block and reopen chips shared by every ticket card. */
export function TicketChips({ t }: { t: Ticket }) {
  return (
    <>
      {t.has_approved_block ? <Badge variant="danger">Room blocked</Badge> : t.has_active_block ? <Badge variant="warning">Block requested</Badge> : null}
      {t.reopen_count > 0 && <Badge variant="warning">Reopened {t.reopen_count}×</Badge>}
    </>
  );
}

/** One ticket on the supervisor board. The whole card opens the ticket. */
export function BoardTicket({ t, now }: { t: Ticket; now: number }) {
  return (
    <Link to="/maintenance/$id" params={{ id: t.id }}
      className={cn("block space-y-1.5 rounded-xl border border-border/70 bg-card p-3 shadow-card outline-none transition-shadow hover:shadow-raised focus-visible:ring-3 focus-visible:ring-ring/40", t.priority === "urgent" && "border-l-4 border-l-destructive")}>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-[15px] font-semibold [overflow-wrap:anywhere]">{t.title}</span>
        {t.priority !== "normal" && <StatusBadge map={PRIORITY} value={t.priority} />}
      </div>
      <Where t={t} className="block text-sm text-muted-foreground" />
      <div className="flex flex-wrap gap-1"><TicketChips t={t} /></div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {t.assignee_name ? <><Initials name={t.assignee_name} className="size-6 text-xs" /><span className="min-w-0 truncate">{t.assignee_name}</span></> : <span>Nobody assigned</span>}
        <span aria-hidden>·</span><span className="whitespace-nowrap">{ageText(t.created_at, now)}</span>
      </div>
    </Link>
  );
}

const REASON: Record<AttentionReason, { label: (t: Ticket, now: number) => string; variant: "danger" | "warning" }> = {
  urgent: { label: () => "Urgent", variant: "danger" },
  check: { label: () => "Check needed", variant: "warning" },
  nobody: { label: () => "Nobody assigned", variant: "warning" },
  waiting: { label: (t, now) => `Waiting ${ageText(t.updated_at, now)}`, variant: "warning" },
};

/** Tickets a supervisor must act on now, with the action beside each. Hidden when there is nothing to do. */
export function NeedsAttention({ items, now, action }: { items: AttentionItem[]; now: number; action: (t: Ticket, reasons: AttentionReason[]) => ReactNode }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 6);
  return (
    <section aria-labelledby="mnt-attention" className="mb-5 rounded-xl border border-warning/40 bg-warning-soft/60 p-3 sm:p-4">
      <h2 id="mnt-attention" className="mb-2 flex items-center gap-2 text-base font-bold">
        <AlertTriangle className="size-4 text-warning-strong" aria-hidden /> Needs attention <span className="tabular text-muted-foreground">({items.length})</span>
      </h2>
      <ul className="grid gap-2">
        {shown.map(({ ticket: t, reasons }) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg bg-card px-3 py-2.5 shadow-xs">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {reasons.map((r) => <Badge key={r} variant={REASON[r].variant}>{REASON[r].label(t, now)}</Badge>)}
                <Where t={t} className="text-sm font-semibold" />
              </div>
              <span className="block text-sm text-muted-foreground [overflow-wrap:anywhere]">{t.title} · open {ageText(t.created_at, now)}{t.resolved_by_name && t.status === "resolved" ? ` · resolved by ${t.resolved_by_name}` : ""}</span>
            </div>
            {action(t, reasons)}
          </li>
        ))}
      </ul>
      {items.length > shown.length && <p className="mt-2 text-sm text-muted-foreground">and {items.length - shown.length} more on the board below.</p>}
    </section>
  );
}

/** Open work for each technician, so a supervisor sees who has room for more. */
export function WorkloadStrip({ people, nobody }: { people: Workload[]; nobody: number }) {
  if (people.length === 0 && nobody === 0) return null;
  return (
    <section aria-labelledby="mnt-load" className="mb-5">
      <h2 id="mnt-load" className="mb-2 text-base font-bold">Workload</h2>
      <ul className="flex flex-wrap gap-2">
        {people.map((w) => (
          <li key={w.id} className="flex items-center gap-2.5 rounded-full border border-border/70 bg-card py-1.5 pl-1.5 pr-3.5 shadow-xs">
            <Initials name={w.name} className="size-8" />
            <span className="text-sm font-semibold">{w.name}</span>
            <span className="text-sm text-muted-foreground tabular">{w.active} active · {w.waiting} waiting</span>
          </li>
        ))}
        {nobody > 0 && (
          <li className="flex items-center gap-2 rounded-full border border-warning/40 bg-warning-soft px-3.5 py-2 shadow-xs">
            <span className="text-sm font-semibold text-warning-strong">Nobody</span>
            <span className="text-sm text-warning-strong tabular">{nobody} not assigned</span>
          </li>
        )}
      </ul>
    </section>
  );
}

/** The five steps of a ticket with the current one marked. Words as well as colour, so colour is never the only signal. */
export function StepBar({ status }: { status: string }) {
  const at = ticketStep(status);
  if (at < 0) return null;
  return (
    <ol aria-label="Progress" className="mb-4 flex">
      {TICKET_STEPS.map((label, i) => {
        const state = i < at || status === "closed" ? "done" : i === at ? "now" : "next";
        return (
          <li key={label} aria-current={state === "now" ? "step" : undefined} className="relative flex-1 pt-7 text-center text-xs sm:text-sm">
            {i > 0 && <span aria-hidden className={cn("absolute left-[-50%] top-[13px] h-0.5 w-full", i <= at ? "bg-primary" : "bg-border")} />}
            <span aria-hidden className={cn("absolute left-1/2 top-0 z-10 grid size-7 -translate-x-1/2 place-items-center rounded-full text-xs font-bold",
              state === "next" ? "bg-border text-muted-foreground" : "bg-primary text-primary-foreground", state === "now" && "ring-4 ring-primary/20")}>
              {state === "done" ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cn(state === "now" ? "font-bold text-foreground" : "text-muted-foreground")}>{label}</span>
            {state === "now" && <span className="sr-only"> (current step)</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Pick one view of a screen. Large touch targets; the pressed button is marked for screen readers. */
export function ViewSwitch<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { key: T; label: string }[] }) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-1 rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onChange(o.key)}
          className={cn("min-h-11 rounded-lg px-4 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/40", value === o.key ? "bg-card text-foreground shadow-card" : "text-muted-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
