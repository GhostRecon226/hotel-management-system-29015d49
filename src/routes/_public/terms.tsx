import { createFileRoute, Link } from "@tanstack/react-router";
import { DraftNotice, Eyebrow, Section } from "@/components/public/public-layout";
import { LegalPart } from "@/components/public/legal";
import { ToConfirm } from "@/components/public/to-confirm";

const TITLE = "Terms of use: Hotel Desk";
const DESCRIPTION = "The terms for using Hotel Desk. Draft, pending legal review.";

export const Route = createFileRoute("/_public/terms")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESCRIPTION }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESCRIPTION }] }),
  component: Terms,
});

const link = "font-semibold text-primary underline-offset-4 hover:underline";

// Every statement here was checked against the system on 2 Oct 2026. Legal wording waits for advice.
function Terms() {
  return (
    <Section className="max-w-3xl">
      <Eyebrow>Terms of use</Eyebrow>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Terms of use</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: <ToConfirm what="date of the final version" /></p>
      <div className="mt-6"><DraftNotice /></div>
      <LegalPart title="1. The service">
        <p>Hotel Desk is a hotel management system provided by <ToConfirm what="company name" />. It runs in a web browser and needs an internet connection.</p>
      </LegalPart>
      <LegalPart title="2. Free trial">
        <p>When you create your hotel, a 30-day free trial starts. You do not need a card.</p>
      </LegalPart>
      <LegalPart title="3. When the trial or a plan ends">
        <p>Your hotel becomes read-only. You can still record payments, settle bills and check guests out, but you cannot add new bookings or charges. Nothing is deleted. We switch a plan on after we agree it with you.</p>
      </LegalPart>
      <LegalPart title="4. Plans and prices">
        <p>Pricing depends on the size of your hotel. <Link to="/contact" className={link}>Contact us</Link> for a price. Payment terms: <ToConfirm what="payment terms" />.</p>
      </LegalPart>
      <LegalPart title="5. Your information">
        <p>The information your hotel enters is yours. You can export bookings, transactions and guests to a spreadsheet. How we handle it is described in the <Link to="/privacy" className={link}>privacy notice</Link>.</p>
      </LegalPart>
      <LegalPart title="6. Payments and taxes">
        <ul>
          <li>Hotel Desk records payments you take outside the system. It does not charge cards or move money.</li>
          <li>Your hotel sets its own tax and service charge rates. Set them to your accountant's advice.</li>
        </ul>
      </LegalPart>
      <LegalPart title="7. Your staff">
        <p>You decide who in your hotel can sign in and what each person can do. Keep sign-in details private.</p>
      </LegalPart>
      <LegalPart title="8. Cancelling">
        <p><Link to="/contact" className={link}>Contact us to cancel.</Link></p>
      </LegalPart>
      <LegalPart title="9. Liability and governing law">
        <p><ToConfirm what="liability and governing law, after legal review" /></p>
      </LegalPart>
    </Section>
  );
}
