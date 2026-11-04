import { useId, useState } from "react";
import { BarChart3, BedDouble, CalendarDays, ChevronDown, ConciergeBell, Users, Wallet, type LucideIcon } from "lucide-react";
import { Section } from "@/components/public/public-layout";

/*
 * Six areas in a grid with thin dividers. "Read more" opens a short list. Every line is checked against the product.
 * No integrations, no channel manager, no guest messaging, no inventory.
 */
const MODULES: { icon: LucideIcon; title: string; text: string; more: string[] }[] = [
  { icon: CalendarDays, title: "Reservations", text: "Bookings that cannot oversell the last room.",
    more: ["Bookings, holds and group bookings", "Availability checked for every room type", "Room blocks that re-check availability"] },
  { icon: ConciergeBell, title: "Front desk", text: "Arrivals, in-house guests and departures in one list.",
    more: ["Check-in, walk-ins and room moves", "Stay extensions and early departures", "Check-out only when bills are settled, or approved"] },
  { icon: BedDouble, title: "Housekeeping and rooms", text: "Cleaning tasks that follow check-out.",
    more: ["A task opens at check-out, finished on a phone", "A second person inspects before the room is clean", "Maintenance tickets and a room board by floor"] },
  { icon: Wallet, title: "Money", text: "Folios, payments and invoices with a trail.",
    more: ["Charges, payments and tax lines on each folio", "Invoices that stay unchanged once issued", "Approvals for discounts, refunds and reversals, and cashier shifts"] },
  { icon: Users, title: "Guests", text: "One guest profile shared across properties.",
    more: ["Guest records with stay history", "ID numbers hidden from staff without permission", "Merge duplicate profiles safely"] },
  { icon: BarChart3, title: "Reports", text: "Daily figures that read from the same record.",
    more: ["Occupancy, ADR and RevPAR", "Revenue by charge code", "Outstanding balances and CSV exports"] },
];

function Card({ icon: Icon, title, text, more }: (typeof MODULES)[number]) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <li className="border-b border-border/70 p-6 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0">
      <span aria-hidden className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary-strong"><Icon className="size-5" /></span>
      <h3 className="font-sans mt-4 text-lg font-bold">{title}</h3>
      <p className="mt-1 text-[15px] text-muted-foreground">{text}</p>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}
        className="mt-3 inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-md text-sm font-semibold text-primary-strong outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40 pointer-coarse:min-h-11">
        {open ? "Show less" : "Read more"} <ChevronDown aria-hidden className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      <ul id={id} hidden={!open} className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        {more.map((x) => <li key={x} className="flex gap-2"><span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-primary" />{x}</li>)}
      </ul>
    </li>
  );
}

export function Modules() {
  return (
    <Section id="features">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">Everything you need to run your hotel.</h2>
        <p className="mt-3 text-[15px] text-muted-foreground sm:text-base">Built for the daily work of a front desk, a housekeeping team and an accounts office.</p>
      </div>
      <ul className="mt-10 grid border-t border-border/70 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => <Card key={m.title} {...m} />)}
      </ul>
    </Section>
  );
}
