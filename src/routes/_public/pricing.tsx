import { createFileRoute, Link } from "@tanstack/react-router";
import { SinglePlanCard } from "@/components/public/single-plan-card";
import { FaqList } from "@/components/public/faq-two-column";
import { FAQS, PRICING_FAQ_IDS } from "@/components/public/faq-content";
import { Eyebrow, Section } from "@/components/public/public-layout";

const TITLE = "Pricing: Hotel Desk";
const DESCRIPTION = "Free trial, then pricing by hotel size. Contact us for a price for your hotel.";

export const Route = createFileRoute("/_public/pricing")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESCRIPTION }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESCRIPTION }] }),
  component: Pricing,
});

function Pricing() {
  const top = PRICING_FAQ_IDS.map((id) => FAQS.find((f) => f.id === id)!);
  return (
    <>
      <Section className="pb-10 text-center sm:pb-12">
        <Eyebrow>Pricing</Eyebrow>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Simple pricing for your hotel</h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">Free trial, then pricing by hotel size. Contact us.</p>
      </Section>
      <Section className="pt-0 sm:pt-0">
        <SinglePlanCard
          title="Free trial, then pricing by hotel size"
          lead={<>Your 30-day free trial starts when you create your hotel. After that, <Link to="/contact" className="font-semibold text-primary-foreground underline underline-offset-4">contact us</Link> for a price for your hotel.</>}
          includes={[
            "Bookings, walk-ins, check-in and check-out",
            "Rooms, housekeeping and maintenance",
            "Guest bills with service charge and VAT, and printed invoices",
            "Staff roles and approvals for discounts, refunds and corrections",
            "Daily figures: occupancy, ADR and RevPAR, with spreadsheet export",
          ]}
          notes={["No card needed", "Nothing is deleted when the trial ends", "Contact us to cancel"]} />
        <p className="mx-auto mt-6 max-w-xl text-center text-sm text-muted-foreground">
          When the trial ends, your hotel becomes read-only until we start your plan. You can still settle bills and check guests out. Nothing is deleted.
        </p>
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
