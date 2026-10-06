// "Add room" and "Add several rooms" for the Rooms page (ROOM-005). Shown only to roles with setup.room.manage.
// The database tidies and checks every label and does the preview; this screen only shows what it says.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAccess } from "@/lib/access";
import { errorMessage } from "@/lib/errors";
import { callRpc, Field, FormDialog, useSetupList } from "@/lib/setup";
import { ROOM_LABEL_MAX } from "@/lib/room-label";
import type { RoomType } from "@/routes/_authenticated/_app/setup/room-types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Preview {
  would_create: string[]; skipped: string[]; invalid: { label: string; reason: string }[];
  created: number; room_limit: number | null; rooms_now: number;
}

const plural = (n: number) => `${n} room${n === 1 ? "" : "s"}`;

function TypeSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const { data: types = [] } = useSetupList<RoomType>("room_types", "code");
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}><SelectValue placeholder="Choose room type" /></SelectTrigger>
      <SelectContent>
        {types.filter((t) => t.is_active).map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.code})</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function useRoomsChanged() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["rooms"] });
    qc.invalidateQueries({ queryKey: ["setup", "rooms"] });
  };
}

export function AddRoomDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { property } = useAccess();
  const changed = useRoomsChanged();
  const empty = { label: "", room_type_id: "", floor: "" };
  const [f, setF] = useState(empty);
  useEffect(() => { if (open) setF(empty); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: () => callRpc("save_room", { p_property_id: property!.id, p_id: null, p_room_number: f.label,
      p_room_type_id: f.room_type_id || null, p_floor: f.floor, p_is_active: true }),
    onSuccess: () => { changed(); toast.success("Room added."); onOpenChange(false); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Add room" busy={save.isPending} onSubmit={() => save.mutate()}>
      <Field label="Room name or number" htmlFor="ar-label" hint={`Up to ${ROOM_LABEL_MAX} characters, for example 101, A101 or Zurich.`}>
        <Input id="ar-label" value={f.label} maxLength={ROOM_LABEL_MAX} onChange={(e) => setF({ ...f, label: e.target.value })} required autoComplete="off" />
      </Field>
      <Field label="Room type" htmlFor="ar-type"><TypeSelect id="ar-type" value={f.room_type_id} onChange={(v) => setF({ ...f, room_type_id: v })} /></Field>
      <Field label="Floor" htmlFor="ar-floor" hint="Optional."><Input id="ar-floor" value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} /></Field>
    </FormDialog>
  );
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function AddSeveralRoomsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { property } = useAccess();
  const changed = useRoomsChanged();
  const empty = { mode: "numbers" as "numbers" | "names", room_type_id: "", floor: "", prefix: "", from: "", to: "", names: "" };
  const [f, setF] = useState(empty);
  useEffect(() => { if (open) setF(empty); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const call = (preview: boolean) => f.mode === "numbers"
    ? callRpc<Preview>("add_rooms_range", { p_property_id: property!.id, p_prefix: f.prefix || null, p_from: Number(f.from), p_to: Number(f.to),
        p_room_type_id: f.room_type_id, p_floor: f.floor, p_preview: preview })
    : callRpc<Preview>("add_rooms_named", { p_property_id: property!.id, p_names: f.names.split("\n"),
        p_room_type_id: f.room_type_id, p_floor: f.floor, p_preview: preview });

  const ready = !!property && !!f.room_type_id && (f.mode === "numbers"
    ? f.from.trim() !== "" && f.to.trim() !== ""
    : f.names.trim() !== "");
  const key = useDebounced(JSON.stringify(f));
  const preview = useQuery({
    queryKey: ["rooms", "add-preview", property?.id, key], enabled: open && ready && key === JSON.stringify(f),
    queryFn: () => call(true), retry: false,
  });
  const p = ready ? preview.data : undefined;
  const overLimit = !!p && p.room_limit !== null && p.rooms_now + p.would_create.length > p.room_limit;
  const n = p?.would_create.length ?? 0;

  const save = useMutation({
    mutationFn: () => call(false),
    onSuccess: (r) => {
      changed();
      toast.success(`${plural(r.created)} added.${r.skipped.length ? ` ${r.skipped.length} skipped (already there).` : ""}`);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Add several rooms" busy={save.isPending} onSubmit={() => save.mutate()}
      submitLabel={`Add ${plural(n)}`} submitDisabled={!p || n === 0 || p.invalid.length > 0 || overLimit || preview.isFetching}>
      <Tabs value={f.mode} onValueChange={(v) => setF({ ...f, mode: v as typeof f.mode })}>
        <TabsList className="mb-1">
          <TabsTrigger value="numbers">Numbers</TabsTrigger>
          <TabsTrigger value="names">Names</TabsTrigger>
        </TabsList>
        <TabsContent value="numbers" className="space-y-4">
          <p className="text-sm text-muted-foreground">Every number in the range, with an optional prefix. No zeros are added in front.</p>
          <Field label="Prefix" htmlFor="asr-prefix" hint="Optional. Up to 4 letters or digits, for example A gives A101.">
            <Input id="asr-prefix" value={f.prefix} maxLength={4} onChange={(e) => setF({ ...f, prefix: e.target.value })} autoComplete="off" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="From" htmlFor="asr-from"><Input id="asr-from" type="number" min={0} placeholder="101" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
            <Field label="To" htmlFor="asr-to"><Input id="asr-to" type="number" min={0} placeholder="120" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          </div>
        </TabsContent>
        <TabsContent value="names" className="space-y-4">
          <Field label="Room names, one per line" htmlFor="asr-names" hint={`Up to ${ROOM_LABEL_MAX} characters each: letters, numbers, spaces, hyphens and apostrophes.`}>
            <Textarea id="asr-names" rows={6} value={f.names} onChange={(e) => setF({ ...f, names: e.target.value })} placeholder={"Zurich\nBoston\nLagos"} />
          </Field>
        </TabsContent>
      </Tabs>
      <Field label="Room type" htmlFor="asr-type"><TypeSelect id="asr-type" value={f.room_type_id} onChange={(v) => setF({ ...f, room_type_id: v })} /></Field>
      <Field label="Floor" htmlFor="asr-floor" {...(f.mode === "names" ? { hint: "Optional." } : {})}>
        <Input id="asr-floor" value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} />
      </Field>

      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm" aria-live="polite">
        {!ready ? <p className="text-muted-foreground">Choose a room type and fill in the rooms to see a preview.</p>
          : preview.error ? <p className="text-danger-strong">{errorMessage(preview.error)}</p>
          : !p ? <p className="text-muted-foreground">Checking…</p>
          : <div className="space-y-1.5">
              <p className="font-medium">{n === 0 ? "No new rooms to add." : `Adds ${plural(n)}: ${p.would_create.join(", ")}`}</p>
              {p.skipped.length > 0 && <p className="text-muted-foreground">Already there, skipped: {p.skipped.join(", ")}</p>}
              {p.invalid.map((x) => <p key={x.label} className="text-danger-strong">Not allowed: {x.label || "(blank)"}. {x.reason.replace(/:.*$/, ".")}</p>)}
              {p.room_limit !== null && (
                <p className={overLimit ? "text-danger-strong" : "text-muted-foreground"}>
                  Your plan allows {plural(p.room_limit)}. You have {p.rooms_now}{n ? `; after this, ${p.rooms_now + n}` : ""}.
                  {overLimit && " Upgrade your plan or add fewer rooms."}
                </p>
              )}
            </div>}
      </div>
    </FormDialog>
  );
}
