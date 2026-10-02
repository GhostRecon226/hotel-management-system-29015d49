import type { LucideIcon } from "lucide-react";

/** Features grid (our own). Each card: icon chip, title, two lines of text. */
export function FeatureGrid({ items }: { items: { icon: LucideIcon; title: string; text: string }[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title} className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
          <span className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary-strong" aria-hidden><Icon className="size-5" /></span>
          <h3 className="mt-4 text-base font-bold">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
        </li>
      ))}
    </ul>
  );
}
