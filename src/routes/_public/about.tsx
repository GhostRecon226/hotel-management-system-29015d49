import { createFileRoute, Link } from "@tanstack/react-router";
import { Eyebrow, Section } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { ORGANIZATION_LD, pageHead } from "@/lib/seo";

const TITLE = "About Zikora | Hotel Management Software for Modern Hotels";
const DESCRIPTION = "Discover why Zikora is being built to connect hotel operations and bring more accountability to rooms, service and financial records.";

export const Route = createFileRoute("/_public/about")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, path: "/about", jsonLd: [ORGANIZATION_LD] }),
  component: About,
});

// No company history, founding story, customer base or legal entity is stated here: none is approved.
const PARTS: { title: string; text: string }[] = [
  { title: "Why Zikora", text: "Zikora is being built to bring these everyday workflows into one hotel management system. It connects reservations and front desk activity with guest records, folios, cashiering, housekeeping, maintenance and reporting, so teams can work from a more consistent operational picture." },
  { title: "What we believe", text: "Financial records should be traceable. Corrections should leave a history. Sensitive decisions should have the right approval. Room readiness should reflect the work that has actually happened. Managers should be able to review the day without piecing together disconnected registers and spreadsheets." },
  { title: "Built for hotel operations, ready to grow", text: "Zikora is being built for the realities of hotel operations, with a long-term ambition to serve properties across different markets. Configurable tax and service-charge settings support local operating requirements; hotels should confirm the correct treatment with their accountant." },
  { title: "A practical approach to building", text: "The priority is to make the core operating workflows dependable, learn from pilot use, and then expand based on hotel needs. Future ideas include additional payment and collection capabilities, corporate accounts, a booking engine and channel-manager connections. These are roadmap ideas, not current features." },
];

function About() {
  return (
    <Section className="max-w-3xl">
      <Eyebrow>About</Eyebrow>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Built around the work that keeps a hotel running.</h1>
      <p className="mt-5 text-base text-muted-foreground">A hotel is a series of handovers. A booking becomes an arrival. A room move becomes a housekeeping task. A guest request may become a charge. A payment must match a record. When those handovers break down, the team spends time chasing information instead of serving guests.</p>
      <div className="mt-8 space-y-4">
        {PARTS.map((p) => (
          <section key={p.title} className="rounded-xl border border-border/70 bg-card p-6 shadow-card">
            <h2 className="text-lg font-bold">{p.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{p.text}</p>
          </section>
        ))}
      </div>
      <div className="mt-8 rounded-2xl bg-accent-fill p-8 text-primary-foreground shadow-accent">
        <p className="text-lg font-extrabold tracking-tight">Tell us how your hotel works today. We’d like to understand the challenges you want a hotel system to solve.</p>
        <Button asChild variant="secondary" className="mt-5"><Link to="/contact">Talk to Zikora</Link></Button>
      </div>
    </Section>
  );
}
