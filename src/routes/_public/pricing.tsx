import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, CreditCard, ShieldCheck } from "lucide-react";
import { FaqList } from "@/components/public/faq-two-column";
import { FAQS, PRICING_FAQ_IDS } from "@/components/public/faq-content";
import { Section } from "@/components/public/public-layout";
import { PlanCards } from "@/components/public/plan-cards";
import { useScrollReveal } from "@/components/public/home/use-scroll-reveal";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { pageHead } from "@/lib/seo";

const TITLE = "Zikora Pricing | Hotel Management Software Plans";
const DESCRIPTION = "Try Zikora free for 60 days with every feature. Then Starter is ₦30,000 a month, Standard ₦45,000 and Pro ₦80,000.";

export const Route = createFileRoute("/_public/pricing")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, path: "/pricing" }),
  component: Pricing,
});

const REASSURANCE = [
  { icon: BadgeCheck, text: "60 days free, every feature" },
  { icon: CreditCard, text: "No card needed to start" },
  { icon: ShieldCheck, text: "Nothing is deleted if you stop" },
];

// The plan prices and limits live in src/lib/plan-list.ts, shared with the home page.
const TRIAL_STEPS = [
  { when: "Days 1 to 60", text: "Every feature, with no card needed. We email you 7 days and 1 day before the 60 days end." },
  { when: "Day 61", text: "Your hotel moves to the cheapest plan that fits its size, and you have 14 days to pay. It keeps working meanwhile." },
  { when: "After 14 days", text: "If it is not paid by then, the hotel becomes read-only. Nothing is deleted." },
];

function Pricing() {
  useScrollReveal();
  const top = PRICING_FAQ_IDS.map((id) => FAQS.find((f) => f.id === id)!);
  const [billing, setBilling] = useState<"month" | "year">("month");
  return (
    <>
      <section className="mer-hero relative overflow-hidden border-b border-border/60">
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 text-center sm:px-6 sm:pb-20 sm:pt-20">
          <div className="hs-fade mx-auto max-w-3xl">
            <p className="text-sm font-semibold text-primary-strong">Pricing</p>
            <h1 className="font-sans text-balance mt-3 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">The right tools for the way your hotel runs.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] text-muted-foreground sm:text-lg">Pick the plan that fits the size of your hotel. Prices are in naira. Pay for a year and get two months free.</p>
            <ul className="mx-auto mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-8">
              {REASSURANCE.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5 text-sm font-semibold">
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-strong"><Icon className="size-4" /></span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <Section className="pb-4 pt-12 sm:pb-4 sm:pt-16">
        <div className="flex justify-center">
          <Tabs value={billing} onValueChange={(v) => setBilling(v as "month" | "year")}>
            <TabsList aria-label="Billing period">
              <TabsTrigger value="month">Monthly</TabsTrigger>
              <TabsTrigger value="year">Annual <span className="ml-1.5 text-xs font-bold text-success-strong">2 months free</span></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <PlanCards billing={billing} showAlternative />
        <section className="mx-auto mt-5 flex max-w-5xl flex-col items-start justify-between gap-4 rounded-2xl border border-border/70 bg-card p-6 shadow-card sm:flex-row sm:items-center">
          <div>
            <h2 className="font-sans text-lg font-bold">Enterprise</h2>
            <p className="mt-1 text-[15px] text-muted-foreground">For hotel groups with more than 150 rooms or 3 properties. No limit on staff users. We quote the price.</p>
          </div>
          <Button asChild variant="outline" className="shrink-0"><Link to="/contact">Contact us</Link></Button>
        </section>
      </Section>
      <Section className="py-8 sm:py-12">
        <div className="mer-ink relative mx-auto max-w-5xl overflow-hidden rounded-2xl p-8 text-center text-white shadow-raised sm:p-12">
          <p className="text-sm font-semibold text-white/70">New hotels</p>
          <h2 className="font-sans mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Try Zikora free for 60 days.</h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] text-white/80">Every feature. No card. Create your hotel, add your rooms and run your front desk, housekeeping and billing for two months before you pay anything.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary"><Link to="/auth" search={{ mode: "signup" }}>Start your free trial</Link></Button>
          </div>
        </div>
      </Section>
      <Section className="pt-0 sm:pt-0">
        <div className="mx-auto max-w-5xl">
          <h2 data-reveal className="font-sans text-2xl font-extrabold tracking-tight sm:text-3xl">What happens after the 60 days</h2>
          <ol className="mt-6 grid gap-5 md:grid-cols-3">
            {TRIAL_STEPS.map((t, i) => (
              <li key={t.when} data-reveal style={{ "--i": i } as React.CSSProperties} className="rounded-xl border border-border/70 bg-card p-6 shadow-card">
                <span aria-hidden className="text-sm font-semibold tabular-nums text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-sans mt-2 text-lg font-bold">{t.when}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>
      <Section className="pt-0 sm:pt-0">
        <div className="mx-auto max-w-3xl">
          <h2 data-reveal className="font-sans text-2xl font-extrabold tracking-tight sm:text-3xl">Common questions</h2>
          <div className="mt-5"><FaqList faqs={top} /></div>
          <p className="mt-4 text-sm"><Link to="/faq" className="font-semibold text-primary underline-offset-4 hover:underline">See all questions</Link></p>
          <p className="mt-2 text-sm text-muted-foreground">Not sure which plan fits? <Link to="/contact" className="font-semibold text-primary underline-offset-4 hover:underline">Contact us</Link>.</p>
        </div>
      </Section>
    </>
  );
}
