import type { ReactNode } from "react";

/** One numbered part of a legal page. */
export function LegalPart({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border/70 py-6 first:border-0 first:pt-0">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">{children}</div>
    </section>
  );
}
