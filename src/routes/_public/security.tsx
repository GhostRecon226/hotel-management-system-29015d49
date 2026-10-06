import { createFileRoute, Link } from "@tanstack/react-router";
import { Eyebrow, Section } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { ORGANIZATION_LD, pageHead } from "@/lib/seo";

const TITLE = "Hotel Data Security and Privacy | Hotel Desk";
const DESCRIPTION = "How Hotel Desk protects guest records and hotel money: separate hotel data, approvals, an audit trail and private ID photos.";

export const Route = createFileRoute("/_public/security")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, jsonLd: [ORGANIZATION_LD] }),
  component: Security,
});

const PARTS: { title: string; text?: string; list?: string[] }[] = [
  { title: "Your hotel's data stays yours", text: "Each hotel's information is kept separate from every other hotel's, and we test this. Inside your hotel, each person sees only what their role allows. We do not sell your information, and we use no advertising or tracking cookies." },
  { title: "Money records cannot be rewritten", text: "Bills, payments and invoices cannot be edited or deleted. A mistake is fixed with a new entry that points back to the original, so the full story stays on record. Repeating a payment by accident is blocked: a retry never posts twice, and a likely duplicate asks the cashier to confirm." },
  { title: "A second pair of eyes on risky actions", text: "Discounts above a limit, adjustments, reversals and refunds need approval from another person. The person who asks cannot approve their own request. Nobody can give a colleague a permission or approval limit they do not hold themselves." },
  { title: "Every change leaves a trail", text: "The system records who did what and when. For guest details it records which details changed, not the details themselves, so the trail does not become a second copy of private data." },
  { title: "ID documents get extra care", list: [
    "ID numbers are hidden unless a person's role allows them.",
    "Photos of ID documents are optional, off until a manager switches them on, and kept in private storage.",
    "A photo opens only through a link that works for 60 seconds. Every upload, view and deletion is recorded.",
    "Photos are shrunk on the device before upload, which also removes hidden details such as where the photo was taken.",
    "Photos are deleted automatically 12 months after the guest's last check-out, and straight away if the guest's details are removed.",
  ] },
  { title: "Where your data lives", text: "On secure servers in the European Union (Ireland). Sign-in uses email and password, and a hotel manager decides who can sign in." },
  { title: "You can always take your data with you", text: "Export bookings, transactions and guests to a spreadsheet whenever you like." },
];

function Security() {
  return (
    <Section className="max-w-3xl">
      <Eyebrow>Security</Eyebrow>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Guest records and hotel money, protected on purpose.</h1>
      <p className="mt-4 text-base text-muted-foreground">A hotel holds names, ID details and money. We built Hotel Desk so that only the right person sees each, and so that no record can be changed quietly.</p>
      <div className="mt-8 space-y-4">
        {PARTS.map((p) => (
          <section key={p.title} className="rounded-xl border border-border/70 bg-card p-6 shadow-card">
            <h2 className="text-lg font-bold">{p.title}</h2>
            {p.text && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{p.text}</p>}
            {p.list && <ul className="mt-2 space-y-2 text-[15px] leading-relaxed text-muted-foreground [&_li]:ml-5 [&_li]:list-disc">{p.list.map((i) => <li key={i}>{i}</li>)}</ul>}
          </section>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild><Link to="/contact">Questions about security? Talk to us</Link></Button>
        <Button asChild variant="outline"><Link to="/privacy">Read the privacy notice</Link></Button>
      </div>
    </Section>
  );
}
