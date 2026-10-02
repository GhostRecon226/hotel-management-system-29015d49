import { createFileRoute } from "@tanstack/react-router";
import { FaqTwoColumn } from "@/components/public/faq-two-column";
import { FAQS } from "@/components/public/faq-content";
import { Section } from "@/components/public/public-layout";

const TITLE = "Questions and answers: Hotel Desk";
const DESCRIPTION = "Answers for hotel owners: the free trial, pricing, devices, data, payments, VAT, staff access and reports.";

export const Route = createFileRoute("/_public/faq")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESCRIPTION }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESCRIPTION }] }),
  component: () => (
    <Section>
      <FaqTwoColumn faqs={FAQS} title="Questions hotel owners ask"
        intro="How the free trial works, what the system does today, and what is planned. Answers marked Planned are not available yet." />
    </Section>
  ),
});
