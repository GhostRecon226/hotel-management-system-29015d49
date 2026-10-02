import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BadgeCheck, BedDouble, ConciergeBell, FileText, ShieldCheck, Users, Wifi } from "lucide-react";
import { Hero } from "@/components/public/hero";
import { FeatureGrid } from "@/components/public/feature-grid";
import { Section } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { hasStoredSession } from "@/lib/session-hint";

const TITLE = "Hotel Desk: front desk, rooms and bills for hotels in Nigeria";
const DESCRIPTION = "Run your hotel's bookings, check-in and check-out, rooms, housekeeping and guest bills in one place, in naira. 30-day free trial, no card needed.";

export const Route = createFileRoute("/_public/")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESCRIPTION }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESCRIPTION }, { property: "og:type", content: "website" }] }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  // Signed-in users go to the app, as before. Only "/" redirects; other public pages stay readable.
  useEffect(() => { if (hasStoredSession()) navigate({ to: "/dashboard", replace: true }); }, [navigate]);

  return (
    <>
      <Hero label="Built for hotels in Nigeria"
        title="Run your hotel's front desk, rooms and bills in one place."
        text="Hotel Desk helps independent hotels take bookings, check guests in and out, keep rooms ready and keep every bill correct, in naira." />

      <Section className="pt-4 sm:pt-6">
        <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">Everything the front office needs</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[15px] text-muted-foreground">One system for the desk, housekeeping, maintenance and the accounts.</p>
        <div className="mt-10">
          <FeatureGrid items={[
            { icon: ConciergeBell, title: "Front desk", text: "Bookings, walk-ins, check-in and check-out. See today's arrivals, guests in house and departures at a glance." },
            { icon: BedDouble, title: "Rooms and housekeeping", text: "Know which rooms are clean, dirty or out of order. Cleaning tasks appear when guests leave or move rooms." },
            { icon: FileText, title: "Bills you can trust", text: "Service charge and VAT worked out on every charge, in naira. Print interim and final invoices." },
            { icon: ShieldCheck, title: "Nothing changes quietly", text: "Discounts above a limit, adjustments, reversals and refunds need a second person, and every change is on record." },
            { icon: Users, title: "The right access for each person", text: "Ready-made roles for front desk, reservations, housekeeping, maintenance, cashier and accounts, or make your own." },
            { icon: BadgeCheck, title: "Figures every morning", text: "The day closes by itself each night. See occupancy, ADR and RevPAR, and export to a spreadsheet." },
          ]} />
        </div>
      </Section>

      <Section className="pt-0 sm:pt-0">
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-border/70 bg-card p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-info-soft text-info-strong" aria-hidden><Wifi className="size-6" /></span>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Works in your browser</h2>
            <p className="mt-1 text-[15px] text-muted-foreground">On a computer, tablet or phone. Nothing to install. It needs an internet connection.</p>
          </div>
        </div>
      </Section>

      <Section className="pt-0 sm:pt-0">
        <div className="relative overflow-hidden rounded-2xl bg-accent-fill px-6 py-12 text-center text-primary-foreground shadow-accent sm:px-12">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10" />
          <h2 className="relative text-2xl font-extrabold tracking-tight sm:text-3xl">Try it free for 30 days</h2>
          <p className="relative mx-auto mt-2 max-w-xl text-[15px] text-on-primary-muted">No card needed. After the trial, pricing depends on the size of your hotel.</p>
          <div className="relative mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary"><Link to="/auth">Start free trial</Link></Button>
            <Button asChild size="lg" variant="secondary"><Link to="/pricing">See pricing</Link></Button>
          </div>
        </div>
      </Section>
    </>
  );
}
