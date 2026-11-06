import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BedDouble, ClipboardCheck, CreditCard, KeyRound, LayoutGrid, Scale, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { Section } from "@/components/public/public-layout";
import { ClosingCta } from "@/components/public/home-sections";
import { useScrollReveal } from "@/components/public/home/use-scroll-reveal";
import { Button } from "@/components/ui/button";
import { SITE_INFO } from "@/lib/site-info";
import { ORGANIZATION_LD, pageHead } from "@/lib/seo";

const TITLE = "About Zikora | Hotel Management Software for Modern Hotels";
const DESCRIPTION = "Why Zikora is being built: to connect hotel operations and bring more accountability to rooms, service and financial records.";

export const Route = createFileRoute("/_public/about")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, path: "/about", jsonLd: [ORGANIZATION_LD] }),
  component: About,
});

/*
 * No founding story, customer base, team size or results are stated here: none is approved.
 * Every line describes what the product does today (checked against Features, Security and the FAQ) or says plainly that it is a plan.
 */
const HANDOVERS: { from: string; to: string }[] = [
  { from: "A booking", to: "becomes an arrival." },
  { from: "A room move", to: "becomes a housekeeping task." },
  { from: "A guest request", to: "may become a charge." },
  { from: "A payment", to: "must match a record." },
];

const BELIEFS: { icon: LucideIcon; title: string; text: string; proof: string }[] = [
  { icon: Scale, title: "Money records can be traced.", text: "Every charge and payment stays as it was posted. A correction is a new, linked entry, so the history is always there.", proof: "Reversals, adjustments and refunds are linked to the original." },
  { icon: ClipboardCheck, title: "Sensitive decisions need the right person.", text: "Larger discounts, reversals and refunds wait for a second person to approve. The person who asks cannot approve their own request.", proof: "The hotel sets the approval limits." },
  { icon: BedDouble, title: "A room is ready when the work is done.", text: "Check-out opens a cleaning task. A different person inspects the room before it shows as clean.", proof: "Room status follows the work, not a guess." },
  { icon: LayoutGrid, title: "The manager sees the day without a spreadsheet.", text: "Occupancy, revenue and balances are read from the same records the front desk uses, and the day closes the same way every night.", proof: "One record, not three registers." },
  { icon: ShieldCheck, title: "Guest details are handled with care.", text: "Identity numbers are masked unless a role needs them. ID photos are optional, private and off by default.", proof: "See the Security page for the details." },
];

const NOW: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: KeyRound, title: "Built for Nigerian hotels first", text: "Prices are in naira. Tax and service-charge settings can be configured for local rules. Hotels should confirm the right treatment with their accountant." },
  { icon: Sparkles, title: "Working with pilot hotels", text: "The priority is to make the daily workflows dependable, learn from real use, and then grow from what hotels ask for." },
  { icon: CreditCard, title: "Ideas, not promises", text: "Online payment collection, corporate accounts, a booking engine and channel-manager links are ideas on the roadmap. They are not features today." },
];

function About() {
  useScrollReveal();
  return (
    <>
      <section className="mer-hero relative overflow-hidden border-b border-border/60">
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 text-center sm:px-6 sm:pb-20 sm:pt-20">
          <div className="hs-fade mx-auto max-w-3xl">
            <p className="text-sm font-semibold text-primary-strong">About</p>
            <h1 className="font-sans text-balance mt-3 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">Built around the work that keeps a hotel running.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] text-muted-foreground sm:text-lg">Zikora brings reservations, the front desk, money, housekeeping and reports into one system, so a hotel team works from one record.</p>
          </div>
        </div>
      </section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
          <div data-reveal>
            <h2 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">A hotel is a series of handovers.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground sm:text-base">When a handover breaks, the team stops serving guests and starts chasing information. Zikora exists to make each handover leave a record that the next person can trust.</p>
          </div>
          <ul className="divide-y divide-border/70 border-y border-border/70" aria-label="Handovers in a hotel">
            {HANDOVERS.map((h, i) => (
              <li key={h.from} data-reveal style={{ "--i": i } as React.CSSProperties} className="flex items-baseline gap-4 py-5">
                <span aria-hidden className="w-8 shrink-0 text-sm font-bold tabular text-primary">{String(i + 1).padStart(2, "0")}</span>
                <p className="font-sans text-lg font-bold sm:text-xl">{h.from} <span className="font-medium text-muted-foreground">{h.to}</span></p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section className="pt-0">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">What we believe.</h2>
          <p className="mt-3 text-[15px] text-muted-foreground sm:text-base">Five beliefs shape the product. Each one is built into how Zikora works.</p>
        </div>
        <ul className="mt-10 grid border-t border-border/70 md:grid-cols-2" aria-label="What we believe">
          {BELIEFS.map((b, i) => (
            <li key={b.title} data-reveal style={{ "--i": i } as React.CSSProperties} className="mer-cell border-b border-border/70 p-6 md:odd:border-r">
              <span aria-hidden className="mer-icon grid size-10 place-items-center rounded-lg bg-primary-soft text-primary-strong"><b.icon className="size-5" /></span>
              <h3 className="font-sans mt-4 text-lg font-bold">{b.title}</h3>
              <p className="mt-1 text-[15px] text-muted-foreground">{b.text}</p>
              <p className="mt-3 text-sm font-semibold text-primary-strong">{b.proof}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="pt-0">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">Where Zikora is today.</h2>
          <p className="mt-3 text-[15px] text-muted-foreground sm:text-base">{SITE_INFO["legal entity and company details"]} We say what works now, and we label the rest as plans.</p>
        </div>
        <ul className="mt-10 grid gap-5 md:grid-cols-3" aria-label="Where Zikora is today">
          {NOW.map((n, i) => (
            <li key={n.title} data-reveal style={{ "--i": i } as React.CSSProperties} className="mer-lift rounded-xl border border-border/70 bg-card p-6 shadow-card">
              <span aria-hidden className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary-strong"><n.icon className="size-5" /></span>
              <h3 className="font-sans mt-4 text-lg font-bold">{n.title}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{n.text}</p>
            </li>
          ))}
        </ul>
        <div data-reveal className="mt-8 text-center">
          <Button asChild variant="outline"><Link to="/how-it-works">See how a stay runs <ArrowRight className="size-4" aria-hidden /></Link></Button>
        </div>
      </Section>

      <ClosingCta title="Tell us how your hotel works today." text="We would like to understand the problems you want a hotel system to solve." button="Talk to Zikora" toContact />
    </>
  );
}
