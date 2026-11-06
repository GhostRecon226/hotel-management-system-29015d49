import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { FaqList } from "@/components/public/faq-two-column";
import { useScrollReveal } from "@/components/public/home/use-scroll-reveal";
import { Button } from "@/components/ui/button";
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
  component: Faq,
});

const GROUPS = [...new Set(FAQS.map((f) => f.group))];
const slug = (g: string) => `faq-${g.replace(/\W+/g, "-").toLowerCase()}`;

function Faq() {
  useScrollReveal();
  return (
    <>
      <section className="mer-hero relative overflow-hidden border-b border-border/60">
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 text-center sm:px-6 sm:pb-20 sm:pt-20">
          <div className="hs-fade mx-auto max-w-3xl">
            <p className="text-sm font-semibold text-primary-strong">FAQs</p>
            <h1 className="font-sans text-balance mt-3 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">Frequently asked questions</h1>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] text-muted-foreground sm:text-lg">Plain answers about how Zikora works today, including what is not available yet.</p>
          </div>
          <nav aria-label="Jump to a topic" className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-2">
            {GROUPS.map((g) => (
              <a key={g} href={`#${slug(g)}`} className="inline-flex min-h-9 items-center rounded-full border border-border/70 bg-card px-3.5 text-sm font-semibold text-foreground/80 outline-none hover:border-primary/40 hover:text-primary-strong focus-visible:ring-3 focus-visible:ring-ring/40 pointer-coarse:min-h-11">{g}</a>
            ))}
          </nav>
        </div>
      </section>
      <Section className="py-6 sm:py-10">
        <div className="divide-y divide-border/70">
          {GROUPS.map((g) => (
            <section key={g} id={slug(g)} data-reveal className="scroll-mt-24 grid gap-5 py-10 sm:py-12 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-12">
              <h2 className="font-sans text-2xl font-extrabold tracking-tight sm:text-3xl">{g}</h2>
              <FaqList faqs={FAQS.filter((f) => f.group === g)} />
            </section>
          ))}
        </div>
      </Section>
      <Section className="pt-0 sm:pt-0">
        <div className="mer-ink mx-auto max-w-5xl rounded-2xl p-8 text-center text-white shadow-raised sm:p-12">
          <h2 className="font-sans text-2xl font-extrabold tracking-tight sm:text-3xl">Have another question?</h2>
          <p className="mx-auto mt-2 max-w-xl text-[15px] text-white/80">Contact the Zikora team.</p>
          <div className="mt-6 flex justify-center">
            <Button asChild size="lg" variant="secondary"><Link to="/contact">Contact the Zikora team</Link></Button>
          </div>
        </div>
      </Section>
    </>
  );
}
