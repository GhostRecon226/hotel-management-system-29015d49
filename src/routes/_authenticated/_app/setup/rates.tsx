import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAccess } from "@/lib/access";
import { formatDay } from "@/lib/reservations";
import { NoAccess, Field, FormDialog, SectionHeader, StatusText, formatMoney, useSetupList, useSetupMutation } from "@/lib/setup";

import type { RoomType } from "./room-types";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/setup/rates")({ component: Rates });

type PolicyType = "none" | "nights" | "percent" | "amount";
interface RatePlan {
  id: string; code: string; name: string; is_corporate: boolean; is_active: boolean;
  cancellation_policy_type: PolicyType; cancellation_policy_value: number; cancellation_free_days: number;
  no_show_policy_type: PolicyType; no_show_policy_value: number;
  deposit_policy_type: PolicyType; deposit_policy_value: number;
}
interface Price {
  id: string; rate_plan_id: string; room_type_id: string; valid_from: string; valid_to: string; amount: number; currency: string;
}

const POLICY_LABEL: Record<PolicyType, string> = { none: "None", nights: "Nights", percent: "Percent", amount: "Amount" };
const describe = (t: PolicyType, v: number) =>
  t === "none" ? "None" : t === "nights" ? `${Number(v)} night${Number(v) === 1 ? "" : "s"}` : t === "percent" ? `${Number(v)}%` : formatMoney(v);

