import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/errors";

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
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Hotel Desk</h1>
        <p className="mb-5 text-sm text-muted-foreground">Sign in to your hotel, or create an account.</p>
        <Tabs defaultValue="signin">
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>
          <TabsContent value="signin"><AuthForm mode="signin" /></TabsContent>
          <TabsContent value="signup"><AuthForm mode="signup" /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
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
    <form onSubmit={submit} className="space-y-4">
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
        {mode === "signup" && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}
