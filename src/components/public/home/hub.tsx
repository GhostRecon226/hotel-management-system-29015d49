import { BarChart3, BedDouble, CalendarDays, ConciergeBell, Users, Wallet, type LucideIcon } from "lucide-react";
import { Section } from "@/components/public/public-layout";

/*
 * "Everything works together": the Zikora mark in the middle, the six areas a hotel team works in around it.
 * Each line is something the product does today. Under 640px the diagram becomes a plain two-column list.
 */
const NODES: { icon: LucideIcon; title: string; text: string; x: number; y: number }[] = [
  { icon: CalendarDays, title: "Reservations", text: "Bookings, holds and group bookings", x: 50, y: 11 },
  { icon: ConciergeBell, title: "Front desk", text: "Check-in, room moves, check-out", x: 84, y: 31 },
  { icon: Wallet, title: "Money", text: "Folios, payments and invoices", x: 84, y: 69 },
  { icon: BarChart3, title: "Reports", text: "Occupancy, ADR and RevPAR", x: 50, y: 89 },
  { icon: Users, title: "Guests", text: "One profile across properties", x: 16, y: 69 },
  { icon: BedDouble, title: "Housekeeping", text: "Tasks, inspection and room status", x: 16, y: 31 },
];

export function Hub() {
  return (
    <Section id="hub">
      <div data-reveal className="mx-auto max-w-2xl text-center">
        <h2 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">Everything works together.</h2>
        <p className="mt-3 text-[15px] text-muted-foreground sm:text-base">One record from booking to invoice. Each team sees the same facts, so nobody retypes them.</p>
      </div>
      <div className="relative mx-auto mt-10 sm:aspect-square sm:max-w-[640px]" data-hub data-draw>
        <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 hidden size-full sm:block">
          <circle cx="50" cy="50" r="22" className="mer-hub-ring hs-fade" />
          <circle cx="50" cy="50" r="38" className="mer-hub-ring hs-fade" />
          {NODES.map((n) => <line key={n.title} x1="50" y1="50" x2={n.x} y2={n.y} pathLength={1} className="mer-hub-line hs-draw" />)}
        </svg>
        <div aria-hidden className="mer-ink mer-halo absolute left-1/2 top-1/2 hidden size-32 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-raised sm:grid">
          <img src="/brand/zikora-icon-dark-screen.svg" alt="" width={72} height={72} className="mer-logo size-[4.5rem]" />
        </div>
        <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:block sm:gap-0">
          {NODES.map(({ icon: Icon, title, text, x, y }, i) => (
            <li key={title} data-reveal style={{ "--x": `${x}%`, "--y": `${y}%`, "--i": i } as React.CSSProperties}
              className="mer-lift flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-card sm:absolute sm:left-[var(--x)] sm:top-[var(--y)] sm:w-48 sm:-translate-x-1/2 sm:-translate-y-1/2">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-strong"><Icon className="size-4" /></span>
              <div>
                <p className="text-[15px] font-bold leading-tight">{title}</p>
                <p className="mt-1 text-[13px] text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
