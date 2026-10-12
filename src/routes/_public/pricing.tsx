import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { FaqList } from "@/components/public/faq-two-column";
import { FAQS, PRICING_FAQ_IDS } from "@/components/public/faq-content";
import { Eyebrow, Section } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
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

const TRIAL_POINTS = [
  "Every feature, with no card needed",
  "We email you 7 days and 1 day before the 60 days end",
  "To keep full access after that, pay for the plan that fits your hotel",
  "If you do not, the hotel becomes read-only. Nothing is deleted",
];

function Pricing() {
  const top = PRICING_FAQ_IDS.map((id) => FAQS.find((f) => f.id === id)!);
  return (
    <>
      <Section className="pb-10 text-center sm:pb-12">
        <Eyebrow>Pricing</Eyebrow>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">The right tools for the way your hotel runs.</h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">Pick the plan that fits the size of your hotel. Prices are in naira, per month. Pay for a year and get two months free.</p>
      </Section>
      <Section className="pb-4 pt-0 sm:pb-4 sm:pt-0">
        <div className="mx-auto max-w-4xl rounded-2xl bg-accent-fill p-8 text-center text-primary-foreground shadow-accent">
          <p className="text-sm font-bold uppercase tracking-wide text-on-primary-muted">New hotels</p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Try Zikora free for 60 days.</h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] text-on-primary-muted">Every feature. No card. Create your hotel, add your rooms and run your front desk, housekeeping and billing for two months before you pay anything.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary"><Link to="/auth" search={{ mode: "signup" }}>Start your free trial</Link></Button>
          </div>
        </div>
      </Section>
      <Section className="pt-6 sm:pt-8">
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <section key={p.name} className="flex flex-col rounded-xl border border-border/70 bg-card p-6 shadow-card">
              <h2 className="text-lg font-bold">{p.name}</h2>
              <p className="mt-3 text-3xl font-extrabold tracking-tight tabular">{p.price}<span className="text-sm font-medium text-muted-foreground"> a month</span></p>
              <p className="mt-1 text-sm text-muted-foreground">or {p.year} a year</p>
              <ul className="mt-4 space-y-2.5 text-[15px] text-muted-foreground">
                {p.limits.map((l) => <li key={l} className="flex gap-2.5"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-strong" />{l}</li>)}
              </ul>
            </section>
          ))}
          <section className="flex flex-col rounded-xl border border-border/70 bg-card p-6 shadow-card">
            <h2 className="text-lg font-bold">Enterprise</h2>
            <p className="mt-3 text-3xl font-extrabold tracking-tight">Quoted</p>
            <p className="mt-1 text-sm text-muted-foreground">for hotel groups</p>
            <ul className="mt-4 space-y-2.5 text-[15px] text-muted-foreground">
              <li className="flex gap-2.5"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-strong" />More than 150 rooms or 3 properties</li>
              <li className="flex gap-2.5"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-strong" />No limit on staff users</li>
            </ul>
            <Button asChild variant="outline" className="mt-5"><Link to="/contact">Contact us</Link></Button>
          </section>
        </div>
      </Section>
      <Section className="pt-0 sm:pt-0">
        <div className="mx-auto max-w-4xl">
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
