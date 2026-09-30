import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { myContextQuery } from "@/lib/access";
import { errorMessage } from "@/lib/errors";
import { AuthLayout } from "@/components/auth-layout";

export const Route = createFileRoute("/_authenticated/create-hotel")({
  beforeLoad: async ({ context }) => {
    const ctx = await context.queryClient.ensureQueryData({ ...myContextQuery, revalidateIfStale: true });
    if (ctx.has_hotel) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Create your hotel — Hotel Desk" },
      { name: "description", content: "Set up your hotel and first property." },
      { property: "og:title", content: "Create your hotel — Hotel Desk" },
      { property: "og:description", content: "Set up your hotel and first property." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreateHotel,
});

const COUNTRIES = ["Nigeria", "Ghana", "Kenya", "South Africa", "Other"] as const;

const schema = z.object({
  business_name: z.string().trim().min(1, "Business name is required.").max(120),
  country: z.enum(COUNTRIES, { message: "Choose a country." }),
  property_name: z.string().trim().min(1, "Property name is required.").max(120),
  full_name: z.string().trim().min(1, "Your full name is required.").max(120),
  city: z.string().trim().min(1, "City is required.").max(80),
});

function CreateHotel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ business_name: "", country: "Nigeria", property_name: "", full_name: "", city: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setBusy(true);
    const d = parsed.data;
    const { error } = await supabase.rpc("create_hotel", {
      p_business_name: d.business_name,
      p_country: d.country,
      p_property_name: d.property_name,
      p_full_name: d.full_name,
      p_city: d.city,
    });
    if (error) {
      setError(errorMessage(error));
      setBusy(false);
      return;
    }
    // Fetch the new context before leaving: the dashboard guard must see has_hotel = true,
    // or it sends the user straight back here and the button stays on "Creating…".
    try {
      await queryClient.fetchQuery({ ...myContextQuery, staleTime: 0 });
      await navigate({ to: "/dashboard", replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout wide>
      <form onSubmit={submit} className="space-y-5">
        <div className="mb-2">
          <h1 className="text-[28px] font-semibold">Create your hotel</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">You get a 30-day free trial on the Starter plan.</p>
        </div>
        <Field id="business_name" label="Business name" value={form.business_name} onChange={set("business_name")} />
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <Select value={form.country} onValueChange={set("country")}>
            <SelectTrigger id="country"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Field id="property_name" label="Property name" value={form.property_name} onChange={set("property_name")} />
        <Field id="full_name" label="Your full name" value={form.full_name} onChange={set("full_name")} />
        <Field id="city" label="City" value={form.city} onChange={set("city")} />
        {error && <p className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger-strong" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create hotel"}</Button>
      </form>
    </AuthLayout>
  );
}

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} required />
    </div>
  );
}
