import { Link } from "@tanstack/react-router";
import { ArrowRight, ListChecks, Tag, Layers } from "lucide-react";
import { Section } from "@/components/public/public-layout";

/* A short row of links to the pages that go deeper, so the home page stays short. */
const ITEMS = [
  { to: "/features", icon: Layers, title: "Features", text: "Nine areas of hotel work, in plain words." },
  { to: "/how-it-works", icon: ListChecks, title: "How it works", text: "Follow one guest from booking to invoice, with sample screens." },
  { to: "/pricing", icon: Tag, title: "Pricing", text: "Three plans in naira. 60 days free with every feature." },
] as const;

export function Explore() {
  return (
    <Section className="pt-0 sm:pt-0">
      <div data-reveal className="mx-auto max-w-2xl text-center">
        <h2 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">Go deeper.</h2>
        <p className="mt-3 text-[15px] text-muted-foreground sm:text-base">Each page covers one question on its own.</p>
      </div>
      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {ITEMS.map(({ to, icon: Icon, title, text }, i) => (
          <li key={to} data-reveal style={{ "--i": i } as React.CSSProperties}>
            <Link to={to} className="mer-lift group flex h-full flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-card outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
              <span aria-hidden className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary-strong"><Icon className="size-5" /></span>
              <h3 className="font-sans mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-1 text-[15px] text-muted-foreground">{text}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-strong">Open <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
