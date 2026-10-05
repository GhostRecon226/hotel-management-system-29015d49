import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAccess } from "@/lib/access";
import { Field, FormDialog } from "@/lib/setup";
import { formatDateTime } from "@/lib/reservations";
import { LF_STATUS, useHkMutation, useLostFound, useRoomsList, type LostFoundItem } from "@/lib/housekeeping";
import { FilterBar, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/housekeeping/lost-found")({ component: LostFound });

function LostFound() {
  const { can } = useAccess();
  const { data = [], isLoading } = useLostFound();
  const rooms = useRoomsList();
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<LostFoundItem | null>(null);
  const [status, setStatus] = useState("stored");
  const [q, setQ] = useState("");
  const canUpdate = can("hk.task.assign") || can("fo.view");
  const roomNo = (id: string | null) => rooms.data?.find((r) => r.id === id)?.room_number;
  const list = data.filter((i) => (status === "all" || i.status === status) &&
    (!q || `${i.description} ${i.location}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader title="Lost and found" description="Log items left behind and record when they are returned."
        actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Log item</Button>} />
      <FilterBar>
        <Input className="w-64" placeholder="Search description or place" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {Object.entries(LF_STATUS).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Item</TableHead><TableHead>Where found</TableHead><TableHead>Found</TableHead><TableHead>Status</TableHead><TableHead className="w-32" />
        </TableRow></TableHeader>
        <TableBody>
          {isLoading && <TableSkeletonRows cols={5} />}
          {!isLoading && list.length === 0 && <TableStateRow colSpan={5} title="No items" description="Items you log appear here." />}
          {list.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{i.description}</TableCell>
              <TableCell>{i.location}{i.room_id && roomNo(i.room_id) && <span className="block text-sm text-muted-foreground">{roomNo(i.room_id)}</span>}</TableCell>
              <TableCell className="tabular">{formatDateTime(i.found_at)}</TableCell>
              <TableCell>
                <Badge variant={LF_STATUS[i.status]?.tone ?? "neutral"}>{LF_STATUS[i.status]?.label ?? i.status}</Badge>
                {(i.claimed_by_name || i.status_note) && <span className="block text-sm text-muted-foreground">{[i.claimed_by_name, i.status_note].filter(Boolean).join(" · ")}</span>}
              </TableCell>
              <TableCell className="text-right">{canUpdate && <Button size="sm" variant="outline" onClick={() => setEdit(i)}>Update</Button>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <LogDialog open={adding} onOpenChange={setAdding} />
      <StatusDialog item={edit} onOpenChange={(o) => !o && setEdit(null)} />
    </div>
  );
}

function LogDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { property } = useAccess();
  const rooms = useRoomsList();
  const m = useHkMutation("save_lost_found_item", "Item logged.");
  const [f, setF] = useState({ description: "", location: "", room: "none", found: "" });
  useEffect(() => { if (open) setF({ description: "", location: "", room: "none", found: "" }); }, [open]);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Log a found item" busy={m.isPending}
      onSubmit={() => m.mutate({ p_property_id: property!.id, p_description: f.description, p_location: f.location,
        p_found_at: f.found ? new Date(f.found).toISOString() : null, p_room_id: f.room === "none" ? null : f.room }, { onSuccess: () => onOpenChange(false) })}>
      <Field label="Description" htmlFor="l-desc"><Textarea id="l-desc" required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Black phone charger" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Where found" htmlFor="l-loc"><Input id="l-loc" required value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Under the bed" /></Field>
        <Field label="Room (optional)" htmlFor="l-room">
          <Select value={f.room} onValueChange={(v) => setF({ ...f, room: v })}>
            <SelectTrigger id="l-room"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not in a room</SelectItem>
              {(rooms.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.room_number}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Found at" htmlFor="l-when" hint="Leave empty for now."><Input id="l-when" type="datetime-local" value={f.found} onChange={(e) => setF({ ...f, found: e.target.value })} /></Field>
    </FormDialog>
  );
}

function StatusDialog({ item, onOpenChange }: { item: LostFoundItem | null; onOpenChange: (o: boolean) => void }) {
  const m = useHkMutation("set_lost_found_status", "Item updated.");
  const [f, setF] = useState({ status: "stored", who: "", note: "" });
  useEffect(() => { if (item) setF({ status: item.status, who: item.claimed_by_name ?? "", note: "" }); }, [item]);
  const needsWho = f.status === "claimed" || f.status === "returned";
  return (
    <FormDialog open={!!item} onOpenChange={onOpenChange} title="Update item" busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: item!.id, p_status: f.status, p_claimed_by: needsWho ? f.who : null, p_note: f.note || null }, { onSuccess: () => onOpenChange(false) })}>
      <p className="text-[15px] text-muted-foreground">{item?.description}</p>
      <Field label="Status" htmlFor="s-status">
        <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
          <SelectTrigger id="s-status"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(LF_STATUS).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      {needsWho && <Field label="Claimed by" htmlFor="s-who"><Input id="s-who" required value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} /></Field>}
      <Field label={f.status === "disposed" ? "Reason" : "Note (optional)"} htmlFor="s-note">
        <Input id="s-note" required={f.status === "disposed"} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </Field>
    </FormDialog>
  );
}
