import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAccess } from "@/lib/access";
import { NoAccess, Field, FormDialog, SectionHeader, useSetupList, useSetupMutation } from "@/lib/setup";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/setup/exchange-rates")({ component: ExchangeRates });

interface Rate { id: string; currency: string; rate_date: string; rate: number; updated_at: string }

function ExchangeRates() {
  const { property, can } = useAccess();
  const { data = [] } = useSetupList<Rate>("exchange_rates", "rate_date");
  const save = useSetupMutation("set_exchange_rate", ["exchange_rates"]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ currency: "USD", rate_date: property?.business_date ?? "", rate: "" });
  if (!can("setup.rate.manage")) return <NoAccess />;
  const base = property?.base_currency ?? "NGN";
  const rows = [...data].sort((a, b) => b.rate_date.localeCompare(a.rate_date) || a.currency.localeCompare(b.currency));

  return (
    <div>
      <SectionHeader title="Exchange rates" description={`How many ${base} one unit of a foreign currency is worth on a given day. Saving the same currency and date again replaces the rate.`}
        action={<Button onClick={() => { setF({ currency: "USD", rate_date: property?.business_date ?? "", rate: "" }); setOpen(true); }}>Set rate</Button>} />
      <Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Currency</TableHead><TableHead className="text-right">Rate ({base} per 1)</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">No exchange rates yet.</TableCell></TableRow>}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.rate_date}</TableCell><TableCell className="font-medium">{r.currency}</TableCell>
              <TableCell className="text-right tabular-nums">{Number(r.rate).toLocaleString("en-NG", { maximumFractionDigits: 8 })}</TableCell>
              <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => { setF({ currency: r.currency, rate_date: r.rate_date, rate: String(r.rate) }); setOpen(true); }}>Change</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <FormDialog open={open} onOpenChange={setOpen} title="Set exchange rate" busy={save.isPending}
        onSubmit={() => save.mutate({ p_property_id: property!.id, p_currency: f.currency, p_rate_date: f.rate_date, p_rate: f.rate },
          { onSuccess: () => setOpen(false) })}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Currency" htmlFor="x-cur"><Input id="x-cur" maxLength={3} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} required /></Field>
          <Field label="Date" htmlFor="x-date"><Input id="x-date" type="date" value={f.rate_date} onChange={(e) => setF({ ...f, rate_date: e.target.value })} required /></Field>
          <Field label={`${base} per 1`} htmlFor="x-rate"><Input id="x-rate" type="number" min={0} step="0.00000001" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} required /></Field>
        </div>
      </FormDialog>
    </div>
  );
}
