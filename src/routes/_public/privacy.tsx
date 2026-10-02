import { createFileRoute } from "@tanstack/react-router";
import { DraftNotice, Eyebrow, Section } from "@/components/public/public-layout";
import { LegalPart } from "@/components/public/legal";
import { ToConfirm } from "@/components/public/to-confirm";

const TITLE = "Privacy notice: Hotel Desk";
const DESCRIPTION = "How Hotel Desk handles hotel and guest information. Draft, pending legal review.";

export const Route = createFileRoute("/_public/privacy")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESCRIPTION }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESCRIPTION }] }),
  component: Privacy,
});

// Every statement here was checked against the system on 2 Oct 2026. Legal wording waits for advice (A14).
function Privacy() {
  return (
    <Section className="max-w-3xl">
      <Eyebrow>Privacy notice</Eyebrow>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Privacy notice</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: <ToConfirm what="date of the final version" /></p>
      <div className="mt-6"><DraftNotice /></div>
      <LegalPart title="1. Who we are">
        <p>Hotel Desk is provided by <ToConfirm what="company name" />.</p>
      </LegalPart>
      <LegalPart title="2. Whose information this covers">
        <p>Hotels use Hotel Desk to run their business. <strong>The hotel decides what guest information it records and is responsible for it.</strong> We store and process that information for the hotel. We also hold the account details of the hotel's staff who sign in.</p>
      </LegalPart>
      <LegalPart title="3. What we store">
        <ul>
          <li>Staff accounts: name, email address and sign-in details.</li>
          <li>What the hotel records about its business: bookings, rooms, bills, payments and invoices.</li>
          <li>What the hotel records about guests: for example name, phone, email, nationality, address and, if the hotel enters them, ID document details. Only staff whose role allows it can see ID document details.</li>
          <li>A record of changes: who changed what and when. For guests it records which details changed, not the details themselves.</li>
        </ul>
      </LegalPart>
      <LegalPart title="4. Where it is kept and who helps us">
        <ul>
          <li>The database is run by Supabase on servers in the European Union (Ireland).</li>
          <li>The website is served by Vercel.</li>
          <li>Sign-in and password emails are sent by Supabase. We plan to send these, and booking confirmations, through our email provider Resend.</li>
        </ul>
      </LegalPart>
      <LegalPart title="5. Cookies and tracking">
        <p>We use no advertising, no analytics and no tracking cookies. Your browser keeps your sign-in so you stay signed in. Our fonts are served from our own website, not from another company.</p>
      </LegalPart>
      <LegalPart title="6. Who can see the information">
        <p>Each hotel's information is kept separate from every other hotel's. Inside a hotel, each member of staff sees only what their role allows. We do not sell the information.</p>
      </LegalPart>
      <LegalPart title="7. Keeping and removing information">
        <ul>
          <li>Bills, payments, invoices and the record of changes cannot be deleted, because they are financial records. Mistakes are corrected with a new entry that stays on record.</li>
          <li>A guest's personal details can be removed (anonymised) once the guest has no current or upcoming stay. Their past stays and bills are kept, without the personal details.</li>
          <li>How long we keep information after a hotel's account closes: <ToConfirm what="retention period, after legal review" />.</li>
        </ul>
      </LegalPart>
      <LegalPart title="8. Your requests">
        <p>To ask what information we hold about you, or to have it corrected or removed, contact <ToConfirm what="who answers data requests" /> at <ToConfirm what="contact email" />. If you are a hotel guest, you can also ask the hotel directly.</p>
      </LegalPart>
      <LegalPart title="9. Changes">
        <p>This notice is a draft. We will publish the final version after legal review.</p>
      </LegalPart>
    </Section>
  );
}
