import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { callRpc, Field, FormDialog } from "@/lib/setup";
import { usePaged } from "@/lib/paging";
import { errorMessage } from "@/lib/errors";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface GuestRow {
  id: string; first_name: string; last_name: string; phone: string | null; email: string | null;
  nationality: string | null; anonymised_at: string | null; created_at: string;
}
export interface Guest extends GuestRow {
  address: string | null; notes: string | null; status: "active" | "merged"; merged_into: string | null; updated_at: string;
}
export interface GuestDocument { id: string; doc_type: string; expiry: string | null; doc_number: string | null; doc_number_masked: string }
export interface GuestFeedback { id: string; category: string; text: string; status: string; created_at: string }
export interface GuestDetail {
  guest: Guest; can_view_documents: boolean; documents: GuestDocument[]; feedback: GuestFeedback[];
  stays: unknown[];
}

export const DOC_TYPES: Record<string, string> = {
  passport: "Passport", national_id: "National ID (NIN)", drivers_licence: "Driver's licence",
  voters_card: "Voter's card", other: "Other",
};
export const FEEDBACK_CATEGORIES: Record<string, string> = {
  compliment: "Compliment", complaint: "Complaint", request: "Request", other: "Other",
};
export const FEEDBACK_STATUS: Record<string, string> = {
  open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed",
};

export const fullName = (g: { first_name: string; last_name: string }) => `${g.first_name} ${g.last_name}`.trim();
export const formatDate = (d: string | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d)) : "";

export function useGuestSearch(query: string, limit = 50) {
  const [q, setQ] = useState(query);
  useEffect(() => { const t = setTimeout(() => setQ(query), 250); return () => clearTimeout(t); }, [query]);
  return useQuery({
    queryKey: ["guests", "search", q, limit],
    queryFn: () => callRpc<GuestRow[]>("search_guests", { p_query: q, p_limit: limit }),
  });
}

/** The Guests screen: 50 at a time, with Load more. */
export function useGuestPages(query: string) {
  const [q, setQ] = useState(query);
  useEffect(() => { const t = setTimeout(() => setQ(query), 250); return () => clearTimeout(t); }, [query]);
  return usePaged<GuestRow>(["guests", "search", q], 50,
    (offset, limit) => callRpc<GuestRow[]>("search_guests", { p_query: q, p_limit: limit, p_offset: offset }));
}

export function useGuest(id: string | null) {
  return useQuery({
    queryKey: ["guests", "detail", id],
    enabled: !!id,
    queryFn: () => callRpc<GuestDetail>("get_guest", { p_id: id }),
  });
}

export function useGuestMutation(name: string, success = "Saved.") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) => callRpc<string | null>(name, args),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["guests"] }); toast.success(success); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

const EMPTY = { first_name: "", last_name: "", phone: "", email: "", nationality: "", address: "", notes: "" };

export function GuestFormDialog({ open, onOpenChange, guest, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; guest?: Guest | null; onSaved?: (id: string, name: string) => void;
}) {
  const save = useGuestMutation("save_guest", guest ? "Guest updated." : "Guest created.");
  const [f, setF] = useState(EMPTY);
  useEffect(() => {
    if (!open) return;
    setF(guest ? {
      first_name: guest.first_name, last_name: guest.last_name, phone: guest.phone ?? "", email: guest.email ?? "",
      nationality: guest.nationality ?? "", address: guest.address ?? "", notes: guest.notes ?? "",
    } : EMPTY);
  }, [open, guest]);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={guest ? "Edit guest" : "New guest"} busy={save.isPending}
      onSubmit={() => save.mutate({
        p_id: guest?.id ?? null, p_first_name: f.first_name, p_last_name: f.last_name, p_phone: f.phone,
        p_email: f.email, p_nationality: f.nationality, p_address: f.address, p_notes: f.notes,
      }, { onSuccess: (id) => { onOpenChange(false); if (id) onSaved?.(id, [f.first_name, f.last_name].map((x) => x.trim()).filter(Boolean).join(" ")); } })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="g-fn"><Input id="g-fn" value={f.first_name} onChange={set("first_name")} required maxLength={100} /></Field>
        <Field label="Last name" htmlFor="g-ln"><Input id="g-ln" value={f.last_name} onChange={set("last_name")} maxLength={100} /></Field>
        <Field label="Phone" htmlFor="g-ph"><Input id="g-ph" type="tel" placeholder="0803 123 4567" value={f.phone} onChange={set("phone")} maxLength={30} /></Field>
        <Field label="Email" htmlFor="g-em"><Input id="g-em" type="email" value={f.email} onChange={set("email")} maxLength={255} /></Field>
        <Field label="Nationality" htmlFor="g-na"><Input id="g-na" placeholder="Nigerian" value={f.nationality} onChange={set("nationality")} maxLength={60} /></Field>
      </div>
      <Field label="Address" htmlFor="g-ad"><Textarea id="g-ad" rows={2} value={f.address} onChange={set("address")} maxLength={500} /></Field>
      <Field label="Notes" htmlFor="g-no" hint="Preferences, allergies, VIP notes."><Textarea id="g-no" rows={3} value={f.notes} onChange={set("notes")} maxLength={2000} /></Field>
    </FormDialog>
  );
}
