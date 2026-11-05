import { Section } from "@/components/public/public-layout";

/* Four plain facts about how Zikora works. No results, savings or customer numbers: each line describes the product. */
const FACTS = [
  { title: "One booking record, from reservation to invoice.", text: "Check-in, charges, payments and the invoice all read from the same booking." },
  { title: "Rooms update as the work gets done.", text: "Check-out opens a cleaning task. A different person inspects it before the room shows as clean." },
  { title: "Posted money stays as it was posted.", text: "Charges and payments are never edited. A correction is a linked reversal, and large ones need a second person to approve." },
  { title: "The day closes the same way every night.", text: "Room charges post once, expired holds clear, and the daily figures the reports use are saved." },
];

export function Facts() {
  return (
    <Section>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div data-reveal>
          <h2 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">What changes for your team.</h2>
          <p className="mt-3 text-[15px] text-muted-foreground">Four things Zikora does every day, so the record stays right.</p>
        </div>
        <ol className="divide-y divide-border/70 border-y border-border/70" aria-label="What changes for your team">
          {FACTS.map((f, i) => (
            <li key={f.title} data-reveal style={{ "--i": i } as React.CSSProperties} className="flex gap-5 py-6">
              <span aria-hidden className="w-8 shrink-0 text-sm font-bold tabular text-primary">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="font-sans text-lg font-bold">{f.title}</h3>
                <p className="mt-1 text-[15px] text-muted-foreground">{f.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
