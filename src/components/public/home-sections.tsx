import { Link } from "@tanstack/react-router";
import { Section } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";

/** Closing call to action. */
export function ClosingCta({ title, text, button = "Start free trial" }: { title: string; text: string; button?: string }) {
  return (
    <Section className="pt-0 sm:pt-0">
      <div className="relative overflow-hidden rounded-2xl bg-accent-fill px-6 py-12 text-center text-primary-foreground shadow-accent sm:px-12">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10" />
        <h2 className="font-sans relative text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
        <p className="relative mx-auto mt-2 max-w-xl text-[15px] text-on-primary-muted">{text}</p>
        <div className="relative mt-6 flex justify-center">
          <Button asChild size="lg" variant="secondary"><Link to="/auth" search={{ mode: "signup" }}>{button}</Link></Button>
        </div>
      </div>
    </Section>
  );
}
