import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { FaqList } from "@/components/public/faq-two-column";
import { FAQS, PRICING_FAQ_IDS } from "@/components/public/faq-content";
import { Eyebrow, Section } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/seo";

const TITLE = "Zikora Pricing | Hotel Management Software Plans";
const DESCRIPTION = "Zikora is subscription-based. Ask about pilot access, plan options and pricing for your hotel before you subscribe.";

export const Route = createFileRoute("/_public/pricing")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, path: "/pricing" }),
  component: Pricing,
});

// Tier names, prices and feature allocations are not approved (decision A16), so none appear here.
const CONFIRMED_BEFORE_SUBSCRIBING = [
  "The price and how often you are billed",
  "What is included, and any limits on properties or users",
  "Support and onboarding terms",
  "Cancellation conditions",
];

function Pricing() {
  const top = PRICING_FAQ_IDS.map((id) => FAQS.find((f) => f.id === id)!);
  return (
    <>
      <Section className="pb-10 text-center sm:pb-12">
        <Eyebrow>Pricing</Eyebrow>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">The right tools for the way your hotel runs.</h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">Zikora is subscription-based. Plan inclusions, billing terms and current pricing will be confirmed before you subscribe.</p>
      </Section>
      <Section className="pt-0 sm:pt-0">
        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-border/70 bg-card p-6 shadow-card">
            <h2 className="text-lg font-bold">How subscriptions work</h2>
            <p className="mt-2 text-[15px] text-muted-foreground">Zikora is sold on a subscription basis. Before you subscribe, we confirm with you:</p>
            <ul className="mt-3 space-y-2.5 text-[15px] text-muted-foreground">
              {CONFIRMED_BEFORE_SUBSCRIBING.map((c) => <li key={c} className="flex gap-2.5"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-strong" />{c}</li>)}
            </ul>
          </section>
          <section className="rounded-xl border border-border/70 bg-card p-6 shadow-card">
            <h2 className="text-lg font-bold">Pilot access</h2>
            <p className="mt-2 text-[15px] text-muted-foreground">We are talking to hotels about pilot access while plans and pricing are finalised. Tell us about your property and we will say whether pilot access is a fit.</p>
          </section>
        </div>
      </Section>
      <Section className="pt-0 sm:pt-0">
        <div className="mx-auto max-w-3xl rounded-2xl bg-accent-fill p-8 text-center text-primary-foreground shadow-accent">
          <h2 className="text-2xl font-extrabold tracking-tight">Need help choosing?</h2>
          <p className="mx-auto mt-2 max-w-xl text-[15px] text-on-primary-muted">Tell us about your property and the workflows you want to improve. We’ll help you compare the available plans and clarify what is included today.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary"><Link to="/walkthrough">Request a walkthrough</Link></Button>
            <Button asChild size="lg" variant="secondary"><Link to="/contact">Contact us</Link></Button>
          </div>
        </div>
      </Section>
      <Section className="pt-0 sm:pt-0">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-extrabold tracking-tight">Common questions</h2>
          <div className="mt-5"><FaqList faqs={top} /></div>
          <p className="mt-4 text-sm"><Link to="/faq" className="font-semibold text-primary underline-offset-4 hover:underline">See all questions</Link></p>
        </div>
      </Section>
    </>
  );
}
