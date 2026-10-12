import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, Check, CreditCard, ShieldCheck } from "lucide-react";
import { FaqList } from "@/components/public/faq-two-column";
import { FAQS, PRICING_FAQ_IDS } from "@/components/public/faq-content";
import { Section } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { pageHead } from "@/lib/seo";

const TITLE = "Zikora Pricing | Hotel Management Software Plans";
const DESCRIPTION = "Try Zikora free for 60 days with every feature. Then Starter is ₦30,000 a month, Standard ₦45,000 and Pro ₦80,000.";

export const Route = createFileRoute("/_public/pricing")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, path: "/pricing" }),
  component: Pricing,
});

// Decision A16 (12 Oct 2026). These are the prices in the plans table (migration 20261020130000).
// If a price changes, change the migration (or set it in the platform console) and this list together.
// The page only shows them; the amount a hotel pays always comes from the database.
const PLANS = [
  { name: "Starter", price: "₦30,000", year: "₦300,000", limits: ["Up to 20 rooms", "1 property", "Up to 10 staff users"] },
  { name: "Standard", price: "₦45,000", year: "₦450,000", limits: ["Up to 60 rooms", "1 property", "Up to 25 staff users"] },
  { name: "Pro", price: "₦80,000", year: "₦800,000", limits: ["Up to 150 rooms", "Up to 3 properties", "Up to 60 staff users"] },
] as const;

const REASSURANCE = [
  { icon: BadgeCheck, text: "60 days free, every feature" },
  { icon: CreditCard, text: "No card needed to start" },
  { icon: ShieldCheck, text: "Nothing is deleted if you stop" },
];

const TRIAL_POINTS = [
  "Every feature, with no card needed",
  "We email you 7 days and 1 day before the 60 days end",
  "To keep full access after that, pay for the plan that fits your hotel",
  "If you do not, the hotel becomes read-only. Nothing is deleted",
];

function Pricing() {
  const top = PRICING_FAQ_IDS.map((id) => FAQS.find((f) => f.id === id)!);
  const [billing, setBilling] = useState<"month" | "year">("month");
  return (
    <>
      <section className="landing-hero relative overflow-hidden text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Pricing</p>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">The right tools for <span className="text-gold">the way your hotel runs.</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/85 sm:text-lg">Pick the plan that fits the size of your hotel. Prices are in naira. Pay for a year and get two months free.</p>
          <ul className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-center gap-3 sm:flex-row sm:gap-8">
            {REASSURANCE.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-sm font-semibold">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10"><Icon className="size-4" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <Section className="pb-4 pt-10 sm:pb-4 sm:pt-12">
        <div className="flex justify-center">
          <Tabs value={billing} onValueChange={(v) => setBilling(v as "month" | "year")}>
            <TabsList aria-label="Billing period">
              <TabsTrigger value="month">Monthly</TabsTrigger>
              <TabsTrigger value="year">Annual <span className="ml-1.5 text-xs font-bold text-success-strong">2 months free</span></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="mx-auto mt-8 grid max-w-5xl gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <section key={p.name} className="flex flex-col rounded-2xl border border-border/70 bg-card p-7 shadow-card">
              <h2 className="text-lg font-bold">{p.name}</h2>
              <p className="mt-4 text-4xl font-extrabold tracking-tight tabular">
                {billing === "month" ? p.price : p.year}
                <span className="text-sm font-medium text-muted-foreground"> {billing === "month" ? "a month" : "a year"}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{billing === "month" ? `or ${p.year} a year, two months free` : `Same as ${p.price} a month for 10 months`}</p>
              <ul className="mt-6 space-y-3 border-t border-border/70 pt-6 text-[15px] text-muted-foreground">
                {p.limits.map((l) => <li key={l} className="flex gap-2.5"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-strong" />{l}</li>)}
              </ul>
              <Button asChild variant="outline" className="mt-7 w-full"><Link to="/auth" search={{ mode: "signup" }}>Start free trial</Link></Button>
            </section>
          ))}
        </div>
        <section className="mx-auto mt-5 flex max-w-5xl flex-col items-start justify-between gap-4 rounded-2xl border border-border/70 bg-card p-6 shadow-card sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold">Enterprise</h2>
            <p className="mt-1 text-[15px] text-muted-foreground">For hotel groups with more than 150 rooms or 3 properties. No limit on staff users. We quote the price.</p>
          </div>
          <Button asChild variant="outline" className="shrink-0"><Link to="/contact">Contact us</Link></Button>
        </section>
      </Section>
      <Section className="py-6 sm:py-8">
        <div className="mx-auto max-w-5xl rounded-2xl bg-accent-fill p-8 text-center text-primary-foreground shadow-accent">
          <p className="text-sm font-bold uppercase tracking-wide text-on-primary-muted">New hotels</p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Try Zikora free for 60 days.</h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] text-on-primary-muted">Every feature. No card. Create your hotel, add your rooms and run your front desk, housekeeping and billing for two months before you pay anything.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary"><Link to="/auth" search={{ mode: "signup" }}>Start your free trial</Link></Button>
          </div>
        </div>
      </Section>
      <Section className="pt-0 sm:pt-0">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-xl border border-border/70 bg-card p-6 shadow-card">
            <h2 className="text-lg font-bold">What happens after the 60 days</h2>
            <ul className="mt-3 space-y-2.5 text-[15px] text-muted-foreground">
              {TRIAL_POINTS.map((c) => <li key={c} className="flex gap-2.5"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-strong" />{c}</li>)}
            </ul>
          </section>
        </div>
      </Section>
      <Section className="pt-0 sm:pt-0">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-extrabold tracking-tight">Common questions</h2>
          <div className="mt-5"><FaqList faqs={top} /></div>
          <p className="mt-4 text-sm"><Link to="/faq" className="font-semibold text-primary underline-offset-4 hover:underline">See all questions</Link></p>
          <p className="mt-2 text-sm text-muted-foreground">Not sure which plan fits? <Link to="/contact" className="font-semibold text-primary underline-offset-4 hover:underline">Contact us</Link>.</p>
        </div>
      </Section>
    </>
  );
}
