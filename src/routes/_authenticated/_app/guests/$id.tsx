import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAccess } from "@/lib/access";
import { Field, FormDialog } from "@/lib/setup";
import {
  DOC_TYPES, FEEDBACK_CATEGORIES, FEEDBACK_STATUS, formatDate, fullName, GuestFormDialog, useGuest, useGuestMutation,
  type GuestDocument,
} from "@/lib/guests";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { formatDay, ResStatusBadge } from "@/lib/reservations";
import { Money } from "@/components/ui/money";

interface StayRow { id: string; number: string; property_name: string; arrival_date: string; departure_date: string; status: string; total_amount: number; currency: string }

export const Route = createFileRoute("/_authenticated/_app/guests/$id")({ component: GuestProfile });

const FEEDBACK_TONE: Record<string, "warning" | "info" | "success" | "neutral"> = { open: "warning", in_progress: "info", resolved: "success", closed: "neutral" };

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3 border-b border-border/70 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap font-medium">{value || "—"}</dd>
    </div>
  );
}

function GuestProfile() {
  const { id } = Route.useParams();
  const { can } = useAccess();
  const navigate = useNavigate();
  const { data, isLoading, error } = useGuest(id);
  const [edit, setEdit] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [doc, setDoc] = useState({ id: null as string | null, doc_type: "national_id", doc_number: "", expiry: "" });
  const [fbOpen, setFbOpen] = useState(false);
  const [fb, setFb] = useState({ category: "compliment", text: "" });
  const [anonOpen, setAnonOpen] = useState(false);
  const [anon, setAnon] = useState({ reason: "", confirm: "" });

  const saveDoc = useGuestMutation("save_guest_document", "Document saved.");
  const removeDoc = useGuestMutation("remove_guest_document", "Document removed.");
  const addFb = useGuestMutation("add_guest_feedback", "Feedback added.");
  const setFbStatus = useGuestMutation("set_guest_feedback_status", "Status updated.");
  const anonymise = useGuestMutation("anonymise_guest", "Guest anonymised.");

  if (isLoading) return <LoadingState label="Loading guest…" />;
  if (error || !data) return <EmptyState title="Guest not found" description="This guest may have been removed." action={<Button variant="outline" asChild><Link to="/guests">All guests</Link></Button>} />;
  const g = data.guest;
  const locked = g.status === "merged" || !!g.anonymised_at;
  const canEdit = can("guest.edit") && !locked;

  const openDoc = (d?: GuestDocument) => {
    setDoc(d ? { id: d.id, doc_type: d.doc_type, doc_number: d.doc_number ?? "", expiry: d.expiry ?? "" }
      : { id: null, doc_type: "national_id", doc_number: "", expiry: "" });
    setDocOpen(true);
  };
  const confirmWord = "ANONYMISE";

  return (
    <div>
      <Link to="/guests" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All guests
      </Link>
      <PageHeader title={<span className="inline-flex items-center gap-3"><span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-fill text-base font-bold text-primary-foreground">{fullName(g).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("")}</span>{fullName(g)}</span>} description={<span className="inline-flex flex-wrap items-center gap-2">Guest since {formatDate(g.created_at)}
          {g.status === "merged" && <Badge variant="neutral">Merged</Badge>}
          {g.anonymised_at && <Badge variant="neutral">Anonymised</Badge>}</span>}
        actions={<>
          {canEdit && <Button variant="outline" onClick={() => setEdit(true)}>Edit</Button>}
          {can("guest.anonymise") && !locked && (
            <Button variant="destructive" onClick={() => { setAnon({ reason: "", confirm: "" }); setAnonOpen(true); }}>Anonymise</Button>
          )}
        </>} />

      {g.status === "merged" && g.merged_into && (
        <p className="mb-4 rounded-xl border border-info/30 bg-info-soft px-4 py-2.5 text-sm text-info-strong">
          This profile was merged. <Link className="underline" to="/guests/$id" params={{ id: g.merged_into }}>Open the kept profile</Link>.
        </p>
      )}
      {g.anonymised_at && (
        <p className="mb-4 rounded-xl border border-info/30 bg-info-soft px-4 py-2.5 text-sm text-info-strong">
          Personal details were removed on {formatDate(g.anonymised_at)}. Stay history is kept.
        </p>
      )}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="documents">Documents ({data.documents.length})</TabsTrigger>
          <TabsTrigger value="stays">Stay history</TabsTrigger>
          <TabsTrigger value="feedback">Feedback ({data.feedback.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card><CardContent className="pt-6">
            <dl className="grid gap-x-10 md:grid-cols-2">
              <Row label="First name" value={g.first_name} /><Row label="Last name" value={g.last_name} />
              <Row label="Phone" value={g.phone} /><Row label="Email" value={g.email} />
              <Row label="Nationality" value={g.nationality} /><Row label="Address" value={g.address} />
              <Row label="Notes" value={g.notes} />
            </dl>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">ID documents</CardTitle>
              {canEdit && data.can_view_documents && <Button size="sm" onClick={() => openDoc()}>Add document</Button>}
            </CardHeader>
            <CardContent>
              {!data.can_view_documents && (
                <p className="mb-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-strong">Document numbers are hidden. You need permission to see ID numbers.</p>
              )}
              <Table>
                <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Number</TableHead><TableHead>Expiry</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {data.documents.length === 0 && <TableStateRow colSpan={4} title="No documents." />}
                  {data.documents.map((d) => {
                    const expired = d.expiry && d.expiry < new Date().toISOString().slice(0, 10);
                    return (
                      <TableRow key={d.id}>
                        <TableCell>{DOC_TYPES[d.doc_type]}</TableCell>
                        <TableCell className="font-mono">{d.doc_number ?? d.doc_number_masked}</TableCell>
                        <TableCell>{formatDate(d.expiry)}{expired && <Badge variant="danger" className="ml-2">Expired</Badge>}</TableCell>
                        <TableCell className="text-right">
                          {canEdit && data.can_view_documents && (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => openDoc(d)}>Edit</Button>
                              <Button size="sm" variant="outline" disabled={removeDoc.isPending}
                                onClick={() => { if (window.confirm("Remove this document?")) removeDoc.mutate({ p_id: d.id }); }}>Remove</Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stays">
          <Card><CardContent className="pt-6">
            {(data.stays as StayRow[]).length === 0 ? <EmptyState title="No stays yet" description="Bookings for this guest will appear here." /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Booking</TableHead><TableHead>Property</TableHead><TableHead>Arrival</TableHead><TableHead>Departure</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data.stays as StayRow[]).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell><Link className="text-primary-strong hover:underline" to="/reservations/$id" params={{ id: s.id }}>{s.number}</Link></TableCell>
                      <TableCell>{s.property_name}</TableCell>
                      <TableCell className="tabular">{formatDay(s.arrival_date)}</TableCell>
                      <TableCell className="tabular">{formatDay(s.departure_date)}</TableCell>
                      <TableCell><ResStatusBadge status={s.status} /></TableCell>
                      <TableCell><Money amount={s.total_amount} currency={s.currency} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="feedback">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Feedback</CardTitle>
              {canEdit && <Button size="sm" onClick={() => { setFb({ category: "compliment", text: "" }); setFbOpen(true); }}>Add feedback</Button>}
            </CardHeader>
            <CardContent className="space-y-3">
              {data.feedback.length === 0 && <EmptyState title="No feedback" description="Compliments, complaints and requests from this guest will appear here." />}
              {data.feedback.map((f) => (
                <div key={f.id} className="rounded-md border p-3">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium"><Badge variant={f.category === "complaint" ? "danger" : f.category === "compliment" ? "success" : "info"}>{FEEDBACK_CATEGORIES[f.category]}</Badge> <span className="font-normal text-muted-foreground">{formatDate(f.created_at)}</span></span>
                    {canEdit ? (
                      <Select value={f.status} onValueChange={(v) => setFbStatus.mutate({ p_id: f.id, p_status: v })}>
                        <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(FEEDBACK_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <Badge variant={FEEDBACK_TONE[f.status]} dot>{FEEDBACK_STATUS[f.status]}</Badge>}
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{f.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <GuestFormDialog open={edit} onOpenChange={setEdit} guest={g} />

      <FormDialog open={docOpen} onOpenChange={setDocOpen} title={doc.id ? "Edit document" : "Add document"} busy={saveDoc.isPending}
        onSubmit={() => saveDoc.mutate({ p_id: doc.id, p_guest_id: g.id, p_doc_type: doc.doc_type, p_doc_number: doc.doc_number,
          p_expiry: doc.expiry || null }, { onSuccess: () => setDocOpen(false) })}>
        <Field label="Type" htmlFor="d-type">
          <Select value={doc.doc_type} onValueChange={(v) => setDoc({ ...doc, doc_type: v })}>
            <SelectTrigger id="d-type"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(DOC_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Number" htmlFor="d-no"><Input id="d-no" value={doc.doc_number} onChange={(e) => setDoc({ ...doc, doc_number: e.target.value })} required maxLength={50} /></Field>
        <Field label="Expiry" htmlFor="d-ex"><Input id="d-ex" type="date" value={doc.expiry} onChange={(e) => setDoc({ ...doc, expiry: e.target.value })} /></Field>
      </FormDialog>

      <FormDialog open={fbOpen} onOpenChange={setFbOpen} title="Add feedback" busy={addFb.isPending}
        onSubmit={() => addFb.mutate({ p_guest_id: g.id, p_category: fb.category, p_text: fb.text }, { onSuccess: () => setFbOpen(false) })}>
        <Field label="Category" htmlFor="f-cat">
          <Select value={fb.category} onValueChange={(v) => setFb({ ...fb, category: v })}>
            <SelectTrigger id="f-cat"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(FEEDBACK_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Feedback" htmlFor="f-text"><Textarea id="f-text" rows={4} value={fb.text} onChange={(e) => setFb({ ...fb, text: e.target.value })} required maxLength={2000} /></Field>
      </FormDialog>

      <AlertDialog open={anonOpen} onOpenChange={setAnonOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anonymise {fullName(g)}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the name, phone, email, nationality, address, notes, ID documents and feedback text.
              Stay history is kept. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <Field label="Reason" htmlFor="a-reason"><Textarea id="a-reason" rows={2} placeholder="e.g. Guest asked for their data to be deleted" value={anon.reason} onChange={(e) => setAnon({ ...anon, reason: e.target.value })} maxLength={500} /></Field>
            <Field label={`Type ${confirmWord} to confirm`} htmlFor="a-confirm"><Input id="a-confirm" value={anon.confirm} onChange={(e) => setAnon({ ...anon, confirm: e.target.value })} autoComplete="off" /></Field>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={anon.confirm !== confirmWord || !anon.reason.trim() || anonymise.isPending}
              onClick={() => anonymise.mutate({ p_guest: g.id, p_reason: anon.reason }, { onSuccess: () => { setAnonOpen(false); navigate({ to: "/guests/$id", params: { id: g.id } }); } })}>
              {anonymise.isPending ? "Anonymising…" : "Anonymise guest"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
