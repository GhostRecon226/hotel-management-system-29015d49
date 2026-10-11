import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/errors";
import { Field, FormDialog } from "@/lib/setup";

// A signed-in user changes their own password. The current password is checked first, so a phone left
// unlocked cannot be used to take over the account. No email is needed.
export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close(o: boolean) {
    if (!o) { setCurrent(""); setPassword(""); setConfirm(""); setError(null); }
    onOpenChange(o);
  }

  async function submit() {
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password.length > 72) { setError("Password must be at most 72 characters."); return; }
    if (password !== confirm) { setError("The two passwords do not match."); return; }
    if (password === current) { setError("Choose a password that is different from the current one."); return; }
    setBusy(true);
    try {
      const { data: me } = await supabase.auth.getUser();
      const email = me.user?.email;
      if (!email) { setError("Your session has ended. Sign in again."); return; }
      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) { setError("The current password is not correct."); return; }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      toast.success("Password changed.");
      close(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog open={open} onOpenChange={close} title="Change password" onSubmit={submit} busy={busy} submitLabel="Change password">
      <Field label="Current password" htmlFor="current-password">
        <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </Field>
      <Field label="New password" htmlFor="change-new-password" hint="At least 8 characters.">
        <Input id="change-new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Field label="Confirm new password" htmlFor="change-confirm-password">
        <Input id="change-confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      {error && <p className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger-strong" role="alert">{error}</p>}
    </FormDialog>
  );
}
