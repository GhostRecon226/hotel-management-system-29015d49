import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock, Mail, MessageSquareText, Rocket, UserCheck } from "lucide-react";
import { ContactCard } from "@/components/public/contact-card";
import { EnquiryForm, type EnquiryField } from "@/components/public/enquiry-form";
import { Section } from "@/components/public/public-layout";
import { useScrollReveal } from "@/components/public/home/use-scroll-reveal";
import { Button } from "@/components/ui/button";
import { SITE_INFO } from "@/lib/site-info";
import { pageHead } from "@/lib/seo";

const TITLE = "Contact Zikora | Hotel Software Enquiries";
const DESCRIPTION = "Contact Zikora to discuss your hotel, ask a product question or ask about pilot access. Email hello@zikorahq.com or use the form.";

export const Route = createFileRoute("/_public/contact")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, path: "/contact" }),
  component: Contact,
});

const FIELDS: EnquiryField[] = [
  { name: "name", label: "Full name", required: true, autoComplete: "name" },
  { name: "email", label: "Work email", kind: "email", required: true, autoComplete: "email" },
  { name: "hotel", label: "Hotel or company name", required: true, autoComplete: "organization" },
  { name: "role", label: "Role", required: true, autoComplete: "organization-title" },
  { name: "location", label: "City and country", required: true },
  { name: "topic", label: "What would you like to discuss?", kind: "select", required: true, options: ["Pilot access", "Product question", "Existing account"] },
  { name: "message", label: "Message", kind: "textarea", required: true, hint: "What is one part of your hotel operation you would most like to improve?" },
];

// No reply time is promised: none is approved.
const ROUTES: { icon: typeof Rocket; title: string; text: string }[] = [
  { icon: Rocket, title: "Pilot access", text: "Tell us about your hotel and how many rooms it has. We will explain what is available today." },
  { icon: MessageSquareText, title: "Product question", text: "Ask how a workflow works, such as check-in, folios, approvals or housekeeping." },
  { icon: UserCheck, title: "Existing account", text: "Include your hotel name and a short description of the issue, so the team can route it." },
];

function Contact() {
  useScrollReveal();
  return (
    <>
      <section className="mer-hero relative overflow-hidden border-b border-border/60">
        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-14 text-center sm:px-6 sm:pb-16 sm:pt-20">
          <div className="hs-fade mx-auto max-w-3xl">
            <p className="text-sm font-semibold text-primary-strong">Contact</p>
            <h1 className="font-sans text-balance mt-3 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">Tell us about your hotel.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] text-muted-foreground sm:text-lg">Whether you are reviewing hotel software or want to improve one part of your operation, tell us what you need. We will help you understand the Zikora workflows that apply and what is available today.</p>
          </div>
        </div>
      </section>

      <Section className="max-w-5xl">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <EnquiryForm fields={FIELDS} subject="Zikora enquiry" submitLabel="Send enquiry" />
          <div className="space-y-4">
            <ContactCard icon={Mail} label="Email">{SITE_INFO["contact email"]}</ContactCard>
            <ContactCard icon={Clock} label="Support hours">{SITE_INFO["support hours"]}</ContactCard>
            <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
              <h2 className="text-sm font-bold">Want to look first?</h2>
              <p className="mt-1 text-[15px] text-muted-foreground">Start 60 days free with every feature. No card is needed.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm"><Link to="/auth" search={{ mode: "signup" }}>Start 60 days free</Link></Button>
                <Button asChild size="sm" variant="outline"><Link to="/faq">Read the FAQ</Link></Button>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section className="pt-0">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">What to write about.</h2>
          <p className="mt-3 text-[15px] text-muted-foreground sm:text-base">Pick the topic in the form that fits. It helps us send your message to the right person.</p>
        </div>
        <ul className="mt-10 grid border-t border-border/70 md:grid-cols-3" aria-label="Topics">
          {ROUTES.map((r, i) => (
            <li key={r.title} data-reveal style={{ "--i": i } as React.CSSProperties} className="mer-cell border-b border-border/70 p-6 md:border-r md:last:border-r-0">
              <span aria-hidden className="mer-icon grid size-10 place-items-center rounded-lg bg-primary-soft text-primary-strong"><r.icon className="size-5" /></span>
              <h3 className="font-sans mt-4 text-lg font-bold">{r.title}</h3>
              <p className="mt-1 text-[15px] text-muted-foreground">{r.text}</p>
            </li>
          ))}
        </ul>
        <div data-reveal className="mt-8 text-center">
          <Button asChild variant="outline"><Link to="/how-it-works">See how a stay runs <ArrowRight className="size-4" aria-hidden /></Link></Button>
        </div>
      </Section>
    </>
  );
}
