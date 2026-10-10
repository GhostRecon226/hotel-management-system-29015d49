import { createFileRoute } from "@tanstack/react-router";
import { FaqTwoColumn } from "@/components/public/faq-two-column";
import { FAQS } from "@/components/public/faq-content";
import { Section } from "@/components/public/public-layout";
import { ORGANIZATION_LD, pageHead } from "@/lib/seo";

const TITLE = "Zikora Hotel Management Software FAQs";
const DESCRIPTION = "Answers about Zikora hotel workflows, financial controls, payments, security, tax settings, pilot access and current limitations.";

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export const Route = createFileRoute("/_public/faq")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, path: "/faq", jsonLd: [ORGANIZATION_LD, faqLd] }),
  component: () => (
    <Section>
      <FaqTwoColumn faqs={FAQS} title="Frequently asked questions"
        intro="Plain answers about how Zikora works today, including what is not available yet." />
    </Section>
  ),
});
