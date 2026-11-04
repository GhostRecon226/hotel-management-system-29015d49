import { Link } from "@tanstack/react-router";
import { ArrowRight, BedDouble, CalendarDays, CheckCircle2, ConciergeBell, Home, Sparkles, Users, Wallet, BarChart3, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/*
 * Home hero (Meridian direction, Nov 2026): a large heavy headline with one italic accent word, two buttons,
 * and a tilted sample screen with floating cards. Sample Hotel data only; nothing here calls a database.
 * Figures agree with the previews further down (20 rooms, 15 sold, 75%). No currency symbol on sample data.
 * Zikora is for hotel owners, managers and staff, so nothing here speaks to guests.
 */
const SIDE: { icon: LucideIcon; label: string; on?: boolean }[] = [
  { icon: Home, label: "Home", on: true }, { icon: CalendarDays, label: "Reservations" }, { icon: ConciergeBell, label: "Front desk" },
  { icon: BedDouble, label: "Rooms" }, { icon: Users, label: "Guests" }, { icon: Wallet, label: "Money" }, { icon: BarChart3, label: "Reports" },
];
const TILES = [
  { label: "Occupancy", value: "75%", note: "15 of 20 rooms" },
  { label: "Arrivals today", value: "3", note: "Waiting to check in" },
  { label: "Departures today", value: "2", note: "Bills to settle" },
  { label: "Rooms ready", value: "2", note: "Vacant and clean" },
];
const ROWS: { guest: string; room: string; status: string; variant: "success" | "info" | "warning" }[] = [
  { guest: "Guest A", room: "Room 106 · Deluxe", status: "Confirmed", variant: "success" },
  { guest: "Guest B", room: "Room 104 · Standard", status: "Confirmed", variant: "success" },
  { guest: "Guest C", room: "Room 203 · Suite", status: "Confirmed", variant: "success" },
];

function FloatCard({ icon: Icon, title, text, className, delay }: { icon: LucideIcon; title: string; text: string; className: string; delay: string }) {
  return (
    <div className={`hs-settle absolute hidden items-center gap-3 rounded-xl border border-border/70 bg-card/95 px-4 py-3 shadow-raised backdrop-blur lg:flex ${className}`} style={{ animationDelay: delay }}>
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-strong"><Icon className="size-4" /></span>
      <div>
        <p className="text-[13px] font-bold leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function SampleScreen() {
  return (
    <div className="mer-tilt overflow-hidden rounded-2xl border border-border/70 bg-card shadow-raised" role="img"
      aria-label="Sample Zikora home screen showing occupancy, arrivals, departures, rooms ready and today's reservations. Sample data.">
      <div className="flex items-center gap-1.5 border-b border-border/70 bg-muted/50 px-4 py-2.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-danger/70" /><span className="size-2.5 rounded-full bg-warning/70" /><span className="size-2.5 rounded-full bg-success/70" />
        <span className="ml-3 rounded-md bg-card px-3 py-0.5 text-xs text-muted-foreground">Sample Hotel · 20 rooms</span>
        <Badge variant="neutral" className="ml-auto">Sample Data</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[9.5rem_minmax(0,1fr)]" aria-hidden>
        <ul className="mer-ink hidden flex-col gap-1 p-3 md:flex">
          {SIDE.map(({ icon: Icon, label, on }) => (
            <li key={label} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold ${on ? "bg-white/15 text-white" : "text-white/70"}`}><Icon className="size-3.5" />{label}</li>
          ))}
        </ul>
        <div className="p-4 text-left sm:p-5">
          <p className="text-sm font-bold">Good morning</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {TILES.map((t) => (
              <div key={t.label} className="rounded-xl border border-border/70 bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">{t.label}</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight tabular">{t.value}</p>
                <p className="text-xs text-muted-foreground">{t.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 hidden overflow-hidden rounded-xl border border-border/70 sm:block">
            <div className="grid grid-cols-[1fr_1.4fr_1fr] bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground"><span>Arrival</span><span>Room</span><span>Status</span></div>
            {ROWS.map((r) => (
              <div key={r.guest} className="grid grid-cols-[1fr_1.4fr_1fr] items-center border-t border-border/70 px-3 py-2 text-xs">
                <span className="font-semibold">{r.guest}</span><span className="text-muted-foreground">{r.room}</span><span><Badge variant={r.variant}>{r.status}</Badge></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="mer-hero relative overflow-hidden">
      <svg aria-hidden viewBox="0 0 1200 200" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full text-primary/25 sm:h-56">
        <path d="M0 160 C150 110 260 150 400 120 S650 70 800 110 S1080 140 1200 100 L1200 200 L0 200Z" fill="currentColor" fillOpacity="0.12" />
        <path d="M0 160 C150 110 260 150 400 120 S650 70 800 110 S1080 140 1200 100" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M0 185 C200 150 360 180 560 150 S900 130 1200 160" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 text-center sm:px-6 sm:pb-24 sm:pt-16">
        <div className="hs-fade mx-auto max-w-3xl">
          <h1 className="font-sans text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            The operating system for modern <em className="font-display font-medium italic text-primary">hotels</em>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Zikora brings reservations, front desk, housekeeping and billing into one system, so owners, managers and staff work from the same record.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/auth" search={{ mode: "signup" }}>Start 60 days free <ArrowRight aria-hidden /></Link></Button>
            <Button asChild size="lg" variant="outline"><a href="#preview">See Zikora in action</a></Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Every feature. No card needed.</p>
        </div>
        <div className="relative mx-auto mt-12 max-w-4xl sm:mt-16" data-hero-screen>
          <SampleScreen />
          <FloatCard icon={CheckCircle2} title="Check-in complete" text="Guest A · Room 106" className="lg:-left-40 lg:top-28" delay="0.5s" />
          <FloatCard icon={Sparkles} title="Cleaning done" text="Room 104 · inspection next" className="lg:-right-40 lg:top-56" delay="0.7s" />
          <FloatCard icon={Wallet} title="Payment recorded" text="26,000 on the folio" className="lg:-bottom-6 lg:left-6" delay="0.9s" />
        </div>
      </div>
    </section>
  );
}
