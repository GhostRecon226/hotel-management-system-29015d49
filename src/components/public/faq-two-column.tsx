import { Link } from "@tanstack/react-router";
import { MessageCircleQuestion } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/public/public-layout";
import type { Faq } from "@/components/public/faq-content";

/*
 * Two-column FAQ: a sticky intro and contact card on the left, the questions on the right.
 * Layout based on "Two-Column FAQ" (faqs-02) by LN (lndev-ui) on 21st.dev (MIT licence).
 * Rebuilt for Hotel Desk with the tokens in src/theme.css and our Radix accordion; no code copied.
 * The intro comes first in the page, so keyboard order follows reading order: heading, contact button, questions.
 */
export function FaqTwoColumn({ faqs, title, intro }: { faqs: Faq[]; title: string; intro: string }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Eyebrow>FAQs</Eyebrow>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">{intro}</p>
        <div className="mt-6 rounded-xl border border-border/70 bg-card p-5 shadow-card">
          <span className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary-strong" aria-hidden><MessageCircleQuestion className="size-5" /></span>
          <h2 className="mt-3 text-base font-bold">Still have a question?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tell us about your hotel and we will answer.</p>
          <Button asChild className="mt-4"><Link to="/contact">Contact us</Link></Button>
        </div>
      </div>
      <FaqList faqs={faqs} />
    </div>
  );
}

/** The questions alone (also used on the pricing page). Planned answers carry a "Planned" label. */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <Accordion type="multiple" className="rounded-xl border border-border/70 bg-card px-5 shadow-card">
      {faqs.map((f) => (
        <AccordionItem key={f.id} value={f.id}>
          <AccordionTrigger>
            <span className="flex flex-wrap items-center gap-2">{f.q}{f.planned && <Badge variant="neutral">Planned</Badge>}</span>
          </AccordionTrigger>
          <AccordionContent>{f.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
