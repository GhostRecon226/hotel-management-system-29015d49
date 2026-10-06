import { createFileRoute, Link } from "@tanstack/react-router";
import { Eyebrow, Section } from "@/components/public/public-layout";
import { ToConfirm } from "@/components/public/to-confirm";
import { Button } from "@/components/ui/button";
import { ORGANIZATION_LD, pageHead } from "@/lib/seo";

const TITLE = "About Hotel Desk | Hotel Software Built for Nigeria";
const DESCRIPTION = "Hotel Desk helps independent hotels in Nigeria run the front desk, rooms and bills in one place. Read why we built it.";

export const Route = createFileRoute("/_public/about")({
  head: () => pageHead({ title: TITLE, description: DESCRIPTION, jsonLd: [ORGANIZATION_LD] }),
  component: About,
});

const BELIEFS = [
  { title: "Money must add up.", text: "Every naira is recorded once, and nothing is rewritten after the fact." },
  { title: "Simple beats clever.", text: "If your night receptionist cannot use it on her first shift, we have more work to do." },
  { title: "Your data is yours.", text: "Export it any time. We do not sell it." },
  { title: "We listen.", text: "Pilot hotels shape what we build next." },
];

function About() {
  return (
    <Section className="max-w-3xl">
      <Eyebrow>About</Eyebrow>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">About Hotel Desk: built for the way independent hotels really work.</h1>
      <p className="mt-5 text-base text-muted-foreground">Hotel Desk is hotel management software made for independent hotels in Nigeria. It is built by <ToConfirm what="company name" />.</p>
      <div className="mt-8 rounded-xl border border-border/70 bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold">Our story</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground"><ToConfirm what="about text" /></p>
      </div>
      <div className="mt-6 rounded-xl border border-border/70 bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold">What we believe</h2>
        <ul className="mt-3 space-y-3 text-[15px] text-muted-foreground">
          {BELIEFS.map((b) => <li key={b.title}><strong className="text-foreground">{b.title}</strong> {b.text}</li>)}
        </ul>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild><Link to="/auth">Start your free trial</Link></Button>
        <Button asChild variant="outline"><Link to="/contact">Contact us</Link></Button>
      </div>
    </Section>
  );
}
