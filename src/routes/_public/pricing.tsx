import { createFileRoute, Link } from "@tanstack/react-router";
import { SinglePlanCard } from "@/components/public/single-plan-card";
import { FaqList } from "@/components/public/faq-two-column";
import { FAQS, PRICING_FAQ_IDS } from "@/components/public/faq-content";
import { SizeBands } from "@/components/public/home-sections";
import { Eyebrow, Section } from "@/components/public/public-layout";
import { pageHead } from "@/lib/seo";

const TITLE = "Hotel Software Pricing: 30-Day Free Trial | Zikora";
const DESCRIPTION = "Start free for 30 days with no card. Then pay a simple monthly price based on the size of your hotel. Talk to us for your price.";

export const Route = createFileRoute("/_public/pricing")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION }),
  component: Pricing,
});

function Pricing() {
  const top = PRICING_FAQ_IDS.map((id) => FAQS.find((f) => f.id === id)!);
  return (
    <>
      <Section className="pb-10 text-center sm:pb-12">
        <Eyebrow>Pricing</Eyebrow>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Try it free. Pay for the size of your hotel.</h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">Start with 30 days free and no card. When you are ready, we agree a price that fits the number of rooms you run.</p>
      </Section>
      <Section className="pt-0 sm:pt-0">
        <SinglePlanCard
          title="Zikora for your hotel"
          lead={<>30 days free to start. Then a simple monthly price based on the size of your hotel. <Link to="/contact" className="font-semibold text-primary-foreground underline underline-offset-4">Talk to us</Link> for yours.</>}
          includes={[
            "Bookings, walk-ins, check-in and check-out",
            "Rooms, housekeeping and maintenance",
            "Guest bills with service charge and VAT, and printed invoices",
            "Staff roles and approvals for discounts, refunds and corrections",
            "Daily figures with spreadsheet export",
          ]}
          notes={["No card needed", "Nothing is deleted when the trial ends", "Cancel any time by contacting us"]} />
        <p className="mx-auto mt-6 max-w-xl text-center text-sm text-muted-foreground">
          When the trial ends, your hotel becomes read-only until your plan starts. Your team can still record payments, settle bills and check guests out. Nothing is lost.
        </p>
      </Section>
      <SizeBands />
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
