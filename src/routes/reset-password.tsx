import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/errors";
import { AuthLayout } from "@/components/auth-layout";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set a new password | Hotel Desk" }, { name: "description", content: "Choose a new password for your account." }, { name: "robots", content: "noindex" }] }),
  component: ResetPassword,
});

// The emailed link signs the user in for this one purpose (Supabase reads the token from the address).
// With no session there is nothing to change: the link was used, expired, or never opened.
function ResetPassword() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const linkError = new URLSearchParams(window.location.hash.slice(1)).get("error_code");
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setState(data.session && !linkError ? "ready" : "invalid");
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session && alive) setState("ready");
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password.length > 72) { setError("Password must be at most 72 characters."); return; }
    if (password !== confirm) { setError("The two passwords do not match."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password changed.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div>
        <h1 className="text-[28px] font-semibold">Set a new password</h1>
        {state === "checking" && <p className="mt-2 text-[15px] text-muted-foreground">Checking your link…</p>}
        {state === "invalid" && (
          <>
            <p className="mt-2 text-[15px] text-muted-foreground" role="status">
              This link has expired or was already used. Reset links work once, for one hour.
            </p>
            <Button asChild className="mt-8"><Link to="/forgot-password">Send a new link</Link></Button>
          </>
        )}
        {state === "ready" && (
          <form onSubmit={submit} className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <p className="text-sm text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            {error && <p className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger-strong" role="alert">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
