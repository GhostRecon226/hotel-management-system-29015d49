import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAccess } from "@/lib/access";
import { Field } from "@/lib/setup";
import { formatDate, fullName, useGuest, useGuestMutation, useGuestSearch, type GuestDetail } from "@/lib/guests";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/_app/guests/merge")({ component: MergeGuests });

function Picker({ label, value, onChange, exclude }: { label: string; value: string | null; onChange: (id: string | null) => void; exclude: string | null }) {
  const [q, setQ] = useState("");
  const { data = [] } = useGuestSearch(q, 8);
  const { data: picked } = useGuest(value);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{label}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {value && picked ? (
          <div className="space-y-1 text-sm">
            <div className="font-medium">{fullName(picked.guest)}</div>
            <div>{picked.guest.phone || "No phone"} · {picked.guest.email || "No email"}</div>
            <div className="text-muted-foreground">Added {formatDate(picked.guest.created_at)} · {picked.documents.length} documents · {picked.feedback.length} feedback</div>
            <Button size="sm" variant="outline" onClick={() => onChange(null)}>Change</Button>
          </div>
        ) : (
          <>
            <Input placeholder="Search name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
              {data.filter((g) => g.id !== exclude && !g.anonymised_at).map((g) => (
                <button key={g.id} type="button" className="block min-h-12 w-full px-3 py-2.5 text-left text-[15px] hover:bg-primary-soft" onClick={() => onChange(g.id)}>
                  <div className="font-medium">{fullName(g)}</div>
                  <div className="text-muted-foreground">{g.phone || "—"} · {g.email || "—"}</div>
                </button>
              ))}
              {data.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">No guests found.</p>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Preview({ keep, remove }: { keep: GuestDetail; remove: GuestDetail }) {
  const fields = [["Name", fullName(keep.guest), fullName(remove.guest)], ["Phone", keep.guest.phone, remove.guest.phone],
    ["Email", keep.guest.email, remove.guest.email], ["Nationality", keep.guest.nationality, remove.guest.nationality],
    ["Address", keep.guest.address, remove.guest.address]] as const;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Preview</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <table className="w-full">
          <thead><tr className="text-left text-muted-foreground"><th className="py-1 font-normal" /><th className="py-1 font-normal"><Badge variant="success">Kept</Badge></th><th className="py-1 font-normal"><Badge variant="danger">Removed</Badge></th></tr></thead>
          <tbody>
            {fields.map(([l, a, b]) => (
              <tr key={l} className="border-t"><td className="py-2.5 text-muted-foreground">{l}</td><td className="py-2.5 font-medium">{a || "—"}</td><td className="py-2.5 text-muted-foreground line-through">{b || "—"}</td></tr>
            ))}
          </tbody>
        </table>
        <p>After merging, <strong>{fullName(keep.guest)}</strong> will have {keep.documents.length + remove.documents.length} documents
          and {keep.feedback.length + remove.feedback.length} feedback entries. The removed profile's details are not copied; it is marked as merged.</p>
      </CardContent>
    </Card>
  );
}

function MergeGuests() {
  const { can } = useAccess();
  const navigate = useNavigate();
  const [keep, setKeep] = useState<string | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const { data: k } = useGuest(keep);
  const { data: r } = useGuest(remove);
  const merge = useGuestMutation("merge_guests", "Guests merged.");
  if (!can("guest.merge")) return <p className="text-sm text-muted-foreground">You do not have permission to merge guests.</p>;

  return (
    <div className="space-y-4">
      <Link to="/guests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All guests</Link>
      <PageHeader title="Merge duplicate guests" description="Choose the profile to keep and the duplicate to remove." className="mb-2" />
      <div className="grid gap-4 md:grid-cols-2">
        <Picker label="Keep this guest" value={keep} onChange={setKeep} exclude={remove} />
        <Picker label="Remove this duplicate" value={remove} onChange={setRemove} exclude={keep} />
      </div>
      {k && r && keep && remove && (
        <>
          <Preview keep={k} remove={r} />
          <Field label="Reason" htmlFor="m-reason"><Textarea id="m-reason" rows={2} placeholder="e.g. Same guest registered twice" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field>
          <Button size="lg" disabled={!reason.trim() || merge.isPending}
            onClick={() => merge.mutate({ p_keep: keep, p_remove: remove, p_reason: reason }, { onSuccess: () => navigate({ to: "/guests/$id", params: { id: keep } }) })}>
            {merge.isPending ? "Merging…" : "Merge guests"}
          </Button>
        </>
      )}
    </div>
  );
}
