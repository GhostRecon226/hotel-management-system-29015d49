import { Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, BedDouble, CalendarDays, ConciergeBell, Check, Database, Lock, Receipt, ShieldCheck, Sparkles, UserCheck, type LucideIcon } from "lucide-react";
import { Section } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";

/*
 * Homepage sections (copy revamp v3, Oct 2026). Every statement here is checked against what the app does.
 * No customer numbers, logos, quotes, savings figures or integrations: none exist or are confirmed.
 */

const HANDOVERS = [
  { q: "Was that discount approved?", text: "A guest asks for a reduction. The desk agrees. Later, nobody can say who allowed it." },
  { q: "Has the room actually been cleaned?", text: "A guest moves rooms. The front desk thinks the old room is ready. Housekeeping was never told." },
  { q: "Was the payment recorded, and what is still owed?", text: "Money changes hands at the desk. By the end of the day, the figures do not match what people remember." },
];

/** The problem: three handover failures a hotel operator recognises. */
export function Handovers() {
  return (
    <Section>
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">A hotel day has too many handovers</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">When reservations, the front desk, housekeeping and accounts work from separate records, small gaps become difficult questions.</p>
      </div>
      <ul className="mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-3">
        {HANDOVERS.map((h) => (
          <li key={h.q} className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
            <h3 className="font-bold">{h.q}</h3>
            <p className="mt-2 text-[15px] text-muted-foreground">{h.text}</p>
          </li>
        ))}
      </ul>
      <p className="mx-auto mt-6 max-w-3xl text-center font-semibold">Zikora brings the key workflows together, with records and responsibilities that are easier to follow.</p>
    </Section>
  );
}

const PILLARS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Receipt, title: "Put the money trail in order", text: "Record charges and payments against guest folios. Keep issued invoices unchanged. When a correction is needed, use a linked adjustment, reversal or refund instead of silently overwriting the original entry. Selected discounts, refunds and reversals require approval from another authorised person." },
  { icon: BedDouble, title: "Keep room status connected to the work", text: "When a guest checks out, a cleaning task can open automatically. Housekeeping can take the task on a phone browser, mark it done and have another team member inspect it. If maintenance makes a room unavailable, the room can be blocked from sale while the issue is being handled." },
  { icon: BarChart3, title: "See the day, not just the bookings", text: "Review occupancy, average daily rate, RevPAR, revenue by charge code, payments, outstanding balances, ageing and collections. Export supported reports to CSV and prepare an owner summary or an accountant brief." },
];

/** Three proof pillars. */
export function ProofPillars() {
  return (
    <Section className="pt-0 sm:pt-0">
      <ul className="grid gap-4 lg:grid-cols-3">
        {PILLARS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-xl border border-border/70 bg-card p-6 shadow-card">
            <span aria-hidden className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary-strong"><Icon className="size-5" /></span>
            <h2 className="mt-4 text-lg font-bold">{title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const TEAMS = [
  { who: "Front desk", line: "Work from arrivals, in-house guests and departures." },
  { who: "Cashiers", line: "Open a shift with a float, record collections, count and close the shift." },
  { who: "Managers", line: "Review activity and see which balances still need attention." },
];

/** One workflow story: the handover between teams. */
export function TeamHandover() {
  return (
    <Section className="pt-0 sm:pt-0">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">A clearer handover between teams</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">Each team works from the same record, and managers can see the activity behind the day's numbers.</p>
      </div>
      <div className="mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-3">
        {TEAMS.map((r) => (
          <div key={r.who} className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
            <h3 className="font-bold">{r.who}</h3>
            <p className="mt-2 text-[15px] text-muted-foreground">{r.line}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

const TILES: { icon: LucideIcon; title: string; text: string; tone: string }[] = [
  { icon: CalendarDays, title: "Reservations", text: "Bookings, holds and groups, with a last-room safeguard.", tone: "bg-primary-soft text-primary-strong" },
  { icon: ConciergeBell, title: "Front desk", text: "Arrivals, walk-ins, room moves, extensions and departures.", tone: "bg-warning-soft text-warning-strong" },
  { icon: Receipt, title: "Folios and cashiering", text: "Charges, payments, tax lines, invoices and cashier shifts.", tone: "bg-danger-soft text-danger-strong" },
  { icon: Sparkles, title: "Housekeeping and maintenance", text: "Cleaning tasks, inspections, tickets and room blocks.", tone: "bg-info-soft text-info-strong" },
  { icon: UserCheck, title: "Approvals", text: "Roles, limits and a second check on selected decisions.", tone: "bg-info-soft text-info-strong" },
  { icon: BarChart3, title: "Reports", text: "Daily figures, outstanding balances and collections.", tone: "bg-success-soft text-success-strong" },
];

/** Compact capability overview that links to Features. */
export function CapabilityOverview() {
  return (
    <Section className="pt-0 sm:pt-0">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Designed for the realities of hotel operations</h2>
          <p className="mt-4 text-[15px] text-muted-foreground">Zikora is designed to support the practical demands of hotel operations, with configurable tax and service-charge settings. Tax treatment and configuration should be confirmed with your accountant before use.</p>
          <Button asChild size="lg" className="mt-6"><Link to="/features">Explore the platform <ArrowRight aria-hidden /></Link></Button>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TILES.map(({ icon: Icon, title, text, tone }) => (
            <li key={title} className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
              <span aria-hidden className={`grid size-10 place-items-center rounded-lg ${tone}`}><Icon className="size-5" /></span>
              <h3 className="mt-3 text-[15px] font-bold">{title}</h3>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

const CONTROLS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Database, title: "Changes leave a trail", text: "Payments and issued invoices keep their history. Corrections are linked entries." },
  { icon: ShieldCheck, title: "Sensitive actions need a second person", text: "Selected discounts, adjustments, reversals and refunds need another authorised person." },
  { icon: Lock, title: "Hotel data is separated", text: "Each hotel's data is kept apart from other hotels' data. The current database is hosted in Ireland." },
];

/** Security and control strip: three verified points. */
export function ControlStrip() {
  return (
    <Section className="pt-0 sm:pt-0">
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-card sm:p-8">
        <h2 className="text-xl font-bold sm:text-2xl">Accountability built into the workflow</h2>
        <ul className="mt-5 grid gap-5 sm:grid-cols-3">
          {CONTROLS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-strong"><Icon className="size-4" /></span>
              <div>
                <h3 className="text-[15px] font-bold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 flex items-center gap-2 text-sm"><Check aria-hidden className="size-4 text-success-strong" /><Link to="/security" className="font-semibold text-primary underline-offset-4 hover:underline">Read how Zikora handles security and data</Link></p>
      </div>
    </Section>
  );
}

/** Closing call to action. */
export function ClosingCta({ title, text, button = "Start free trial" }: { title: string; text: string; button?: string }) {
  return (
    <Section className="pt-0 sm:pt-0">
      <div className="relative overflow-hidden rounded-2xl bg-accent-fill px-6 py-12 text-center text-primary-foreground shadow-accent sm:px-12">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10" />
        <h2 className="relative text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
        <p className="relative mx-auto mt-2 max-w-xl text-[15px] text-on-primary-muted">{text}</p>
        <div className="relative mt-6 flex justify-center">
          <Button asChild size="lg" variant="secondary"><Link to="/auth" search={{ mode: "signup" }}>{button}</Link></Button>
        </div>
      </div>
    </Section>
  );
}
