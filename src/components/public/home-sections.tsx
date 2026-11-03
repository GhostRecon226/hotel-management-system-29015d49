import { Link } from "@tanstack/react-router";
import { Check, Database, Link2, ShieldCheck, type LucideIcon } from "lucide-react";
import { Section } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";

/*
 * Homepage closing (storyboard v1, Nov 2026): three trust points, then the call to action.
 * Every statement is checked against what the app does. No customer numbers, logos, quotes, savings figures or integrations.
 */
const TRUST: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Link2, title: "Connected operations", text: "Departments work from one shared system." },
  { icon: Database, title: "Accountable transactions", text: "Financial activity has traceable records." },
  { icon: ShieldCheck, title: "Controlled access", text: "Staff access follows assigned responsibilities." },
];

export function TrustStrip() {
  return (
    <Section className="pt-0 sm:pt-0">
      <ul className="grid gap-5 sm:grid-cols-3">
        {TRUST.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-strong"><Icon className="size-4" /></span>
            <div>
              <p className="text-[15px] font-bold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-5 flex items-center gap-2 text-sm"><Check aria-hidden className="size-4 text-success-strong" /><Link to="/security" className="font-semibold text-primary underline-offset-4 hover:underline">How Zikora handles security and data</Link></p>
    </Section>
  );
}

/** Closing call to action. */
export function ClosingCta({ title, text, button = "Start free trial" }: { title: string; text: string; button?: string }) {
  return (
    <Section className="pt-0 sm:pt-0">
      <div className="relative overflow-hidden rounded-2xl bg-accent-fill px-6 py-12 text-center text-primary-foreground shadow-accent sm:px-12">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10" />
        <h2 className="relative text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
        <p className="relative mx-auto mt-2 max-w-xl text-[15px] text-on-primary-muted">{text}</p>
        <div className="relative mt-6 flex justify-center">
          <Button asChild size="lg" variant="secondary"><Link to="/auth" search={{ mode: "signup" }}>{button}</Link></Button>
        </div>
      </div>
    </Section>
  );
}
