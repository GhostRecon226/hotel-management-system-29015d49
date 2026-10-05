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

// Every statement here was checked against the system on 2 Oct 2026; section 4 (ID photos) on 7 Oct 2026, against
// branch claude/id-photos. Legal wording waits for advice (A14).
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
          <li>What the hotel records about guests: for example name, phone, email, nationality, address and, if the hotel enters them, ID document details and, if the hotel allows it, a photo or scan of the ID document (see section 4). Only staff whose role allows it can see ID document details.</li>
          <li>A record of changes: who changed what and when. For guests it records which details changed, not the details themselves.</li>
        </ul>
      </LegalPart>
      <LegalPart title="4. Photos of ID documents">
        <ul>
          <li>A hotel can choose to keep a photo or scan of a guest's ID document, front and back. This is off unless the hotel switches it on, and the hotel can also ask for it at check-in.</li>
          <li>Why the hotel keeps it, and on what legal basis: <ToConfirm what="purpose and legal basis, for example a guest register rule, after legal review" />.</li>
          <li>Who can see it: only hotel staff whose role allows it (managers and front desk). Reservation staff and accountants cannot.</li>
          <li>How it is protected: it is stored privately, never at a public web address. A photo opens only through a link that works for 60 seconds, and every upload, view and deletion is recorded with who did it and when.</li>
          <li>Before upload, the photo is made smaller on the hotel's device. This also removes hidden information in the photo, such as the place it was taken.</li>
          <li>How long it is kept: it is deleted automatically 12 months after the guest's last check-out, unless the guest has a stay that is not over. <ToConfirm what="keep period, after legal review" />.</li>
          <li>It is deleted straight away when the guest's personal details are removed (anonymised), or when a hotel manager deletes it.</li>
          <li>Like the rest of the database, it is stored in the European Union (Ireland). <ToConfirm what="the safeguard for keeping guest ID photos outside Nigeria, after legal review" />.</li>
        </ul>
      </LegalPart>
      <LegalPart title="5. Where it is kept and who helps us">
        <ul>
          <li>The database is run by Supabase on servers in the European Union (Ireland).</li>
          <li>The website is served by Vercel.</li>
          <li>Sign-in and password emails are sent by Supabase. We plan to send these, and booking confirmations, through our email provider Resend.</li>
        </ul>
      </LegalPart>
      <LegalPart title="6. Cookies and tracking">
        <p>We use no advertising, no analytics and no tracking cookies. Your browser keeps your sign-in so you stay signed in. Our fonts are served from our own website, not from another company.</p>
      </LegalPart>
      <LegalPart title="7. Who can see the information">
        <p>Each hotel's information is kept separate from every other hotel's. Inside a hotel, each member of staff sees only what their role allows. We do not sell the information.</p>
      </LegalPart>
      <LegalPart title="8. Keeping and removing information">
        <ul>
          <li>Bills, payments, invoices and the record of changes cannot be deleted, because they are financial records. Mistakes are corrected with a new entry that stays on record.</li>
          <li>A guest's personal details can be removed (anonymised) once the guest has no current or upcoming stay. Their past stays and bills are kept, without the personal details.</li>
          <li>How long we keep information after a hotel's account closes: <ToConfirm what="retention period, after legal review" />.</li>
        </ul>
      </LegalPart>
      <LegalPart title="9. Your requests">
        <p>To ask what information we hold about you, or to have it corrected or removed, contact <ToConfirm what="who answers data requests" /> at <ToConfirm what="contact email" />. If you are a hotel guest, you can also ask the hotel directly.</p>
      </LegalPart>
      <LegalPart title="10. Changes">
        <p>This notice is a draft. We will publish the final version after legal review.</p>
      </LegalPart>
    </Section>
  );
}
