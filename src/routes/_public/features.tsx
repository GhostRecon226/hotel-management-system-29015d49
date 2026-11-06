import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, BedDouble, CalendarDays, Calculator, ShieldCheck, Users, Wallet, WifiOff, Wrench, type LucideIcon } from "lucide-react";
import { Section } from "@/components/public/public-layout";
import { ClosingCta } from "@/components/public/home-sections";
import { useScrollReveal } from "@/components/public/home/use-scroll-reveal";
import { Button } from "@/components/ui/button";
import { ORGANIZATION_LD, pageHead } from "@/lib/seo";

const TITLE = "Hotel Management Features | Zikora";
const DESCRIPTION = "Explore Zikora workflows for reservations, front desk, guest folios, cashiering, approvals, housekeeping, maintenance and hotel reporting.";

export const Route = createFileRoute("/_public/features")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, path: "/features", jsonLd: [ORGANIZATION_LD] }),
  component: Features,
});

// Every sentence comes from the v3 copy and was checked against the status document of 10 Oct 2026.
const AREAS: { title: string; icon: LucideIcon; text: string }[] = [
  { title: "Reservations and front desk", icon: CalendarDays, text: "Manage bookings by room type and rate plan, place time-limited holds, handle group bookings and apply configured cancellation and no-show rules. Use arrivals, in-house and departures lists to manage check-ins, walk-ins, room moves, extensions and supported stay corrections. A last-room safeguard helps prevent two clerks from selling the same final room." },
  { title: "Guest records", icon: Users, text: "Maintain guest profiles, merge duplicates when appropriate and limit visibility of identity details by role. Optional ID photos are private and off by default. When enabled, access is logged and photos are scheduled for deletion under the product’s 12-month retention rule." },
  { title: "Folios, charges and payment records", icon: Wallet, text: "Record room charges, payments, tax lines, discounts, adjustments, refunds and reversals. Issued invoices are not silently edited, and a duplicate-payment warning helps staff spot a possible repeat entry. Zikora records payments made through the hotel’s existing process; integrated online card or transfer collection inside Zikora is not currently available." },
  { title: "Cashiering and collections", icon: Calculator, text: "Open a cashier shift with a float, record payments, count and close the shift. Review what remains open before the day ends. For guests who leave with an outstanding balance, log follow-ups such as called, promised, unreachable or disputed, and record the next due date." },
  { title: "Approvals and staff permissions", icon: ShieldCheck, text: "Set roles and approval limits. Discounts above configured limits, adjustments, reversals and refunds require another authorised person’s approval. A requester cannot approve their own request, and staff cannot grant permissions they do not hold." },
  { title: "Housekeeping and guest service", icon: BedDouble, text: "Create cleaning tasks at check-out or room moves, assign work, track completion and require a separate inspection. Record minibar activity, lost-and-found items and guest service requests such as laundry or food; completed service requests can post the relevant charge to the folio once." },
  { title: "Maintenance", icon: Wrench, text: "Assign a ticket, track it through work and resolution, attach up to five photos, and close it through a separate person. Block a room from sale while it is unavailable." },
  { title: "Business day and reporting", icon: BarChart3, text: "The configured business-date rollover handles nightly room charges, no-shows, expired booking holds and stored daily figures. If the rollover fails, it is designed to leave the data unchanged and alert managers. Review occupancy, ADR, RevPAR, revenue by charge code, payments, outstanding balances, ageing and collections, with CSV exports and an owner summary." },
  { title: "Setup and continuity", icon: WifiOff, text: "Use guided setup for rooms, room types, rate plans, prices, taxes, charge codes and payment methods. Import supported data by CSV. If the connection drops, a device that has signed in keeps showing the lists it last loaded, such as arrivals, in-house guests and the room board. Charges, payments and housekeeping updates entered meanwhile wait on the device and send when the connection returns. Check-in, check-out, room moves and approvals need a connection. A printable downtime pack covers longer disruptions." },
];


const slug = (t: string) => t.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
// Split a paragraph into sentences: the first is the lead, the rest are short lines.
const sentences = (t: string) => t.split(/(?<=\.) (?=[A-Z])/);

function Features() {
  useScrollReveal();
  return (
    <>
      <section className="mer-hero relative overflow-hidden border-b border-border/60">
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 text-center sm:px-6 sm:pb-20 sm:pt-20">
          <div className="hs-fade mx-auto max-w-3xl">
            <p className="text-sm font-semibold text-primary-strong">Features</p>
            <h1 className="font-sans text-balance mt-3 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">The workflows behind a well-run hotel.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] text-muted-foreground sm:text-lg">Zikora connects the work that happens between a booking and the end-of-day review. Each team has the tools and records it needs, while managers can follow activity across the operation.</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg"><Link to="/auth" search={{ mode: "signup" }}>Start 60 days free</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/pricing">See pricing</Link></Button>
            </div>
          </div>
          <nav aria-label="Jump to an area" className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-2">
            {AREAS.map((a) => (
              <a key={a.title} href={`#${slug(a.title)}`} className="inline-flex min-h-9 items-center rounded-full border border-border/70 bg-card px-3.5 text-sm font-semibold text-foreground/80 outline-none hover:border-primary/40 hover:text-primary-strong focus-visible:ring-3 focus-visible:ring-ring/40 pointer-coarse:min-h-11">{a.title}</a>
            ))}
          </nav>
        </div>
      </section>
      <Section className="py-6 sm:py-10">
        <ol className="divide-y divide-border/70">
          {AREAS.map((a, i) => {
            const [lead, ...rest] = sentences(a.text);
            return (
              <li key={a.title} id={slug(a.title)} data-reveal className="scroll-mt-24 grid gap-6 py-10 sm:py-14 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12">
                <div>
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary-strong"><a.icon className="size-5" /></span>
                    <span aria-hidden className="text-sm font-semibold tabular-nums text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h2 className="font-sans mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{a.title}</h2>
                </div>
                <div>
                  <p className="text-base font-medium leading-relaxed sm:text-lg">{lead}</p>
                  {rest.length > 0 && (
                    <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-muted-foreground">
                      {rest.map((x) => <li key={x} className="flex gap-3"><span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />{x}</li>)}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Section>
      <ClosingCta title="Try it on your own hotel, free for 60 days." text="Every feature. No card needed." button="Start free trial" />
    </>
  );
}
