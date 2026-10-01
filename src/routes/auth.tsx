import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/errors";
import { AuthLayout } from "@/components/auth-layout";
import { useHydrated } from "@/lib/use-hydrated";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Hotel Desk" },
      { name: "description", content: "Sign in or create an account to manage your hotel." },
      { property: "og:title", content: "Sign in — Hotel Desk" },
      { property: "og:description", content: "Sign in or create an account to manage your hotel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(255),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

function AuthPage() {
  return (
    <AuthLayout>
      <div>
        <h1 className="text-[28px] font-semibold">Welcome</h1>
        <p className="mb-6 mt-1 text-[15px] text-muted-foreground">Sign in to your hotel, or create an account.</p>
        <Tabs defaultValue="signin">
          <TabsList className="mb-6 grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>
          <TabsContent value="signin"><AuthForm mode="signin" /></TabsContent>
          <TabsContent value="signup"><AuthForm mode="signup" /></TabsContent>
        </Tabs>
      </div>
    </AuthLayout>
  );
}

function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        navigate({ to: "/check-email", search: { email: parsed.data.email } });
      } else {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) {
          if (/confirm/i.test(error.message)) throw new Error("Please confirm your email first. Check your inbox.");
          throw error;
        }
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {/* Locked until the page is ready, so nothing typed or clicked during a slow first load is lost. */}
      <fieldset disabled={!hydrated} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor={`${mode}-email`}>Email</Label>
        <Input id={`${mode}-email`} type="email" autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${mode}-password`}>Password</Label>
        <Input id={`${mode}-password`} type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password} onChange={(e) => setPassword(e.target.value)} required />
        {mode === "signup" && <p className="text-sm text-muted-foreground">At least 8 characters.</p>}
        {mode === "signin" && (
          <p className="text-sm"><Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link></p>
        )}
      </div>
      {error && <p className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger-strong" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </Button>
      </fieldset>
    </form>
  );
}
