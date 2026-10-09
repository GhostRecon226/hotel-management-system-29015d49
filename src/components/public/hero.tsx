import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/public/public-layout";

/*
 * Hero: label, headline, one paragraph and two buttons, centred.
 * Layout based on "Hero with text and two button" by Tommy Jepsen on 21st.dev (MIT licence).
 * Rebuilt for Zikora with the tokens in src/theme.css; no code copied. See THIRD_PARTY_NOTICES.md.
 */
export function Hero({ label, title, text }: { label: string; title: string; text: string }) {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-96 max-w-4xl rounded-full bg-primary-soft opacity-70 blur-3xl" />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
        <Eyebrow>{label}</Eyebrow>
        <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">{text}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth">Start your free trial <ArrowRight aria-hidden /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/contact">Talk to us</Link></Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">30 days free. No card needed.</p>
      </div>
    </section>
  );
}
