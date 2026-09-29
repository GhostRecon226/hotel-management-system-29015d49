import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAccess } from "@/lib/access";
import { Field, FormDialog } from "@/lib/setup";
import {
  DOC_TYPES, FEEDBACK_CATEGORIES, FEEDBACK_STATUS, formatDate, fullName, GuestFormDialog, useGuest, useGuestMutation,
  type GuestDocument,
} from "@/lib/guests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/_app/guests/$id")({ component: GuestProfile });

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 whitespace-pre-wrap">{value || "—"}</dd>
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

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error || !data) return <p className="text-sm text-muted-foreground">Guest not found.</p>;
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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{fullName(g)}</h1>
          <p className="text-sm text-muted-foreground">Guest since {formatDate(g.created_at)}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && <Button variant="outline" onClick={() => setEdit(true)}>Edit</Button>}
          {can("guest.anonymise") && !locked && (
            <Button variant="destructive" onClick={() => { setAnon({ reason: "", confirm: "" }); setAnonOpen(true); }}>Anonymise</Button>
          )}
        </div>
      </div>

      {g.status === "merged" && g.merged_into && (
        <p className="mb-4 rounded-md border bg-muted p-3 text-sm">
          This profile was merged. <Link className="underline" to="/guests/$id" params={{ id: g.merged_into }}>Open the kept profile</Link>.
        </p>
      )}
      {g.anonymised_at && (
        <p className="mb-4 rounded-md border bg-muted p-3 text-sm">
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
            <dl>
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
                <p className="mb-3 text-sm text-muted-foreground">Document numbers are hidden. You need permission to see ID numbers.</p>
              )}
              <Table>
                <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Number</TableHead><TableHead>Expiry</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {data.documents.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">No documents.</TableCell></TableRow>}
                  {data.documents.map((d) => {
                    const expired = d.expiry && d.expiry < new Date().toISOString().slice(0, 10);
                    return (
                      <TableRow key={d.id}>
                        <TableCell>{DOC_TYPES[d.doc_type]}</TableCell>
                        <TableCell className="font-mono">{d.doc_number ?? d.doc_number_masked}</TableCell>
                        <TableCell>{formatDate(d.expiry)}{expired && <span className="ml-2 text-xs text-destructive">Expired</span>}</TableCell>
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
            <p className="text-sm text-muted-foreground">No stays yet. Stays will appear here once reservations are in use.</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="feedback">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Feedback</CardTitle>
              {canEdit && <Button size="sm" onClick={() => { setFb({ category: "compliment", text: "" }); setFbOpen(true); }}>Add feedback</Button>}
            </CardHeader>
            <CardContent className="space-y-3">
              {data.feedback.length === 0 && <p className="text-sm text-muted-foreground">No feedback.</p>}
              {data.feedback.map((f) => (
                <div key={f.id} className="rounded-md border p-3">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{FEEDBACK_CATEGORIES[f.category]} · <span className="font-normal text-muted-foreground">{formatDate(f.created_at)}</span></span>
                    {canEdit ? (
                      <Select value={f.status} onValueChange={(v) => setFbStatus.mutate({ p_id: f.id, p_status: v })}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(FEEDBACK_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <span className="text-muted-foreground">{FEEDBACK_STATUS[f.status]}</span>}
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
