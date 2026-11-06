import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Section } from "@/components/public/public-layout";
import { FaqList } from "@/components/public/faq-two-column";
import { FAQS } from "@/components/public/faq-content";
import { PlanCards } from "@/components/public/plan-cards";

/* Pricing and questions on the home page. Prices come from src/lib/plan-list.ts (the plans table); answers from the FAQ page. */
const HOME_FAQ_IDS = ["what", "who", "payments", "approvals", "housekeeping", "offline"];

export function HomePricing() {
  const [billing, setBilling] = useState<"month" | "year">("month");
  return (
    <Section id="pricing" className="scroll-mt-20">
      <div data-reveal className="mx-auto max-w-2xl text-center">
        <h2 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">Simple, transparent pricing.</h2>
        <p className="mt-3 text-[15px] text-muted-foreground sm:text-base">60 days free with every feature. No card needed. Plans are sized by rooms, properties and staff users.</p>
      </div>
      <div className="mt-6 flex justify-center">
        <Tabs value={billing} onValueChange={(v) => setBilling(v as "month" | "year")}>
          <TabsList aria-label="Billing period">
            <TabsTrigger value="month">Monthly</TabsTrigger>
            <TabsTrigger value="year">Annual <span className="ml-1.5 text-xs font-bold text-success-strong">2 months free</span></TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <PlanCards billing={billing} reveal />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        More than 150 rooms or 3 properties? <Link to="/contact" className="font-semibold text-primary underline-offset-4 hover:underline">Contact us</Link>. <Link to="/pricing" className="font-semibold text-primary underline-offset-4 hover:underline">See full pricing</Link>.
      </p>
    </Section>
  );
}

export function HomeFaq() {
  const faqs = HOME_FAQ_IDS.map((id) => FAQS.find((f) => f.id === id)!);
  return (
    <Section id="faq" className="scroll-mt-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div data-reveal>
          <h2 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">Frequently asked questions.</h2>
          <p className="mt-3 text-[15px] text-muted-foreground">Straight answers, including what Zikora does not do yet.</p>
          <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link to="/faq" className="font-semibold text-primary underline-offset-4 hover:underline">See all questions</Link>
            <Link to="/contact" className="font-semibold text-primary underline-offset-4 hover:underline">Contact the Zikora team</Link>
          </p>
        </div>
        <div data-reveal style={{ "--i": 1 } as React.CSSProperties}><FaqList faqs={faqs} /></div>
      </div>
    </Section>
  );
}
