import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useAccess } from "@/lib/access";
import { Field, FormDialog, SectionHeader, StatusText, useSetupList, useSetupMutation } from "@/lib/setup";
import { NoAccess } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/setup/charges")({ component: Charges });

interface Tax { id: string; code: string; name: string; percent: number; sort_order: number; compounds_on_previous: boolean; description: string | null; is_active: boolean }
interface Charge { id: string; code: string; name: string; category: string; is_taxable: boolean; is_active: boolean }
interface Method { id: string; code: string; name: string; kind: string; is_active: boolean }

const CATEGORIES = ["room", "food", "service", "tax", "other"];
const KINDS: Record<string, string> = { cash: "Cash", card: "Card", transfer: "Bank transfer", pos: "POS", other: "Other" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Charges() {
  const { can } = useAccess();
  if (!can("setup.tax.manage")) return <NoAccess />;
  return (
    <div className="space-y-10">
      <div className="flex gap-3 rounded-md border border-warning bg-warning/20 p-4 text-sm" role="note">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <strong>Confirm these rates with your accountant.</strong> The default tax rates (service charge 10%, VAT 7.5% on price plus
          service charge, state levy 0%) are starting points only and have not been verified for your state or business.
        </div>
      </div>
      <Taxes />
      <ChargeCodes />
      <PaymentMethods />
    </div>
  );
}

function Taxes() {
  const { property } = useAccess();
  const { data = [] } = useSetupList<Tax>("tax_rates", "sort_order");
  const save = useSetupMutation("save_tax_rate", ["tax_rates"]);
  const [open, setOpen] = useState(false);
  const empty = { id: null as string | null, code: "", name: "", percent: "", sort_order: String(data.length + 1), compounds: false, description: "", is_active: true };
  const [f, setF] = useState(empty);
  const edit = (t?: Tax) => {
    setF(t ? { id: t.id, code: t.code, name: t.name, percent: String(t.percent), sort_order: String(t.sort_order), compounds: t.compounds_on_previous, description: t.description ?? "", is_active: t.is_active } : empty);
    setOpen(true);
  };
  return (
    <section>
      <SectionHeader title="Tax rates" description="Applied in order. A tax that compounds is calculated on the price plus the taxes before it."
        action={<Button onClick={() => edit()}>Add tax</Button>} />
      <Table>
        <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Percent</TableHead><TableHead>Calculated on</TableHead><TableHead>Note</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground">No taxes set up.</TableCell></TableRow>}
          {data.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.sort_order}</TableCell><TableCell className="font-medium">{t.code}</TableCell><TableCell>{t.name}</TableCell>
              <TableCell className="text-right tabular-nums">{Number(t.percent)}%</TableCell>
              <TableCell>{t.compounds_on_previous ? "Price + earlier taxes" : "Price"}</TableCell>
              <TableCell className="max-w-64 text-xs text-muted-foreground">{t.description}</TableCell>
              <TableCell><StatusText active={t.is_active} /></TableCell>
              <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => edit(t)}>Edit</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <FormDialog open={open} onOpenChange={setOpen} title={f.id ? "Edit tax" : "Add tax"} busy={save.isPending}
        onSubmit={() => save.mutate({ p_property_id: property!.id, p_id: f.id, p_code: f.code, p_name: f.name, p_percent: f.percent,
          p_sort_order: Number(f.sort_order), p_compounds_on_previous: f.compounds, p_description: f.description, p_is_active: f.is_active },
          { onSuccess: () => setOpen(false) })}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="t-code"><Input id="t-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required /></Field>
          <Field label="Name" htmlFor="t-name"><Input id="t-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
          <Field label="Percent" htmlFor="t-pct"><Input id="t-pct" type="number" min={0} max={100} step="0.0001" value={f.percent} onChange={(e) => setF({ ...f, percent: e.target.value })} required /></Field>
          <Field label="Order" htmlFor="t-ord"><Input id="t-ord" type="number" min={1} value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} /></Field>
        </div>
        <Field label="Note" htmlFor="t-desc"><Input id="t-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.compounds} onCheckedChange={(v) => setF({ ...f, compounds: v })} /> Calculate on price plus earlier taxes</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} /> Active</label>
      </FormDialog>
    </section>
  );
}

