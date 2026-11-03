import { Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, BedDouble, ConciergeBell, Receipt, type LucideIcon } from "lucide-react";
import { Section, Eyebrow } from "@/components/public/public-layout";

/* Section 4: four jobs. Card hover is CSS only and switched off for visitors who prefer less motion. */
const JOBS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ConciergeBell, title: "Front desk", text: "Reservations, check-in, check-out and room assignments." },
  { icon: BedDouble, title: "Rooms", text: "Housekeeping, maintenance, inspections and room status." },
  { icon: Receipt, title: "Money", text: "Guest bills, payments, invoices and financial records." },
  { icon: BarChart3, title: "Reports", text: "Occupancy, revenue, operational performance and exports." },
];

export function Capabilities() {
  return (
    <Section className="pt-0 sm:pt-0">
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>Capabilities</Eyebrow>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Four jobs. One system.</h2>
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {JOBS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="job-card group rounded-xl border border-border/70 bg-card p-5 shadow-card">
            <span aria-hidden className="job-icon grid size-10 place-items-center rounded-lg bg-primary-soft text-primary-strong"><Icon className="size-5" /></span>
            <h3 className="mt-4 text-lg font-bold">{title}</h3>
            <p className="mt-1.5 text-[15px] leading-snug text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center">
        <Link to="/features" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline">Explore all features <ArrowRight aria-hidden className="size-4" /></Link>
      </p>
    </Section>
  );
}
