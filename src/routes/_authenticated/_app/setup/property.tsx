import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess, myContextQuery } from "@/lib/access";
import { Field, SectionHeader, useSetupMutation } from "@/lib/setup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { callRpc } from "@/lib/setup";
import { errorMessage } from "@/lib/errors";
import { useIdPhotoSettings, type IdPhotoSettings } from "@/lib/id-photos";

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
    <>
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
    <InspectionSection canEdit={canEdit} required={data.inspection_required} />
    <IdPhotoSettingsSection canEdit={canEdit} />
    </>
  );
}

/** SET-008: housekeeping inspection on or off for this property. */
function InspectionSection({ canEdit, required }: { canEdit: boolean; required: boolean }) {
  const { property } = useAccess();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (v: boolean) => callRpc("set_inspection_required", { p_property_id: property!.id, p_required: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["setup", "properties"] }); toast.success("Inspection setting saved."); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <section className="mt-10 max-w-xl space-y-4" aria-labelledby="insp-title">
      <h2 id="insp-title" className="text-xl font-semibold">Housekeeping</h2>
      <div className="flex items-start gap-3">
        <Switch id="insp-required" checked={required} disabled={!canEdit || m.isPending} onCheckedChange={(v) => m.mutate(v)} />
        <div><Label htmlFor="insp-required">Rooms need inspection after cleaning</Label>
          <p className="text-sm text-muted-foreground">Off: when an attendant completes a room, it is clean straight away, with no supervisor check.</p></div>
      </div>
    </section>
  );
}

/** SET-009: "Allow ID photos" (off by default) and "Require ID photo at check-in" (only when allowed). */
function IdPhotoSettingsSection({ canEdit }: { canEdit: boolean }) {
  const { property } = useAccess();
  const qc = useQueryClient();
  const { data } = useIdPhotoSettings();
  const m = useMutation({
    mutationFn: (v: { allow: boolean; require: boolean }) =>
      callRpc<IdPhotoSettings>("set_id_photo_settings", { p_property_id: property!.id, p_allow: v.allow, p_require: v.require }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["id-photos"] }); toast.success("ID photo settings saved."); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!data) return null;
  return (
    <section className="mt-10 max-w-xl space-y-4" aria-labelledby="idp-title">
      <div>
        <h2 id="idp-title" className="text-xl font-semibold">ID photos</h2>
        <p className="mt-0.5 text-[15px] text-muted-foreground">
          Let staff keep a photo or scan of each guest's ID document. Photos are stored privately, only managers and front
          desk can see them, every view is recorded, and they are deleted {data.keep_months} months after the guest's last check-out.
        </p>
      </div>
      <div className="flex items-start gap-3">
        <Switch id="idp-allow" checked={data.allow} disabled={!canEdit || m.isPending}
          onCheckedChange={(v) => m.mutate({ allow: v, require: v ? data.require : false })} />
        <div><Label htmlFor="idp-allow">Allow ID photos</Label>
          <p className="text-sm text-muted-foreground">Off: nobody can add or open ID photos at this property.</p></div>
      </div>
      <div className="flex items-start gap-3">
        <Switch id="idp-require" checked={data.allow && data.require} disabled={!canEdit || !data.allow || m.isPending}
          onCheckedChange={(v) => m.mutate({ allow: data.allow, require: v })} />
        <div><Label htmlFor="idp-require">Require ID photo at check-in</Label>
          <p className="text-sm text-muted-foreground">Check-in and walk-in wait until the guest has an ID photo. Works only when ID photos are allowed.</p></div>
      </div>
    </section>
  );
}
