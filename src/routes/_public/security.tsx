import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, History, Lock, ShieldCheck, Users, Wifi, type LucideIcon } from "lucide-react";
import { Section } from "@/components/public/public-layout";
import { useScrollReveal } from "@/components/public/home/use-scroll-reveal";
import { Button } from "@/components/ui/button";
import { ORGANIZATION_LD, pageHead } from "@/lib/seo";

const TITLE = "Hotel Data Security and Financial Controls | Zikora";
const DESCRIPTION = "Learn how Zikora records financial changes, separates hotel data, limits staff permissions and protects sensitive guest records.";

export const Route = createFileRoute("/_public/security")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, path: "/security", jsonLd: [ORGANIZATION_LD] }),
  component: Security,
});

// No certification, uptime, regulatory-approval or complete-compliance claim belongs here: none is held.
const PARTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: History, title: "Financial changes leave a trail", text: "Payments and issued invoices are not silently rewritten. Corrections are recorded through linked entries such as adjustments, reversals or refunds, preserving the original record. The system records who performed an action and when." },
  { icon: Users, title: "Sensitive actions need a second person", text: "Configured discounts above a limit, adjustments, reversals and refunds require approval from another authorised person. The requester cannot approve their own request, and users cannot grant colleagues permissions or limits they do not hold themselves." },
  { icon: Lock, title: "Guest identity details have additional controls", text: "Identity numbers are masked unless a user's role allows access. ID photos are optional and off by default; when enabled, they are stored privately, accessed through short-lived links, and upload, view and deletion events are recorded. Photos are scheduled for deletion 12 months after the guest’s last check-out, and when guest details are removed." },
  { icon: ShieldCheck, title: "Hotel data is separated", text: "Each hotel's data is separated from other hotels' data, and this separation has been tested. The current database is hosted in Ireland. Hotels should assess their own contractual and data-protection obligations with appropriate advice." },
  { icon: Wifi, title: "Continuity and access", text: "Zikora runs in a browser on a computer, tablet or phone and needs an internet connection to sign in and to make most changes. If the connection drops, a device that has signed in keeps showing the lists it last loaded, and charges, payments and housekeeping updates wait on the device and send when the connection returns. Saved lists follow the user's role, exclude ID numbers and ID photos, and are removed on sign-out. A printable downtime pack is available for longer disruption. A lapsed subscription is not designed to block the hotel from taking payments or checking guests out; customers should review the applicable service terms." },
  { icon: Bot, title: "Optional AI assistance", text: "An optional drafting helper is off by default. It drafts text for your team to review. It does not make decisions." },
];

function Security() {
  useScrollReveal();
  return (
    <>
      <section className="mer-hero relative overflow-hidden border-b border-border/60">
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 text-center sm:px-6 sm:pb-20 sm:pt-20">
          <div className="hs-fade mx-auto max-w-3xl">
            <p className="text-sm font-semibold text-primary-strong">Security</p>
            <h1 className="font-sans text-balance mt-3 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">Accountability should be built into the workflow.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] text-muted-foreground sm:text-lg">Hotel teams handle guest identity details, payments and decisions that affect revenue. Zikora is designed to make important actions traceable, limit access by role and put a second check around selected high-risk decisions.</p>
          </div>
        </div>
      </section>
      <Section>
        <ul className="grid border-t border-border/70 md:grid-cols-2" aria-label="How Zikora protects hotel data">
          {PARTS.map((p, i) => (
            <li key={p.title} data-reveal style={{ "--i": i } as React.CSSProperties} className="mer-cell border-b border-border/70 p-6 sm:p-8 md:odd:border-r">
              <span aria-hidden className="mer-icon grid size-10 place-items-center rounded-lg bg-primary-soft text-primary-strong"><p.icon className="size-5" /></span>
              <h2 className="font-sans mt-4 text-lg font-bold">{p.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{p.text}</p>
            </li>
          ))}
        </ul>
        <div data-reveal className="mt-10 rounded-2xl border border-border/70 bg-card p-6 text-center shadow-card sm:p-8">
          <p className="text-base font-semibold">Have a question about controls or data handling? Contact the Zikora team.</p>
          <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild><Link to="/contact">Contact the Zikora team</Link></Button>
            <Button asChild variant="outline"><Link to="/privacy">Read the privacy notice</Link></Button>
          </div>
        </div>
      </Section>
    </>
  );
}
