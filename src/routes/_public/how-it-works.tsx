import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, BedDouble, CalendarDays, ConciergeBell, LogOut, Settings2, Wallet, type LucideIcon } from "lucide-react";
import { Section } from "@/components/public/public-layout";
import { ClosingCta } from "@/components/public/home-sections";
import { Facts } from "@/components/public/home/facts";
import { Preview } from "@/components/public/home/preview";
import { useScrollReveal } from "@/components/public/home/use-scroll-reveal";
import { Button } from "@/components/ui/button";
import { ORGANIZATION_LD, pageHead } from "@/lib/seo";

const TITLE = "How Zikora Works | Hotel Management Software";
const DESCRIPTION = "Follow one guest through a stay in Zikora: set up, booking, check-in, the stay, check-out and the daily review, and see what each team does at every step.";

export const Route = createFileRoute("/_public/how-it-works")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, path: "/how-it-works", jsonLd: [ORGANIZATION_LD] }),
  component: HowItWorks,
});

/*
 * One guest, from set-up to the daily review. Every line describes something the product does today
 * and is taken from the checked Features copy, the FAQ and the app itself. No results, no integrations.
 */
const STEPS: { icon: LucideIcon; title: string; who: string; lead: string; points: string[] }[] = [
  { icon: Settings2, title: "Set up your hotel", who: "Manager or owner",
    lead: "Guided setup walks you through the rooms, room types, rate plans, prices, taxes, charge codes and payment methods.",
    points: ["Import supported data by CSV.", "Set roles and approval limits, so each person sees and does only their part.", "A new hotel starts with a 60 day free trial and every feature."] },
  { icon: CalendarDays, title: "Take a booking", who: "Reservations and front desk",
    lead: "Book by room type and rate plan, place a time-limited hold, or enter a group booking.",
    points: ["A last-room safeguard stops two clerks selling the same final room.", "Configured cancellation and no-show rules apply.", "Room blocks take a room out of sale, and re-check that nothing is oversold."] },
  { icon: ConciergeBell, title: "Check the guest in", who: "Front desk",
    lead: "Arrivals, in-house guests and departures each have their own list. Check in a booked guest, or add a walk-in.",
    points: ["Identity details are visible only to roles that need them.", "Optional ID photos are private and off by default.", "Move a guest to another room, or change the departure date, from the same screen."] },
  { icon: Wallet, title: "Run the stay", who: "Front desk and accounts",
    lead: "Room charges, payments and tax lines go on the guest folio, and the folio balance is always read from the record.",
    points: ["Room charges post once each night.", "Discounts, adjustments, reversals and refunds above a limit need a second person to approve.", "A duplicate-payment warning helps staff spot a repeat entry."] },
  { icon: LogOut, title: "Check out and invoice", who: "Front desk and housekeeping",
    lead: "Check-out needs every folio settled, or an approved exception. The invoice is issued and does not change afterwards.",
    points: ["The room shows as dirty and a cleaning task opens.", "A different person inspects the room before it shows as clean.", "A same-day mistake can be undone on the same business date."] },
  { icon: BarChart3, title: "Close the day and review", who: "Managers and owners",
    lead: "The business day rolls over the same way each night: room charges post, expired holds clear and the daily figures are saved.",
    points: ["Review occupancy, ADR and RevPAR, revenue by charge code and outstanding balances.", "Export reports as CSV, and read the owner summary.", "If the rollover fails, it leaves the data unchanged and alerts managers."] },
];

const TEAMS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ConciergeBell, title: "Front desk", text: "Arrivals, in-house and departures in one place, with check-in, room moves and check-out." },
  { icon: BedDouble, title: "Housekeeping", text: "Cleaning tasks that open at check-out. Room attendants see the tasks assigned to them, on a phone." },
  { icon: Wallet, title: "Accounts", text: "Folios, payments, invoices, cashier shifts and collections, with approvals for the larger changes." },
  { icon: BarChart3, title: "Managers and owners", text: "Daily figures, the owner summary and a record of who did what." },
];

function HowItWorks() {
  useScrollReveal();
  return (
    <>
      <section className="mer-hero relative overflow-hidden border-b border-border/60">
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 text-center sm:px-6 sm:pb-20 sm:pt-20">
          <div className="hs-fade mx-auto max-w-3xl">
            <p className="text-sm font-semibold text-primary-strong">How it works</p>
            <h1 className="font-sans text-balance mt-3 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">One guest, one record, from booking to invoice.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] text-muted-foreground sm:text-lg">Follow a stay through Zikora, and see what each team does at every step.</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg"><Link to="/auth" search={{ mode: "signup" }}>Start 60 days free</Link></Button>
              <Button asChild size="lg" variant="outline"><a href="#preview">See the screens</a></Button>
            </div>
          </div>
        </div>
      </section>
      <Section className="py-6 sm:py-10">
        <ol aria-label="A stay, step by step" className="divide-y divide-border/70">
          {STEPS.map((s, i) => (
            <li key={s.title} data-reveal className="grid gap-6 py-10 sm:py-14 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12">
              <div>
                <div className="flex items-center gap-3">
                  <span aria-hidden className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary-strong"><s.icon className="size-5" /></span>
                  <span aria-hidden className="text-sm font-semibold tabular-nums text-muted-foreground">Step {i + 1}</span>
                </div>
                <h2 className="font-sans mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{s.title}</h2>
                <p className="mt-2 text-sm font-semibold text-primary-strong">{s.who}</p>
              </div>
              <div>
                <p className="text-base font-medium leading-relaxed sm:text-lg">{s.lead}</p>
                <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-muted-foreground">
                  {s.points.map((x) => <li key={x} className="flex gap-3"><span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />{x}</li>)}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <Preview />
      <Facts />
      <Section className="pt-0">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">Who uses it.</h2>
          <p className="mt-3 text-[15px] text-muted-foreground sm:text-base">Each team sees the same facts, with the tools for its own part.</p>
        </div>
        <ul className="mt-10 grid border-t border-border/70 sm:grid-cols-2 lg:grid-cols-4">
          {TEAMS.map((t, i) => (
            <li key={t.title} data-reveal style={{ "--i": i } as React.CSSProperties} className="mer-cell border-b border-border/70 p-6 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(4n)]:border-r-0">
              <span aria-hidden className="mer-icon grid size-10 place-items-center rounded-lg bg-primary-soft text-primary-strong"><t.icon className="size-5" /></span>
              <h3 className="font-sans mt-4 text-lg font-bold">{t.title}</h3>
              <p className="mt-1 text-[15px] text-muted-foreground">{t.text}</p>
            </li>
          ))}
        </ul>
      </Section>
      <ClosingCta title="Try it on your own hotel." text="60 days free, every feature, no card needed." />
    </>
  );
}
