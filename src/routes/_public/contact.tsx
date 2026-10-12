import { createFileRoute } from "@tanstack/react-router";
import { Clock, Mail } from "lucide-react";
import { ContactCard } from "@/components/public/contact-card";
import { EnquiryForm, type EnquiryField } from "@/components/public/enquiry-form";
import { Eyebrow, Section } from "@/components/public/public-layout";
import { SITE_INFO } from "@/lib/site-info";
import { pageHead } from "@/lib/seo";

const TITLE = "Contact Zikora | Hotel Software Enquiries";
const DESCRIPTION = "Contact Zikora to discuss your hotel, ask a product question or ask about pilot access.";

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

function Contact() {
  return (
    <Section className="max-w-4xl">
      <Eyebrow>Contact</Eyebrow>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Tell us about your hotel.</h1>
      <p className="mt-4 max-w-2xl text-base text-muted-foreground">Whether you’re reviewing hotel software or trying to improve a specific part of your operation, tell us what you need. We’ll help you understand the relevant Zikora workflows and what is available today.</p>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <EnquiryForm fields={FIELDS} subject="Zikora enquiry" submitLabel="Send enquiry" />
        <div className="space-y-4">
          <ContactCard icon={Mail} label="Email">{SITE_INFO["contact email"]}</ContactCard>
          <ContactCard icon={Clock} label="Support hours">{SITE_INFO["support hours"]}</ContactCard>
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
            <h2 className="text-sm font-bold">Existing customers</h2>
            <p className="mt-1 text-[15px] text-muted-foreground">Already using Zikora? Include your hotel name and a brief description of the issue so the team can route your enquiry.</p>
          </div>
        </div>
      </div>
    </Section>
  );
}
