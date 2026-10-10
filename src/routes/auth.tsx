import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/errors";
import { AuthLayout } from "@/components/auth-layout";
import { useHydrated } from "@/lib/use-hydrated";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to Zikora" },
      { name: "description", content: "Sign in to continue to your hotel workspace." },
      { property: "og:title", content: "Sign in to Zikora" },
      { property: "og:description", content: "Sign in to continue to your hotel workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
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
        <h1 className="text-[32px] font-semibold">Welcome back.</h1>
        <p className="mb-6 mt-1 text-[15px] text-muted-foreground">Sign in to continue to your hotel workspace.</p>
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
  const [showPassword, setShowPassword] = useState(false);
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
        <Label htmlFor={`${mode}-email`}>Email address</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id={`${mode}-email`} type="email" autoComplete="email" placeholder="you@hotelname.com" className="h-11 pl-10" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${mode}-password`}>Password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id={`${mode}-password`} type={showPassword ? "text" : "password"} placeholder="Enter your password" className="h-11 px-10"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="button" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword} aria-label="Reveal characters"
            className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
            {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
        {mode === "signup" && <p className="text-sm text-muted-foreground">At least 8 characters.</p>}
        {mode === "signin" && (
          <p className="flex flex-wrap items-center justify-between gap-x-4 text-sm">
            <span className="text-muted-foreground">Need access? Ask your hotel administrator.</span>
            <Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
          </p>
        )}
      </div>
      {error && <p className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger-strong" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="h-11 w-full gap-2" disabled={busy}>
        {busy ? "Please wait…" : mode === "signup" ? "Create account" : <>Sign in <ArrowRight className="size-4" aria-hidden /></>}
      </Button>
      </fieldset>
    </form>
  );
}
