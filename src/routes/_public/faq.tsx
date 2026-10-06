import { createFileRoute } from "@tanstack/react-router";
import { FaqTwoColumn } from "@/components/public/faq-two-column";
import { FAQS } from "@/components/public/faq-content";
import { Section } from "@/components/public/public-layout";
import { pageHead } from "@/lib/seo";
import { SITE_INFO } from "@/lib/site-info";

const TITLE = "Hotel Software FAQ: Price, Tax and Your Data | Hotel Desk";
const DESCRIPTION = "Answers on price, VAT and service charge, payments, housekeeping, staff access and where your hotel's data is kept.";

const helpText = `Email ${SITE_INFO["contact email"]} or call ${SITE_INFO["phone"]}. Support hours: ${SITE_INFO["support hours"]}.`;
const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [...FAQS.map((f) => ({ q: f.q, a: f.a })), { q: "How do I get help?", a: helpText }].map((f) => ({
    "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export const Route = createFileRoute("/_public/faq")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, jsonLd: [faqLd] }),
  component: () => (
    <Section>
      <FaqTwoColumn faqs={FAQS} title="Questions hotel owners ask us"
        intro="Straight answers about price, money, daily use and your data. Cannot find yours? Talk to us." />
    </Section>
  ),
});
