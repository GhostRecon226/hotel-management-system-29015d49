import { Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, BedDouble, CalendarDays, ConciergeBell, Download, Globe2, Lock, Receipt, Sparkles, Wifi, type LucideIcon } from "lucide-react";
import { Section } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";

/*
 * Extra home and pricing sections. Ideas only (a night-shift story, role screens, size bands, growth steps);
 * all wording is ours and every claim is checked against the app. No customer numbers or quotes: there are none yet.
 */

export function NightShift() {
  return (
    <Section className="pt-0 sm:pt-0">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Tuesday, 11:40pm. Check-out is in the morning.</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">A guest asks for a big discount on the way up to bed. The night receptionist is alone. Earlier, a guest was moved to another room and nobody told housekeeping.</p>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">With Zikora, a discount above the limit waits for a manager to approve it. The room move creates a cleaning task. Every change is on record with a name against it. In the morning you open the app and see what happened, instead of asking.</p>
      </div>
    </Section>
  );
}

const ROLES = [
  { who: "Front desk", line: "See today's arrivals, guests in house and departures. Check a guest in, take payment, move a room." },
  { who: "Housekeeping", line: "See the rooms to clean and the rooms to inspect. Mark each one started and done." },
  { who: "Manager and accounts", line: "Approve discounts and refunds. Read the day's figures and export them to a spreadsheet." },
];

export function RoleScreens() {
  return (
    <Section className="pt-0 sm:pt-0">
      <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">Each person sees what their job needs</h2>
      <div className="mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r.who} className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
            <h3 className="font-bold">{r.who}</h3>
            <p className="mt-2 text-[15px] text-muted-foreground">{r.line}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

const STAGES = [
  { n: "1", title: "One hotel", text: "Set up your rooms, rates and staff and take your first booking." },
  { n: "2", title: "A second hotel", text: "A manager adds another property, within what your plan allows." },
  { n: "3", title: "Keep the same system", text: "Each hotel has its own rooms, rates and team. Switch between them in the app." },
];

export function GrowthStrip() {
  return (
    <Section className="pt-0 sm:pt-0">
      <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">Start with one hotel. Add more when you are ready.</h2>
      <ol className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
        {STAGES.map((s) => (
          <li key={s.n} className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
            <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-sm font-extrabold text-primary-strong" aria-hidden>{s.n}</span>
            <h3 className="mt-3 font-bold">{s.title}</h3>
            <p className="mt-1 text-[15px] text-muted-foreground">{s.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

// Size bands are a draft. Plans and prices are still an open decision (A16); change these when it is made.
const BANDS = ["1 to 24 rooms", "25 to 40 rooms", "41 to 80 rooms", "81 to 200 rooms", "More than 200 rooms"];

export function SizeBands() {
  return (
    <Section className="pt-0 sm:pt-0">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-extrabold tracking-tight">Priced by the size of your hotel</h2>
        <p className="mt-2 text-[15px] text-muted-foreground">Your price depends on the number of rooms. We agree it with you, in your hotel's currency.</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {BANDS.map((b) => <li key={b} className="rounded-full border border-border/70 bg-card px-3.5 py-1.5 text-sm font-semibold">{b}</li>)}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground"><Link to="/contact" className="font-semibold text-primary underline-offset-4 hover:underline">Ask for your price</Link></p>
      </div>
    </Section>
  );
}

const FACTS: { icon: LucideIcon; text: string }[] = [
  { icon: Globe2, text: "Data stored in the European Union (Ireland)" },
  { icon: Lock, text: "Each hotel's data kept apart from every other hotel's" },
  { icon: Wifi, text: "Runs in your browser. Nothing to install" },
  { icon: Download, text: "Export to a spreadsheet at any time" },
];

/** Facts strip under the hero. Real facts only: there are no customer names or logos to show yet. */
export function FactsStrip() {
  return (
    <section aria-label="Built for independent hotels" className="border-b border-border/70 bg-card">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Built in Africa, for independent hotels</p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm font-semibold">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-strong"><Icon className="size-4" /></span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const TILES: { icon: LucideIcon; title: string; text: string; tone: string }[] = [
  { icon: CalendarDays, title: "Reservations", text: "Take bookings and walk-ins. A room is never booked twice.", tone: "bg-primary-soft text-primary-strong" },
  { icon: ConciergeBell, title: "Front desk", text: "Check guests in and out. Arrivals, in house and departures on one screen.", tone: "bg-warning-soft text-warning-strong" },
  { icon: BedDouble, title: "Rooms", text: "See which rooms are clean, dirty or out of order.", tone: "bg-info-soft text-info-strong" },
  { icon: Sparkles, title: "Housekeeping", text: "A cleaning task appears when a guest leaves or moves rooms.", tone: "bg-info-soft text-info-strong" },
  { icon: Receipt, title: "Billing and folio", text: "Service charge and VAT on every charge, in your currency.", tone: "bg-danger-soft text-danger-strong" },
  { icon: BarChart3, title: "Reports", text: "Occupancy, ADR and RevPAR every morning. Export to a spreadsheet.", tone: "bg-success-soft text-success-strong" },
];

/** "Everything you need" block: heading, six tiles and a photo card. */
export function AllInOne() {
  return (
    <Section>
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,4fr)_minmax(0,6fr)_minmax(0,3.4fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-strong">All in one place</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Everything you need to run a modern hotel</h2>
          <p className="mt-4 text-[15px] text-muted-foreground">From the booking to the housekeeping round to the final bill, your whole operation lives in one system.</p>
          <Button asChild size="lg" className="mt-6"><Link to="/features">Explore features <ArrowRight aria-hidden /></Link></Button>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TILES.map(({ icon: Icon, title, text, tone }) => (
            <li key={title} className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
              <span aria-hidden className={`grid size-10 place-items-center rounded-lg ${tone}`}><Icon className="size-5" /></span>
              <h3 className="mt-3 text-[15px] font-bold">{title}</h3>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
        <div className="landing-hero relative hidden min-h-72 overflow-hidden rounded-2xl text-white xl:block xl:h-full">
          <p className="absolute inset-x-4 bottom-4 rounded-xl bg-black/45 px-4 py-3 text-sm font-semibold backdrop-blur-sm">A smooth check-in. A correct bill. A room that is ready.</p>
        </div>
      </div>
    </Section>
  );
}
