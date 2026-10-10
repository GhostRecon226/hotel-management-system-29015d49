import { createFileRoute, Link } from "@tanstack/react-router";
import { Eyebrow, Section } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { ORGANIZATION_LD, pageHead } from "@/lib/seo";

const TITLE = "Hotel Data Security and Financial Controls | Zikora";
const DESCRIPTION = "Learn how Zikora records financial changes, separates hotel data, limits staff permissions and protects sensitive guest records.";

export const Route = createFileRoute("/_public/security")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, path: "/security", jsonLd: [ORGANIZATION_LD] }),
  component: Security,
});

// No certification, uptime, regulatory-approval or complete-compliance claim belongs here: none is held.
const PARTS: { title: string; text: string }[] = [
  { title: "Financial changes leave a trail", text: "Payments and issued invoices are not silently rewritten. Corrections are recorded through linked entries such as adjustments, reversals or refunds, preserving the original record. The system records who performed an action and when." },
  { title: "Sensitive actions need a second person", text: "Configured discounts above a limit, adjustments, reversals and refunds require approval from another authorised person. The requester cannot approve their own request, and users cannot grant colleagues permissions or limits they do not hold themselves." },
  { title: "Guest identity details have additional controls", text: "Identity numbers are masked unless a user's role allows access. ID photos are optional and off by default; when enabled, they are stored privately, accessed through short-lived links, and upload, view and deletion events are recorded. Photos are scheduled for deletion 12 months after the guest’s last check-out, and when guest details are removed." },
  { title: "Hotel data is separated", text: "Each hotel's data is separated from other hotels' data, and this separation has been tested. The current database is hosted in Ireland. Hotels should assess their own contractual and data-protection obligations with appropriate advice." },
  { title: "Continuity and access", text: "Zikora runs in a browser on a computer, tablet or phone and requires an internet connection. A printable downtime pack is available for disruption, but the application does not currently operate offline. A lapsed subscription is not designed to block the hotel from taking payments or checking guests out; customers should review the applicable service terms." },
  { title: "Optional AI assistance", text: "An optional drafting helper is off by default. It drafts text for your team to review. It does not make decisions." },
];

function Security() {
  return (
    <Section className="max-w-3xl">
      <Eyebrow>Security</Eyebrow>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Accountability should be built into the workflow.</h1>
      <p className="mt-4 text-base text-muted-foreground">Hotel teams handle guest identity details, payments and decisions that affect revenue. Zikora is designed to make important actions traceable, limit access by role and put a second check around selected high-risk decisions.</p>
      <div className="mt-8 space-y-4">
        {PARTS.map((p) => (
          <section key={p.title} className="rounded-xl border border-border/70 bg-card p-6 shadow-card">
            <h2 className="text-lg font-bold">{p.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{p.text}</p>
          </section>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <p className="w-full text-[15px] font-semibold">Have a question about controls or data handling? Contact the Zikora team.</p>
        <Button asChild><Link to="/contact">Contact the Zikora team</Link></Button>
        <Button asChild variant="outline"><Link to="/privacy">Read the privacy notice</Link></Button>
      </div>
    </Section>
  );
}
