import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmptyState, LoadingState, TableSkeletonRows } from "@/components/ui/states";
import { Money } from "@/components/ui/money";
import { PageHeader, FilterBar } from "@/components/page-header";

export const Route = createFileRoute("/design")({
  head: () => ({
    meta: [
      { title: "Design system — Hotel Desk" },
      { name: "description", content: "Colours, type, buttons, fields, tables and status labels used across Hotel Desk." },
      { property: "og:title", content: "Design system — Hotel Desk" },
      { property: "og:description", content: "Colours, type, buttons, fields, tables and status labels used across Hotel Desk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DesignPage,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="border-b pb-2 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ name, cls, note }: { name: string; cls: string; note?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className={`h-16 ${cls}`} />
      <div className="p-3 text-sm"><div className="font-medium">{name}</div>{note && <div className="text-muted-foreground">{note}</div>}</div>
    </div>
  );
}

const STATUSES = [
  { tone: "success", label: "Green", uses: ["Clean", "Ready", "Paid"] },
  { tone: "warning", label: "Amber", uses: ["Pending", "Dirty"] },
  { tone: "danger", label: "Red", uses: ["Out of order", "Overdue", "Error"] },
  { tone: "info", label: "Blue", uses: ["In house", "Info"] },
  { tone: "neutral", label: "Grey", uses: ["Inactive", "Closed"] },
] as const;

const ROWS = [
  { room: "101", type: "Standard", guest: "Adaeze Okafor", status: ["In house", "info"], hk: ["Clean", "success"], balance: 45000 },
  { room: "102", type: "Standard", guest: "—", status: ["Ready", "success"], hk: ["Clean", "success"], balance: 0 },
  { room: "103", type: "Deluxe", guest: "Tunde Bello", status: ["Pending", "warning"], hk: ["Dirty", "warning"], balance: 128500.5 },
  { room: "104", type: "Deluxe", guest: "—", status: ["Out of order", "danger"], hk: ["Out of order", "danger"], balance: 0 },
  { room: "201", type: "Suite", guest: "Kwame Mensah", status: ["Overdue", "danger"], hk: ["Clean", "success"], balance: -12000 },
] as const;

function DesignPage() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-8">
      <PageHeader title="Design system" description="Every shared component and status colour. New screens must use only these." />

      <Section title="Colours">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Swatch name="Brand teal" cls="bg-primary" note="Main actions" />
          <Swatch name="Teal, soft" cls="bg-primary-soft" note="Highlights" />
          <Swatch name="Sidebar" cls="bg-sidebar" note="Menu" />
          <Swatch name="Background" cls="bg-background" />
          <Swatch name="Surface" cls="bg-surface" note="Table headers" />
          <Swatch name="Card" cls="bg-card" />
          <Swatch name="Border" cls="bg-border" />
          <Swatch name="Muted text" cls="bg-muted-foreground" />
          <Swatch name="Text" cls="bg-foreground" />
        </div>
      </Section>

      <Section title="Status colours">
        <p className="text-[15px] text-muted-foreground">Always use the same colour for the same meaning.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STATUSES.map((s) => (
            <Card key={s.tone}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{s.label}</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {s.uses.map((u) => <Badge key={u} variant={s.tone} dot>{u}</Badge>)}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <p className="rounded-md border border-success/30 bg-success-soft px-4 py-3 text-[15px] text-success-strong">Payment recorded. The bill is paid.</p>
          <p className="rounded-md border border-warning/40 bg-warning-soft px-4 py-3 text-[15px] text-warning-strong">Room 103 is dirty and waiting for housekeeping.</p>
          <p className="rounded-md border border-destructive/30 bg-danger-soft px-4 py-3 text-[15px] text-danger-strong">This bill is overdue by 3 days.</p>
          <p className="rounded-md border border-info/30 bg-info-soft px-4 py-3 text-[15px] text-info-strong">4 guests are in house tonight.</p>
        </div>
      </Section>

      <Section title="Typography">
        <div className="space-y-3">
          <p className="text-[28px] font-semibold">Page title — 28px semibold</p>
          <p className="text-xl font-semibold">Section title — 20px semibold</p>
          <p className="text-base font-medium">Card title — 16px medium</p>
          <p className="text-[15px]">Body and table text — 15px regular. IBM Plex Sans, readable at arm's length.</p>
          <p className="text-sm text-muted-foreground">Help text — 14px muted</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Table header — 12px caps</p>
        </div>
      </Section>

      <Section title="Amounts">
        <div className="max-w-xs space-y-1 rounded-lg border bg-card p-4 text-[15px]">
          <div className="flex justify-between"><span>Room, 2 nights</span><Money amount={90000} /></div>
          <div className="flex justify-between"><span>Service charge</span><Money amount={9000} /></div>
          <div className="flex justify-between"><span>VAT</span><Money amount={7425} /></div>
          <div className="flex justify-between"><span>Discount</span><Money amount={-5000} /></div>
          <div className="flex justify-between border-t pt-2 font-semibold"><span>Total</span><Money amount={101425} /></div>
        </div>
        <p className="text-sm text-muted-foreground">Right-aligned, with the currency sign. Naira uses ₦. Negative amounts show in red.</p>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Check in</Button>
          <Button variant="outline">Edit</Button>
          <Button variant="secondary">Print</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Cancel booking</Button>
          <Button variant="link">View details</Button>
          <Button disabled>Saving…</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button><Button>Default (44px)</Button><Button size="lg">Large (48px)</Button>
          <Button size="icon" variant="outline" aria-label="Search"><Search /></Button>
        </div>
      </Section>

      <Section title="Form fields">
        <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="d-name">Guest name</Label><Input id="d-name" placeholder="Adaeze Okafor" /></div>
          <div className="space-y-1.5"><Label htmlFor="d-phone">Phone</Label><Input id="d-phone" type="tel" placeholder="0803 123 4567" />
            <p className="text-sm text-muted-foreground">We use this to contact the guest.</p></div>
          <div className="space-y-1.5"><Label htmlFor="d-type">Room type</Label>
            <Select defaultValue="std"><SelectTrigger id="d-type"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="std">Standard</SelectItem><SelectItem value="dlx">Deluxe</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="d-err">Email</Label><Input id="d-err" aria-invalid defaultValue="adaeze@" />
            <p className="text-sm text-destructive">Enter a valid email address.</p></div>
          <div className="space-y-1.5"><Label htmlFor="d-dis">Room number</Label><Input id="d-dis" disabled defaultValue="101" /></div>
          <label className="flex items-center gap-3 text-[15px]"><Switch defaultChecked /> Active</label>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="d-notes">Notes</Label><Textarea id="d-notes" rows={3} placeholder="Prefers a quiet room." /></div>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="a"><TabsList><TabsTrigger value="a">Details</TabsTrigger><TabsTrigger value="b">Documents</TabsTrigger><TabsTrigger value="c">Stay history</TabsTrigger></TabsList>
          <TabsContent value="a" className="text-[15px] text-muted-foreground">Tab content.</TabsContent>
          <TabsContent value="b" className="text-[15px] text-muted-foreground">Documents.</TabsContent>
          <TabsContent value="c" className="text-[15px] text-muted-foreground">Stays.</TabsContent></Tabs>
      </Section>

      <Section title="Table with filters">
        <FilterBar>
          <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" placeholder="Search by room or guest" /></div>
          <Select defaultValue="all"><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All rooms</SelectItem><SelectItem value="dirty">Dirty</SelectItem></SelectContent></Select>
        </FilterBar>
        <div className="max-h-72 overflow-auto rounded-lg">
          <Table>
            <TableHeader><TableRow><TableHead>Room</TableHead><TableHead>Type</TableHead><TableHead>Guest</TableHead><TableHead>Status</TableHead><TableHead>Housekeeping</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
            <TableBody>
              {[...ROWS, ...ROWS].map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.room}</TableCell><TableCell>{r.type}</TableCell><TableCell>{r.guest}</TableCell>
                  <TableCell><Badge variant={r.status[1]} dot>{r.status[0]}</Badge></TableCell>
                  <TableCell><Badge variant={r.hk[1]} dot>{r.hk[0]}</Badge></TableCell>
                  <TableCell><Money amount={r.balance} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-sm text-muted-foreground">Scroll the table: the header stays in place.</p>
      </Section>

      <Section title="Empty and loading states">
        <div className="grid gap-4 md:grid-cols-3">
          <Card><EmptyState title="No guests yet" description="Guests you add will appear here." action={<Button size="sm">New guest</Button>} /></Card>
          <Card><LoadingState label="Loading rooms…" /></Card>
          <Table><TableBody><TableSkeletonRows rows={3} cols={3} /></TableBody></Table>
        </div>
      </Section>

      <Section title="Dialog">
        <Button variant="outline" onClick={() => setOpen(true)}>Open dialog</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Check in guest</DialogTitle><DialogDescription>Confirm the room before checking in.</DialogDescription></DialogHeader>
            <div className="space-y-1.5"><Label htmlFor="dd-room">Room</Label><Input id="dd-room" defaultValue="101" /></div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => setOpen(false)}>Check in</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>
    </div>
  );
}
