import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { z } from "zod";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/check-email")({
  validateSearch: z.object({ email: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Check your email — Hotel Desk" },
      { name: "description", content: "Confirm your email address to finish creating your account." },
      { property: "og:title", content: "Check your email — Hotel Desk" },
      { property: "og:description", content: "Confirm your email address to finish creating your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckEmail,
});

function CheckEmail() {
  const { email } = Route.useSearch();
  return (
    <AuthLayout>
      <div className="text-center lg:text-left">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-primary-soft text-primary lg:mx-0">
          <MailCheck className="size-7" />
        </div>
        <h1 className="text-[28px] font-semibold">Check your email</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          We sent a confirmation link to {email ? <strong className="text-foreground">{email}</strong> : "your email address"}.
          Click the link, then sign in to set up your hotel.
        </p>
        <Button asChild variant="outline" className="mt-8"><Link to="/auth">Back to sign in</Link></Button>
      </div>
    </AuthLayout>
  );
}
