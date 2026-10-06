import { createFileRoute, Link } from "@tanstack/react-router";
import { DraftNotice, Eyebrow, Section } from "@/components/public/public-layout";
import { LegalPart } from "@/components/public/legal";
import { ToConfirm } from "@/components/public/to-confirm";
import { pageHead } from "@/lib/seo";

const TITLE = "Privacy Notice | Hotel Desk";
const DESCRIPTION = "How Hotel Desk stores and protects information for hotels, their staff and their guests.";

export const Route = createFileRoute("/_public/privacy")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION }),
  component: Privacy,
});

const link = "font-semibold text-primary underline-offset-4 hover:underline";

// Every statement here was checked against the system on 2 Oct 2026; section 4 (ID photos) on 7 Oct 2026.
// Items shown through <ToConfirm> wait for legal advice (A14). A production build refuses to run while any remain.
function Privacy() {
  return (
    <Section className="max-w-3xl">
      <Eyebrow>Privacy notice</Eyebrow>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Privacy notice</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: <ToConfirm what="date of the final version" /></p>
      <div className="mt-6"><DraftNotice /></div>
      <p className="mb-6 text-[15px] leading-relaxed text-muted-foreground"><strong className="text-foreground">In short.</strong> Hotels use Hotel Desk to run their business. The hotel decides what it records about its guests and is responsible for it. We store that information for the hotel, we keep each hotel's data separate, and we never sell it.</p>
      <LegalPart title="1. Who we are">
        <p>Hotel Desk is provided by <ToConfirm what="company name" /> ("we", "us"). We run the software that hotels use. <ToConfirm what="company role and registration, after legal review" /></p>
      </LegalPart>
      <LegalPart title="2. Whose information this covers">
        <ul>
          <li><strong>Hotel staff</strong> who sign in to Hotel Desk.</li>
          <li><strong>Hotel guests</strong> whose details a hotel records.</li>
          <li><strong>Visitors</strong> to this website.</li>
        </ul>
      </LegalPart>
      <LegalPart title="3. What we store">
        <ul>
          <li><strong>Staff accounts:</strong> name, email address and sign-in details.</li>
          <li><strong>Hotel records:</strong> bookings, rooms, bills, payments and invoices.</li>
          <li><strong>Guest details the hotel records:</strong> for example name, phone, email, nationality and address. If the hotel enters them, ID document details. If the hotel allows it, a photo or scan of the ID document (see section 4). Only staff whose role allows it can see ID document details.</li>
          <li><strong>A record of changes:</strong> who changed what and when. For guests it records which details changed, not the details themselves.</li>
        </ul>
      </LegalPart>
      <LegalPart title="4. Photos of ID documents">
        <ul>
          <li>A hotel can choose to keep a photo or scan of a guest's ID, front and back. This is off unless the hotel switches it on.</li>
          <li><strong>Why the hotel keeps it:</strong> <ToConfirm what="purpose and legal basis, for example a guest register rule, after legal review" />.</li>
          <li><strong>Who can see it:</strong> only hotel staff whose role allows it, such as managers and front desk. Reservation staff and accountants cannot.</li>
          <li><strong>How it is protected:</strong> stored privately, never at a public web address. A photo opens only through a link that works for 60 seconds. Every upload, view and deletion is recorded with who did it and when.</li>
          <li><strong>Before upload,</strong> the photo is made smaller on the hotel's device. This also removes hidden details, such as where it was taken.</li>
          <li><strong>How long it is kept:</strong> deleted automatically 12 months after the guest's last check-out, unless the guest has a stay that is not over. <ToConfirm what="keep period, after legal review" />.</li>
          <li>It is deleted straight away when the guest's personal details are removed, or when a hotel manager deletes it.</li>
          <li><strong>Where it is stored:</strong> in the European Union (Ireland), like the rest of the database. <ToConfirm what="the safeguard for keeping guest ID photos outside Nigeria, after legal review" />.</li>
        </ul>
      </LegalPart>
      <LegalPart title="5. Where information is kept and who helps us">
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
        <p>Each hotel's information is kept separate from every other hotel's. Inside a hotel, each person sees only what their role allows. We do not sell information.</p>
      </LegalPart>
      <LegalPart title="8. Keeping and removing information">
        <ul>
          <li>Bills, payments, invoices and the record of changes cannot be deleted, because they are financial records. Mistakes are corrected with a new entry that stays on record.</li>
          <li>A guest's personal details can be removed (anonymised) once the guest has no current or upcoming stay. Past stays and bills are kept without the personal details.</li>
          <li>After a hotel's account closes, <ToConfirm what="retention period, after legal review" />.</li>
        </ul>
      </LegalPart>
      <LegalPart title="9. Your rights and requests">
        <p><ToConfirm what="rights and response times, after legal review" /> Write to <ToConfirm what="who answers data requests" /> at <ToConfirm what="contact email" />. If you are a hotel guest, you can also ask the hotel directly.</p>
      </LegalPart>
      <LegalPart title="10. Changes to this notice">
        <p>We will update this page when we change how we handle information, and we will change the date at the top. See also the <Link to="/security" className={link}>security page</Link> and the <Link to="/terms" className={link}>terms of use</Link>.</p>
      </LegalPart>
    </Section>
  );
}
