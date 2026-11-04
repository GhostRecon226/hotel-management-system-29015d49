import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, BarChart3, BedDouble, ChevronDown, ConciergeBell, Receipt, type LucideIcon } from "lucide-react";
import { Section, Eyebrow } from "@/components/public/public-layout";
import { cn } from "@/lib/utils";

/*
 * Section 4: four jobs. Each card opens a short list (names of real screens and actions).
 * Hover, icon and open/close motion is CSS only, and is switched off for visitors who prefer less motion.
 */
const JOBS: { icon: LucideIcon; title: string; text: string; more: string[] }[] = [
  { icon: ConciergeBell, title: "Front desk", text: "Reservations, check-in, check-out and room assignments.",
    more: ["Bookings, holds and group bookings", "Walk-ins, room moves and stay extensions", "Check-out with settled bills"] },
  { icon: BedDouble, title: "Rooms", text: "Housekeeping, maintenance, inspections and room status.",
    more: ["Cleaning tasks with a second-person inspection", "Maintenance tickets and room blocks", "Room board by floor"] },
  { icon: Receipt, title: "Money", text: "Guest bills, payments, invoices and financial records.",
    more: ["Charges, payments and tax lines", "Invoices that stay unchanged", "Approvals and cashier shifts"] },
  { icon: BarChart3, title: "Reports", text: "Occupancy, revenue, operational performance and exports.",
    more: ["Occupancy, ADR and RevPAR", "Revenue by charge code", "Outstanding balances and CSV exports"] },
];

function JobCard({ icon: Icon, title, text, more }: (typeof JOBS)[number]) {
  const [open, setOpen] = useState(false);
  const id = `job-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <li className="job-card group rounded-xl border border-border/70 bg-card shadow-card">
      <h3>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
          className="flex w-full cursor-pointer flex-col items-start rounded-xl p-5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
          <span className="flex w-full items-center justify-between">
            <span aria-hidden className="job-icon grid size-10 place-items-center rounded-lg bg-primary-soft text-primary-strong"><Icon className="size-5" /></span>
            <ChevronDown aria-hidden className={cn("job-chevron size-4 text-muted-foreground", open && "rotate-180")} />
          </span>
          <span className="mt-4 block text-lg font-bold">{title}</span>
          <span className="mt-1.5 block text-[15px] font-normal leading-snug text-muted-foreground">{text}</span>
        </button>
      </h3>
      <div id={id} data-open={open} className={cn("job-more grid", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden" aria-hidden={!open} inert={!open}>
          <ul className="space-y-1.5 border-t border-border/60 px-5 py-4 text-sm text-muted-foreground">
            {more.map((x) => <li key={x} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{x}</li>)}
          </ul>
        </div>
      </div>
    </li>
  );
}

export function Capabilities() {
  return (
    <Section className="pt-0 sm:pt-0">
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>Capabilities</Eyebrow>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Four jobs. One system.</h2>
      </div>
      <ul className="mt-8 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {JOBS.map((j) => <JobCard key={j.title} {...j} />)}
      </ul>
      <p className="mt-6 text-center">
        <Link to="/features" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline">Explore all features <ArrowRight aria-hidden className="size-4" /></Link>
      </p>
    </Section>
  );
}
