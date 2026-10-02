import { createFileRoute, Link } from "@tanstack/react-router";
import { Eyebrow, Section } from "@/components/public/public-layout";
import { ToConfirm } from "@/components/public/to-confirm";
import { Button } from "@/components/ui/button";

const TITLE = "About: Hotel Desk";
const DESCRIPTION = "Hotel Desk is a hotel management system for independent hotels in Nigeria.";

export const Route = createFileRoute("/_public/about")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESCRIPTION }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESCRIPTION }] }),
  component: About,
});

function About() {
  return (
    <Section className="max-w-3xl">
      <Eyebrow>About</Eyebrow>
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">About Hotel Desk</h1>
      <p className="mt-5 text-base text-muted-foreground">Hotel Desk is a hotel management system for independent hotels in Nigeria. It is made by <ToConfirm what="company name" />.</p>
      <div className="mt-8 rounded-xl border border-border/70 bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold">Our story</h2>
        <p className="mt-2 text-[15px] text-muted-foreground"><ToConfirm what="about text" /></p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild><Link to="/contact">Contact us</Link></Button>
        <Button asChild variant="outline"><Link to="/pricing">See pricing</Link></Button>
      </div>
    </Section>
  );
}
