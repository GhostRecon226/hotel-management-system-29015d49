import { Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, BedDouble, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";

/*
 * Landing hero: dark photo, two-tone headline, product screenshot in a laptop frame.
 * The screenshot is the real dashboard with sample data (public/brand/product-dashboard.jpg).
 * Layout inspired by the reference mock-up Peter shared; code and wording are ours.
 */
const PILLARS = [
  { icon: ReceiptText, text: "A traceable money record" },
  { icon: BedDouble, text: "Rooms tied to the work" },
  { icon: BarChart3, text: "Daily visibility" },
];

export function Hero({ label, lead, rest, text, trust }: { label: string; lead: string; rest: string; text: string; trust: string }) {
  return (
    <section className="landing-hero relative overflow-hidden text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">{label}</p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            {lead} <span className="text-gold">{rest}</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/85 sm:text-lg">{text}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary"><Link to="/walkthrough">Request a walkthrough <ArrowRight aria-hidden /></Link></Button>
            <Button asChild size="lg" variant="outline" className="border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link to="/features">Explore the platform</Link></Button>
          </div>
          <p className="mt-3 text-sm text-white/70">{trust}</p>
          <ul className="mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
            {PILLARS.map(({ icon: Icon, text: t }) => (
              <li key={t} className="flex items-center gap-3">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/25 bg-white/10"><Icon className="size-5" /></span>
                <span className="text-sm font-semibold leading-tight">{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <figure className="mx-auto w-full max-w-xl lg:max-w-none">
          <div className="rounded-t-2xl border border-white/20 bg-black/60 p-2 pb-0 shadow-raised">
            <img src="/brand/product-dashboard.jpg" width={1440} height={900} loading="eager"
              alt="The Zikora dashboard: today's arrivals and departures, rooms occupied, and room status."
              className="block h-auto w-full rounded-t-lg" />
          </div>
          <div aria-hidden className="mx-auto h-2.5 w-[106%] -translate-x-[2.8%] rounded-b-xl bg-white/25" />
          <figcaption className="mt-3 text-center text-xs text-white/60">Sample data</figcaption>
        </figure>
      </div>
    </section>
  );
}
