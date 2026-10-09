import { createFileRoute, Link } from "@tanstack/react-router";
import { DraftNotice, Eyebrow, Section } from "@/components/public/public-layout";
import { LegalPart } from "@/components/public/legal";
import { ToConfirm } from "@/components/public/to-confirm";
import { pageHead } from "@/lib/seo";

const TITLE = "Terms of Use | Zikora";
const DESCRIPTION = "The terms for using Zikora: free trial, plans, your data, payments and taxes, and how to cancel.";

export const Route = createFileRoute("/_public/terms")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION }),
  component: Terms,
});

const link = "font-semibold text-primary underline-offset-4 hover:underline";

// Every statement here was checked against the system. Items shown through <ToConfirm> wait for legal advice.
// A production build refuses to run while any remain.
function Terms() {
  return (
    <Section className="max-w-3xl">
      <Eyebrow>Terms of use</Eyebrow>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Terms of use</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: <ToConfirm what="date of the final version" /></p>
      <div className="mt-6"><DraftNotice /></div>
      <p className="mb-6 text-[15px] leading-relaxed text-muted-foreground"><strong className="text-foreground">In short.</strong> You get a free trial. After it, your hotel pays a price we agree together. Your data stays yours. We keep the service running with care, and we explain here what happens when things go wrong.</p>
      <LegalPart title="1. The service">
        <p>Zikora is a hotel management system provided by <ToConfirm what="company name" /> ("we", "us"). It runs in a web browser and needs an internet connection. By creating an account or using the service, you agree to these terms on behalf of your hotel.</p>
      </LegalPart>
      <LegalPart title="2. Your account">
        <p>You decide who in your hotel can sign in and what each person can do. Keep sign-in details private, and tell us if you think someone else has them. You are responsible for what is done under your hotel's account.</p>
      </LegalPart>
      <LegalPart title="3. Free trial">
        <p>When you create your hotel, a 30-day free trial starts. You do not need a card.</p>
      </LegalPart>
      <LegalPart title="4. When the trial or a plan ends">
        <p>Your hotel becomes read-only. Your team can still record payments, settle bills and check guests out, but cannot add new bookings or charges. Nothing is deleted. We switch a plan on after we agree it with you.</p>
      </LegalPart>
      <LegalPart title="5. Plans and prices">
        <p>Pricing depends on the size of your hotel. <Link to="/contact" className={link}>Contact us</Link> for a price. <ToConfirm what="payment terms" />.</p>
      </LegalPart>
      <LegalPart title="6. Your information">
        <p>The information your hotel enters is yours. You can export bookings, transactions and guests to a spreadsheet at any time. We handle it as described in the <Link to="/privacy" className={link}>privacy notice</Link>. You are responsible for having the right to record your guests' information and for telling guests how your hotel uses it.</p>
      </LegalPart>
      <LegalPart title="7. Payments and taxes">
        <ul>
          <li>Zikora records payments you take outside the system. It does not charge cards or move money.</li>
          <li>Your hotel sets its own tax and service charge rates. Set them with your accountant's advice. You remain responsible for the tax returns your hotel files.</li>
        </ul>
      </LegalPart>
      <LegalPart title="8. Using the service properly">
        <p><ToConfirm what="acceptable use wording, after legal review" /></p>
      </LegalPart>
      <LegalPart title="9. Keeping the service running">
        <p><ToConfirm what="availability wording, after legal review" /></p>
      </LegalPart>
      <LegalPart title="10. Cancelling">
        <p>You can cancel by <Link to="/contact" className={link}>contacting us</Link>. We may suspend an account for unpaid fees or misuse, and we will tell you first where we can. After an account closes, we handle its information as the privacy notice says.</p>
      </LegalPart>
      <LegalPart title="11. Liability">
        <p><ToConfirm what="liability limit and exclusions, after legal review" /></p>
      </LegalPart>
      <LegalPart title="12. Governing law">
        <p><ToConfirm what="governing law and where disputes are heard, after legal review" /></p>
      </LegalPart>
      <LegalPart title="13. Changes to these terms">
        <p>We will tell you about important changes before they start. Using the service after a change means you accept it.</p>
      </LegalPart>
      <LegalPart title="14. Contact">
        <p><ToConfirm what="company name" />, <ToConfirm what="contact email" />, <ToConfirm what="phone" />.</p>
      </LegalPart>
    </Section>
  );
}
