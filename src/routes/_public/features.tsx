import { createFileRoute, Link } from "@tanstack/react-router";
import { Eyebrow, Section } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { ORGANIZATION_LD, pageHead } from "@/lib/seo";

const TITLE = "Hotel Management Features | Zikora";
const DESCRIPTION = "Explore Zikora workflows for reservations, front desk, guest folios, cashiering, approvals, housekeeping, maintenance and hotel reporting.";

export const Route = createFileRoute("/_public/features")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, path: "/features", jsonLd: [ORGANIZATION_LD] }),
  component: Features,
});

// Every sentence comes from the v3 copy and was checked against the status document of 10 Oct 2026.
const AREAS: { title: string; text: string }[] = [
  { title: "Reservations and front desk", text: "Manage bookings by room type and rate plan, place time-limited holds, handle group bookings and apply configured cancellation and no-show rules. Use arrivals, in-house and departures lists to manage check-ins, walk-ins, room moves, extensions and supported stay corrections. A last-room safeguard helps prevent two clerks from selling the same final room." },
  { title: "Guest records", text: "Maintain guest profiles, merge duplicates when appropriate and limit visibility of identity details by role. Optional ID photos are private and off by default. When enabled, access is logged and photos are scheduled for deletion under the product’s 12-month retention rule." },
  { title: "Folios, charges and payment records", text: "Record room charges, payments, tax lines, discounts, adjustments, refunds and reversals. Issued invoices are not silently edited, and a duplicate-payment warning helps staff spot a possible repeat entry. Zikora records payments made through the hotel’s existing process; integrated online card or transfer collection inside Zikora is not currently available." },
  { title: "Cashiering and collections", text: "Open a cashier shift with a float, record payments, count and close the shift. Review what remains open before the day ends. For guests who leave with an outstanding balance, log follow-ups such as called, promised, unreachable or disputed, and record the next due date." },
  { title: "Approvals and staff permissions", text: "Set roles and approval limits. Discounts above configured limits, adjustments, reversals and refunds require another authorised person’s approval. A requester cannot approve their own request, and staff cannot grant permissions they do not hold." },
  { title: "Housekeeping and guest service", text: "Create cleaning tasks at check-out or room moves, assign work, track completion and require a separate inspection. Record minibar activity, lost-and-found items and guest service requests such as laundry or food; completed service requests can post the relevant charge to the folio once." },
  { title: "Maintenance", text: "Assign a ticket, track it through work and resolution, attach up to five photos, and close it through a separate person. Block a room from sale while it is unavailable." },
  { title: "Business day and reporting", text: "The configured business-date rollover handles nightly room charges, no-shows, expired booking holds and stored daily figures. If the rollover fails, it is designed to leave the data unchanged and alert managers. Review occupancy, ADR, RevPAR, revenue by charge code, payments, outstanding balances, ageing and collections, with CSV exports and an owner summary." },
  { title: "Setup and continuity", text: "Use guided setup for rooms, room types, rate plans, prices, taxes, charge codes and payment methods. Import supported data by CSV. If the connection drops, a device that has signed in keeps showing the lists it last loaded, such as arrivals, in-house guests and the room board. Charges, payments and housekeeping updates entered meanwhile wait on the device and send when the connection returns. Check-in, check-out, room moves and approvals need a connection. A printable downtime pack covers longer disruptions." },
];

function Features() {
  return (
    <Section className="max-w-4xl">
      <Eyebrow>Features</Eyebrow>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">The workflows behind a well-run hotel.</h1>
      <p className="mt-4 max-w-2xl text-base text-muted-foreground">Zikora connects the work that happens between a booking and the end-of-day review. Each team has the tools and records it needs, while managers can follow activity across the operation.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {AREAS.map((a) => (
          <section key={a.title} className="rounded-xl border border-border/70 bg-card p-6 shadow-card">
            <h2 className="text-lg font-bold">{a.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{a.text}</p>
          </section>
        ))}
      </div>
      <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl bg-accent-fill p-8 text-primary-foreground shadow-accent sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-extrabold tracking-tight">See the workflows that matter to your hotel.</h2>
        <Button asChild variant="secondary"><Link to="/walkthrough">Request a walkthrough</Link></Button>
      </div>
    </Section>
  );
}
