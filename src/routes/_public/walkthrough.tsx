import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { EnquiryForm, type EnquiryField } from "@/components/public/enquiry-form";
import { Eyebrow, Section } from "@/components/public/public-layout";
import { pageHead } from "@/lib/seo";

const TITLE = "Request a Zikora Hotel Management Software Walkthrough";
const DESCRIPTION = "See how Zikora handles hotel reservations, financial records, cashiering, housekeeping, maintenance and reporting.";

export const Route = createFileRoute("/_public/walkthrough")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, path: "/walkthrough" }),
  component: Walkthrough,
});

const COVER = [
  "Bookings, arrivals, walk-ins and room moves.",
  "Folios, payment records, cashier shifts and approvals.",
  "Housekeeping tasks, inspections and maintenance tickets.",
  "Outstanding balances, collections and daily reporting.",
];

const FIELDS: EnquiryField[] = [
  { name: "name", label: "Name", required: true, autoComplete: "name" },
  { name: "email", label: "Work email", kind: "email", required: true, autoComplete: "email" },
  { name: "hotel", label: "Hotel or company", required: true, autoComplete: "organization" },
  { name: "location", label: "City and country", required: true },
  { name: "role", label: "Role", required: true, autoComplete: "organization-title" },
  { name: "rooms", label: "Number of rooms", kind: "number" },
  { name: "challenge", label: "Main challenge", kind: "textarea", required: true, hint: "What is one part of your hotel operation you would most like to improve?" },
  { name: "next", label: "Preferred next step", kind: "select", required: true, options: ["Walkthrough", "Pilot access", "Product question"] },
];

function Walkthrough() {
  return (
    <Section className="max-w-4xl">
      <Eyebrow>Walkthrough</Eyebrow>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">See how the workflows fit together.</h1>
      <p className="mt-4 max-w-2xl text-base text-muted-foreground">A useful walkthrough should answer your questions, not just show you screens. Tell us a little about your hotel and the process you most want to improve. We’ll focus on the relevant workflows and be clear about what is available today.</p>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="rounded-xl border border-border/70 bg-card p-6 shadow-card">
          <h2 className="text-lg font-bold">What we can cover</h2>
          <ul className="mt-3 space-y-2.5 text-[15px] text-muted-foreground">
            {COVER.map((c) => <li key={c} className="flex gap-2.5"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-strong" />{c}</li>)}
          </ul>
        </div>
        <EnquiryForm fields={FIELDS} subject="Zikora walkthrough request" submitLabel="Request my walkthrough" />
      </div>
    </Section>
  );
}
