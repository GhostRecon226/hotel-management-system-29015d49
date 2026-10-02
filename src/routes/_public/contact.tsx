import { createFileRoute } from "@tanstack/react-router";
import { Clock, Mail, MessageCircle, Phone } from "lucide-react";
import { ContactCard } from "@/components/public/contact-card";
import { Eyebrow, Section } from "@/components/public/public-layout";
import { ToConfirm } from "@/components/public/to-confirm";

const TITLE = "Contact: Hotel Desk";
const DESCRIPTION = "Contact Hotel Desk for a price for your hotel, to start a plan, or for help.";

export const Route = createFileRoute("/_public/contact")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESCRIPTION }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESCRIPTION }] }),
  component: Contact,
});

function Contact() {
  return (
    <Section className="max-w-4xl">
      <Eyebrow>Contact</Eyebrow>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Talk to us</h1>
      <p className="mt-4 max-w-2xl text-base text-muted-foreground">For a price for your hotel, to start or cancel a plan, or for help with the system.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ContactCard icon={Mail} label="Email"><ToConfirm what="contact email" /></ContactCard>
        <ContactCard icon={Phone} label="Phone"><ToConfirm what="phone" /></ContactCard>
        <ContactCard icon={MessageCircle} label="WhatsApp"><ToConfirm what="WhatsApp" /></ContactCard>
        <ContactCard icon={Clock} label="Support hours"><ToConfirm what="support hours" /></ContactCard>
      </div>
    </Section>
  );
}
