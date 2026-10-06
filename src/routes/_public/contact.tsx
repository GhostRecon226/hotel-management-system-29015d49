import { createFileRoute } from "@tanstack/react-router";
import { Clock, Mail, MessageCircle, Phone } from "lucide-react";
import { ContactCard } from "@/components/public/contact-card";
import { Eyebrow, Section } from "@/components/public/public-layout";
import { ToConfirm } from "@/components/public/to-confirm";
import { pageHead } from "@/lib/seo";

const TITLE = "Contact Hotel Desk | Get a Price for Your Hotel";
const DESCRIPTION = "Talk to us for a price for your hotel, to start or cancel a plan, or for help. Email, phone and WhatsApp.";

export const Route = createFileRoute("/_public/contact")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION }),
  component: Contact,
});

function Contact() {
  return (
    <Section className="max-w-4xl">
      <Eyebrow>Contact</Eyebrow>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Talk to a real person.</h1>
      <p className="mt-4 max-w-2xl text-base text-muted-foreground">For a price for your hotel, to start or cancel a plan, or for help with the system, reach us here.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ContactCard icon={Mail} label="Email"><ToConfirm what="contact email" /></ContactCard>
        <ContactCard icon={Phone} label="Phone"><ToConfirm what="phone" /></ContactCard>
        <ContactCard icon={MessageCircle} label="WhatsApp"><ToConfirm what="WhatsApp" /></ContactCard>
        <ContactCard icon={Clock} label="Support hours"><ToConfirm what="support hours" /></ContactCard>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">Already a customer? Include your hotel's name so we can help you faster.</p>
    </Section>
  );
}
