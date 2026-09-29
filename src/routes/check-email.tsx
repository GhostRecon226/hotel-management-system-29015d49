import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { z } from "zod";

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
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-center shadow-sm">
        <MailCheck className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a confirmation link to {email ? <strong className="text-foreground">{email}</strong> : "your email address"}.
          Click the link, then sign in to set up your hotel.
        </p>
        <Link to="/auth" className="mt-5 inline-block text-sm font-medium text-primary underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
