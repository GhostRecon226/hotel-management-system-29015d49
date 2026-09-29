import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess, myContextQuery } from "@/lib/access";
import { Field, SectionHeader, useSetupMutation } from "@/lib/setup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/_app/setup/property")({
  component: PropertyDetails,
});

function PropertyDetails() {
  const { property, can } = useAccess();
  const qc = useQueryClient();
  const canEdit = can("setup.property.edit");
  const { data } = useQuery({
    queryKey: ["setup", "properties", property?.id],
    enabled: !!property,
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").eq("id", property!.id).single();
      if (error) throw error;
      return data;
    },
  });
  const [f, setF] = useState({ name: "", address: "", city: "", country: "", timezone: "", check_in: "", check_out: "" });
  useEffect(() => {
    if (data) setF({
      name: data.name, address: data.address ?? "", city: data.city ?? "", country: data.country ?? "",
      timezone: data.timezone, check_in: data.check_in_time.slice(0, 5), check_out: data.check_out_time.slice(0, 5),
    });
  }, [data]);
  const save = useSetupMutation("update_property", ["properties"]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      p_property_id: property!.id, p_name: f.name, p_address: f.address, p_city: f.city, p_country: f.country,
      p_timezone: f.timezone, p_check_in_time: f.check_in, p_check_out_time: f.check_out,
    }, { onSuccess: () => qc.invalidateQueries({ queryKey: myContextQuery.queryKey }) });
  }

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <form onSubmit={submit} className="max-w-xl space-y-4">
      <SectionHeader title="Property details" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Property name" htmlFor="name"><Input id="name" value={f.name} onChange={set("name")} disabled={!canEdit} /></Field>
        <Field label="Code" htmlFor="code"><Input id="code" value={data.code} disabled /></Field>
        <Field label="Address" htmlFor="address"><Input id="address" value={f.address} onChange={set("address")} disabled={!canEdit} /></Field>
        <Field label="City" htmlFor="city"><Input id="city" value={f.city} onChange={set("city")} disabled={!canEdit} /></Field>
        <Field label="Country" htmlFor="country"><Input id="country" value={f.country} onChange={set("country")} disabled={!canEdit} /></Field>
        <Field label="Time zone" htmlFor="tz" hint="For example Africa/Lagos"><Input id="tz" value={f.timezone} onChange={set("timezone")} disabled={!canEdit} /></Field>
        <Field label="Check-in time" htmlFor="ci"><Input id="ci" type="time" value={f.check_in} onChange={set("check_in")} disabled={!canEdit} /></Field>
        <Field label="Check-out time" htmlFor="co"><Input id="co" type="time" value={f.check_out} onChange={set("check_out")} disabled={!canEdit} /></Field>
        <Field label="Base currency" htmlFor="cur"><Input id="cur" value={data.base_currency} disabled /></Field>
        <Field label="Business date" htmlFor="bd"><Input id="bd" value={data.business_date} disabled /></Field>
      </div>
      {canEdit && <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button>}
    </form>
  );
}
