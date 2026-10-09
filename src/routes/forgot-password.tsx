import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/errors";
import { AuthLayout } from "@/components/auth-layout";
import { useHydrated } from "@/lib/use-hydrated";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset your password | Zikora" }, { name: "description", content: "Get a link to set a new password." }, { name: "robots", content: "noindex" }] }),
  component: ForgotPassword,
});

const schema = z.object({ email: z.string().trim().email("Enter a valid email address.").max(255) });

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const hydrated = useHydrated();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ email });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    try {
      // The link comes back to /reset-password on whatever address the app is running at.
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      setSent(true); // same message whether or not the account exists, so nobody can test which emails are registered
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div>
        <h1 className="text-[28px] font-semibold">Reset your password</h1>
        {sent ? (
          <>
            <p className="mt-2 text-[15px] text-muted-foreground" role="status">
              If an account exists for that email, we have sent a link to set a new password. The link works for one hour.
              Check your spam folder if it does not arrive in a few minutes.
            </p>
            <Button asChild variant="outline" className="mt-8"><Link to="/auth">Back to sign in</Link></Button>
          </>
        ) : (
          <>
            <p className="mb-6 mt-1 text-[15px] text-muted-foreground">Enter the email you sign in with. We will send you a link to set a new password.</p>
            <form onSubmit={submit}>
              <fieldset disabled={!hydrated} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input id="forgot-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                {error && <p className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger-strong" role="alert">{error}</p>}
                <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Please wait…" : "Send reset link"}</Button>
                <p className="text-center text-sm"><Link to="/auth" className="text-muted-foreground hover:text-foreground">Back to sign in</Link></p>
              </fieldset>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
