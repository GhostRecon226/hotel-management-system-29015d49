import { createFileRoute, Link } from "@tanstack/react-router";
import { Eyebrow, Section } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { ORGANIZATION_LD, pageHead } from "@/lib/seo";

const TITLE = "Hotel Software Features: Front Desk, Billing, Housekeeping";
const DESCRIPTION = "See what Zikora does: reservations, check-in, VAT and service charge billing, housekeeping, maintenance and daily reports for Nigerian hotels.";

export const Route = createFileRoute("/_public/features")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, jsonLd: [ORGANIZATION_LD] }),
  component: Features,
});

const AREAS: { title: string; text: string }[] = [
  { title: "Reservations", text: "Take bookings and walk-ins. Choose a room type and dates, see what is available, and hold a room while a guest decides. Set cancellation rules by rate plan, and fees are posted once to the right bill. A room can only be sold once, even when two staff book at the same moment." },
  { title: "Front desk", text: "See arrivals, guests in house and departures at a glance. Check a guest in only when the booking is confirmed, the arrival date has come and the ID is recorded. Move a guest to another room, change the departure date, or undo a check-in or check-out made by mistake on the same day." },
  { title: "Guests", text: "One profile per guest across all your bookings. Merge duplicate profiles, with a reason on record. ID details are hidden from staff who do not need them. If you choose, keep a photo of the ID in private storage, with every view recorded." },
  { title: "Bills and payments", text: "Every charge shows the price, service charge, VAT and any state levy. Record cash, POS, transfer and card payments you take outside the system, including payments in another currency at the rate you set. Take deposits, transfer charges between bills, and print interim and final invoices. Issued invoices never change." },
  { title: "Approvals and control", text: "Discounts above a limit, adjustments, reversals and refunds wait for a second person. The person who asks cannot approve their own request. Every action is recorded with who did it and when." },
  { title: "Housekeeping", text: "Cleaning tasks appear when a guest leaves or moves rooms. Attendants see their own tasks. A supervisor inspects each room, and a failed inspection sends the room back with the defects listed. Hotels without a supervisor can switch inspections off." },
  { title: "Maintenance and service requests", text: "Staff report a fault, assign it, track it and close it. Take a room out of sale while it is repaired, and put it back when it is fixed. Log guest requests, and charge the ones that cost money to the guest's bill once." },
  { title: "Reports and the daily close", text: "Every night the day closes by itself: room charges are posted, guests who did not arrive are marked and the day's figures are saved. Open the app to see occupancy, average daily rate, revenue per available room, outstanding balances and payments. Export bookings, transactions and guests to a spreadsheet." },
  { title: "Staff and access", text: "Use ready-made roles for front desk, reservations, housekeeping, maintenance, cashier and accounts, or make your own. Nobody can give out a permission they do not hold." },
];

function Features() {
  return (
    <Section className="max-w-4xl">
      <Eyebrow>Features</Eyebrow>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Everything your hotel's front office runs on, in one system.</h1>
      <p className="mt-4 max-w-2xl text-base text-muted-foreground">From the first booking to the final invoice, Zikora keeps your team, your rooms and your money in step. Here is what it does today.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {AREAS.map((a) => (
          <section key={a.title} className="rounded-xl border border-border/70 bg-card p-6 shadow-card">
            <h2 className="text-lg font-bold">{a.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{a.text}</p>
          </section>
        ))}
      </div>
      <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl bg-accent-fill p-8 text-primary-foreground shadow-accent sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-extrabold tracking-tight">See it with your own rooms.</h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary"><Link to="/auth">Start your free trial</Link></Button>
          <Button asChild variant="secondary"><Link to="/contact">Talk to us</Link></Button>
        </div>
      </div>
    </Section>
  );
}