function PolicyField({ label, id, type, value, onChange }: {
  label: string; id: string; type: PolicyType; value: string; onChange: (t: PolicyType, v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label={`${label} type`} htmlFor={`${id}-t`}>
        <Select value={type} onValueChange={(t) => onChange(t as PolicyType, value)}>
          <SelectTrigger id={`${id}-t`}><SelectValue /></SelectTrigger>
          <SelectContent>{(Object.keys(POLICY_LABEL) as PolicyType[]).map((k) => <SelectItem key={k} value={k}>{POLICY_LABEL[k]}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Value" htmlFor={`${id}-v`}>
        <Input id={`${id}-v`} type="number" min={0} step="0.01" value={value} disabled={type === "none"} onChange={(e) => onChange(type, e.target.value)} />
      </Field>
    </div>
  );
}

const emptyPlan = {
  id: null as string | null, code: "", name: "", is_corporate: false, is_active: true,
  ct: "none" as PolicyType, cv: "0", nt: "none" as PolicyType, nv: "0", dt: "none" as PolicyType, dv: "0", fd: "2" };

function Rates() {
  const { property, can } = useAccess();
  const { data: plans = [] } = useSetupList<RatePlan>("rate_plans", "code");
  const { data: prices = [] } = useSetupList<Price>("rate_plan_prices", "valid_from");
  const { data: types = [] } = useSetupList<RoomType>("room_types", "code");
  const savePlan = useSetupMutation("save_rate_plan", ["rate_plans"]);
  const savePrice = useSetupMutation("save_rate_plan_price", ["rate_plan_prices"]);
  const delPrice = useSetupMutation("delete_rate_plan_price", ["rate_plan_prices"], () => "Price removed.");
  const [planOpen, setPlanOpen] = useState(false);
  const [p, setP] = useState(emptyPlan);
  const [priceOpen, setPriceOpen] = useState(false);
  const [pr, setPr] = useState({ id: null as string | null, rate_plan_id: "", room_type_id: "", valid_from: "", valid_to: "", amount: "", currency: "" });
  if (!can("setup.rate.manage")) return <NoAccess />;

  const base = property?.base_currency ?? "NGN";
  const editPlan = (r?: RatePlan) => {
    setP(r ? { id: r.id, code: r.code, name: r.name, is_corporate: r.is_corporate, is_active: r.is_active,
      ct: r.cancellation_policy_type, cv: String(r.cancellation_policy_value), nt: r.no_show_policy_type, nv: String(r.no_show_policy_value),
      dt: r.deposit_policy_type, dv: String(r.deposit_policy_value), fd: String(r.cancellation_free_days ?? 2) } : emptyPlan);
    setPlanOpen(true);
  };
  const editPrice = (planId: string, x?: Price) => {
    setPr(x ? { id: x.id, rate_plan_id: x.rate_plan_id, room_type_id: x.room_type_id, valid_from: x.valid_from, valid_to: x.valid_to, amount: String(x.amount), currency: x.currency }
      : { id: null, rate_plan_id: planId, room_type_id: "", valid_from: "", valid_to: "", amount: "", currency: base });
    setPriceOpen(true);
  };
  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? "";

  return (
    <div className="space-y-8">
      <SectionHeader title="Rate plans" description="Each plan has its own policies and prices per room type."
        action={<Button onClick={() => editPlan()}>Add rate plan</Button>} />
      {plans.length === 0 && <p className="text-sm text-muted-foreground">No rate plans yet.</p>}
      {plans.map((plan) => (
        <section key={plan.id} className="rounded-lg border">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
            <div>
              <div className="font-medium">{plan.code} — {plan.name} {plan.is_corporate && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs">Corporate</span>}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Cancellation: {describe(plan.cancellation_policy_type, plan.cancellation_policy_value)}{plan.cancellation_policy_type !== "none" && (plan.cancellation_free_days > 0 ? `, free up to ${plan.cancellation_free_days} day${plan.cancellation_free_days === 1 ? "" : "s"} before arrival` : ", always charged")} · No-show: {describe(plan.no_show_policy_type, plan.no_show_policy_value)} · Deposit: {describe(plan.deposit_policy_type, plan.deposit_policy_value)}
              </div>
              <StatusText active={plan.is_active} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => editPlan(plan)}>Edit plan</Button>
              <Button size="sm" onClick={() => editPrice(plan.id)} disabled={types.length === 0}>Add price</Button>
            </div>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Room type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead className="text-right">Price per night</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {prices.filter((x) => x.rate_plan_id === plan.id).map((x) => (
                <TableRow key={x.id}>
                  <TableCell>{typeName(x.room_type_id)}</TableCell><TableCell>{formatDay(x.valid_from)}</TableCell><TableCell>{formatDay(x.valid_to)}</TableCell>
                  <TableCell><Money amount={x.amount} currency={x.currency} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => editPrice(plan.id, x)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remove this price?")) delPrice.mutate({ p_id: x.id }); }}>Remove</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ))}

      <FormDialog open={planOpen} onOpenChange={setPlanOpen} title={p.id ? "Edit rate plan" : "Add rate plan"} busy={savePlan.isPending}
        onSubmit={() => savePlan.mutate({
          p_property_id: property!.id, p_id: p.id, p_code: p.code, p_name: p.name, p_is_corporate: p.is_corporate,
          p_cancellation_type: p.ct, p_cancellation_value: p.cv || "0", p_no_show_type: p.nt, p_no_show_value: p.nv || "0",
          p_deposit_type: p.dt, p_deposit_value: p.dv || "0", p_is_active: p.is_active,
          p_cancellation_free_days: p.ct === "none" ? 0 : Number(p.fd || 0),
        }, { onSuccess: () => setPlanOpen(false) })}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="rp-code"><Input id="rp-code" value={p.code} onChange={(e) => setP({ ...p, code: e.target.value })} required /></Field>
          <Field label="Name" htmlFor="rp-name"><Input id="rp-name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} required /></Field>
        </div>
        <PolicyField label="Cancellation" id="rp-c" type={p.ct} value={p.cv} onChange={(t, v) => setP({ ...p, ct: t, cv: v })} />
        {p.ct !== "none" && (
          <Field label="Free cancellation up to (days before arrival)" htmlFor="rp-fd"
            hint="Cancelling at least this many days before arrival costs nothing. 0 means the fee always applies.">
            <Input id="rp-fd" type="number" inputMode="numeric" min={0} step={1} value={p.fd} onChange={(e) => setP({ ...p, fd: e.target.value })} required />
          </Field>
        )}
        <PolicyField label="No-show" id="rp-n" type={p.nt} value={p.nv} onChange={(t, v) => setP({ ...p, nt: t, nv: v })} />
        <PolicyField label="Deposit" id="rp-d" type={p.dt} value={p.dv} onChange={(t, v) => setP({ ...p, dt: t, dv: v })} />
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm"><Switch checked={p.is_corporate} onCheckedChange={(v) => setP({ ...p, is_corporate: v })} /> Corporate</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={p.is_active} onCheckedChange={(v) => setP({ ...p, is_active: v })} /> Active</label>
        </div>
      </FormDialog>

      <FormDialog open={priceOpen} onOpenChange={setPriceOpen} title={pr.id ? "Edit price" : "Add price"} busy={savePrice.isPending}
        onSubmit={() => savePrice.mutate({
          p_id: pr.id, p_rate_plan_id: pr.rate_plan_id, p_room_type_id: pr.room_type_id || null,
          p_valid_from: pr.valid_from, p_valid_to: pr.valid_to, p_amount: pr.amount, p_currency: pr.currency,
        }, { onSuccess: () => setPriceOpen(false) })}>
        <Field label="Room type" htmlFor="pp-type">
          <Select value={pr.room_type_id} onValueChange={(v) => setPr({ ...pr, room_type_id: v })}>
            <SelectTrigger id="pp-type"><SelectValue placeholder="Choose room type" /></SelectTrigger>
            <SelectContent>{types.filter((t) => t.is_active).map((t) => <SelectItem key={t.id} value={t.id}>{t.code} — {t.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Valid from" htmlFor="pp-from"><Input id="pp-from" type="date" value={pr.valid_from} onChange={(e) => setPr({ ...pr, valid_from: e.target.value })} required /></Field>
          <Field label="Valid to" htmlFor="pp-to"><Input id="pp-to" type="date" value={pr.valid_to} onChange={(e) => setPr({ ...pr, valid_to: e.target.value })} required /></Field>
          <Field label="Price per night" htmlFor="pp-amt"><Input id="pp-amt" type="number" min={0} step="0.01" value={pr.amount} onChange={(e) => setPr({ ...pr, amount: e.target.value })} required /></Field>
          <Field label="Currency" htmlFor="pp-cur"><Input id="pp-cur" maxLength={3} value={pr.currency} onChange={(e) => setPr({ ...pr, currency: e.target.value.toUpperCase() })} /></Field>
        </div>
      </FormDialog>
    </div>
  );
}