function ChargeCodes() {
  const { property } = useAccess();
  const { data = [] } = useSetupList<Charge>("charge_codes", "code");
  const save = useSetupMutation("save_charge_code", ["charge_codes"]);
  const [open, setOpen] = useState(false);
  const empty = { id: null as string | null, code: "", name: "", category: "other", is_taxable: true, is_active: true };
  const [f, setF] = useState(empty);
  const edit = (c?: Charge) => { setF(c ? { ...c } : empty); setOpen(true); };
  return (
    <section>
      <SectionHeader title="Charge codes" description="What can be posted to a guest's bill." action={<Button onClick={() => edit()}>Add charge code</Button>} />
      <Table>
        <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Taxable</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {data.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.code}</TableCell><TableCell>{c.name}</TableCell><TableCell>{cap(c.category)}</TableCell>
              <TableCell>{c.is_taxable ? "Yes" : "No"}</TableCell><TableCell><StatusText active={c.is_active} /></TableCell>
              <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => edit(c)}>Edit</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <FormDialog open={open} onOpenChange={setOpen} title={f.id ? "Edit charge code" : "Add charge code"} busy={save.isPending}
        onSubmit={() => save.mutate({ p_property_id: property!.id, p_id: f.id, p_code: f.code, p_name: f.name, p_category: f.category,
          p_is_taxable: f.is_taxable, p_is_active: f.is_active }, { onSuccess: () => setOpen(false) })}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="c-code"><Input id="c-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required /></Field>
          <Field label="Name" htmlFor="c-name"><Input id="c-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        </div>
        <Field label="Category" htmlFor="c-cat">
          <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
            <SelectTrigger id="c-cat"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{cap(c)}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.is_taxable} onCheckedChange={(v) => setF({ ...f, is_taxable: v })} /> Taxable</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} /> Active</label>
      </FormDialog>
    </section>
  );
}

function PaymentMethods() {
  const { property } = useAccess();
  const { data = [] } = useSetupList<Method>("payment_methods", "code");
  const save = useSetupMutation("save_payment_method", ["payment_methods"]);
  const [open, setOpen] = useState(false);
  const empty = { id: null as string | null, code: "", name: "", kind: "cash", is_active: true };
  const [f, setF] = useState(empty);
  const edit = (m?: Method) => { setF(m ? { ...m } : empty); setOpen(true); };
  return (
    <section>
      <SectionHeader title="Payment methods" description="Ways guests pay. Payments are recorded, not processed." action={<Button onClick={() => edit()}>Add payment method</Button>} />
      <Table>
        <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Kind</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {data.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.code}</TableCell><TableCell>{m.name}</TableCell><TableCell>{KINDS[m.kind]}</TableCell>
              <TableCell><StatusText active={m.is_active} /></TableCell>
              <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => edit(m)}>Edit</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <FormDialog open={open} onOpenChange={setOpen} title={f.id ? "Edit payment method" : "Add payment method"} busy={save.isPending}
        onSubmit={() => save.mutate({ p_property_id: property!.id, p_id: f.id, p_code: f.code, p_name: f.name, p_kind: f.kind, p_is_active: f.is_active },
          { onSuccess: () => setOpen(false) })}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="m-code"><Input id="m-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required /></Field>
          <Field label="Name" htmlFor="m-name"><Input id="m-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        </div>
        <Field label="Kind" htmlFor="m-kind">
          <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
            <SelectTrigger id="m-kind"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(KINDS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} /> Active</label>
      </FormDialog>
    </section>
  );
}
