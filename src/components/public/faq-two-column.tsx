import { Link } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { Faq } from "@/components/public/faq-content";

const link = "font-semibold text-primary underline-offset-4 hover:underline";

/** The questions alone (also used on the pricing page). */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <Accordion type="multiple" className="rounded-xl border border-border/70 bg-card px-5 shadow-card">
      {faqs.map((f) => (
        <AccordionItem key={f.id} value={f.id}>
          <AccordionTrigger>{f.q}</AccordionTrigger>
          <AccordionContent>
            {f.a}
            {f.more && <> <Link to={f.more.to} className={link}>{f.more.label}</Link></>}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
