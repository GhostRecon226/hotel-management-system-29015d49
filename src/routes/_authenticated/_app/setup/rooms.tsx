import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAccess } from "@/lib/access";
import { NoAccess, Field, FormDialog, SectionHeader, StatusText, useSetupList, useSetupMutation } from "@/lib/setup";

import type { RoomType } from "./room-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROOM_LABEL_MAX, sortByRoom } from "@/lib/room-label";
import { ImportRoomsButton } from "@/components/rooms/import-rooms";

export const Route = createFileRoute("/_authenticated/_app/setup/rooms")({ component: Rooms });

interface Room {
  id: string; room_number: string; room_type_id: string; floor: string | null;
  condition: string; is_occupied: boolean; is_active: boolean;
}

const CONDITION: Record<string, string> = { clean: "Clean", dirty: "Dirty", inspected: "Inspected", out_of_order: "Out of order" };
const CONDITION_TONE: Record<string, "success" | "warning" | "danger"> = { clean: "success", inspected: "success", dirty: "warning", out_of_order: "danger" };

function TypeSelect({ id, value, onChange, types }: { id: string; value: string; onChange: (v: string) => void; types: RoomType[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}><SelectValue placeholder="Choose room type" /></SelectTrigger>
      <SelectContent>
        {types.filter((t) => t.is_active).map((t) => <SelectItem key={t.id} value={t.id}>{t.code} — {t.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function Rooms() {
  const { property, can } = useAccess();
  const { data: unsorted = [] } = useSetupList<Room>("rooms", "room_number");
  const rooms = sortByRoom(unsorted);
  const { data: types = [] } = useSetupList<RoomType>("room_types", "code");
  const save = useSetupMutation("save_room", ["rooms"]);
  const bulk = useSetupMutation("bulk_add_rooms", ["rooms"], (n) => `${n} room${n === 1 ? "" : "s"} added.`);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [f, setF] = useState({ id: null as string | null, room_number: "", room_type_id: "", floor: "", is_active: true });
  const [b, setB] = useState({ from: "", to: "", room_type_id: "", floor: "" });
  if (!can("setup.room.manage")) return <NoAccess />;

  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? "";
  const edit = (r?: Room) => {
    setF(r ? { id: r.id, room_number: r.room_number, room_type_id: r.room_type_id, floor: r.floor ?? "", is_active: r.is_active }
      : { id: null, room_number: "", room_type_id: "", floor: "", is_active: true });
    setOpen(true);
  };

  return (
    <div>
      <SectionHeader title="Rooms" description={`${rooms.filter((r) => r.is_active).length} active rooms.`}
        action={<div className="flex gap-2">
          <ImportRoomsButton />
          <Button variant="outline" onClick={() => setBulkOpen(true)} disabled={types.length === 0}>Bulk add</Button>
          <Button onClick={() => edit()} disabled={types.length === 0}>Add room</Button>
        </div>} />
      {types.length === 0 && <p className="mb-4 text-sm text-muted-foreground">Add a room type first.</p>}
      <Table>
        <TableHeader><TableRow>
          <TableHead>Room</TableHead><TableHead>Type</TableHead><TableHead>Floor</TableHead>
          <TableHead>Condition</TableHead><TableHead>Occupied</TableHead><TableHead>Status</TableHead><TableHead />
        </TableRow></TableHeader>
        <TableBody>
          {rooms.length === 0 && <TableStateRow colSpan={7} title="No rooms yet." />}
          {rooms.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.room_number}</TableCell><TableCell>{typeName(r.room_type_id)}</TableCell>
              <TableCell>{r.floor}</TableCell><TableCell><Badge variant={CONDITION_TONE[r.condition]} dot>{CONDITION[r.condition]}</Badge></TableCell>
              <TableCell>{r.is_occupied ? <Badge variant="info" dot>In house</Badge> : <Badge variant="neutral">Empty</Badge>}</TableCell><TableCell><StatusText active={r.is_active} /></TableCell>
              <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => edit(r)}>Edit</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <FormDialog open={open} onOpenChange={setOpen} title={f.id ? "Edit room" : "Add room"} busy={save.isPending}
        onSubmit={() => save.mutate({ p_property_id: property!.id, p_id: f.id, p_room_number: f.room_number,
          p_room_type_id: f.room_type_id || null, p_floor: f.floor, p_is_active: f.is_active }, { onSuccess: () => setOpen(false) })}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Room name or number" htmlFor="r-no" hint={`Up to ${ROOM_LABEL_MAX} characters.`}><Input id="r-no" value={f.room_number} maxLength={ROOM_LABEL_MAX} onChange={(e) => setF({ ...f, room_number: e.target.value })} required /></Field>
          <Field label="Floor" htmlFor="r-fl"><Input id="r-fl" value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} /></Field>
        </div>
        <Field label="Room type" htmlFor="r-type"><TypeSelect id="r-type" value={f.room_type_id} onChange={(v) => setF({ ...f, room_type_id: v })} types={types} /></Field>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} /> Active</label>
      </FormDialog>

      <FormDialog open={bulkOpen} onOpenChange={setBulkOpen} title="Bulk add rooms" busy={bulk.isPending}
        onSubmit={() => bulk.mutate({ p_property_id: property!.id, p_from: Number(b.from), p_to: Number(b.to),
          p_room_type_id: b.room_type_id || null, p_floor: b.floor }, { onSuccess: () => setBulkOpen(false) })}>
        <p className="text-sm text-muted-foreground">Adds every number in the range. Numbers that already exist are skipped. For a prefix (A101) or names, use Add several rooms on the Rooms page.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="From" htmlFor="b-from"><Input id="b-from" type="number" placeholder="101" value={b.from} onChange={(e) => setB({ ...b, from: e.target.value })} required /></Field>
          <Field label="To" htmlFor="b-to"><Input id="b-to" type="number" placeholder="120" value={b.to} onChange={(e) => setB({ ...b, to: e.target.value })} required /></Field>
        </div>
        <Field label="Room type" htmlFor="b-type"><TypeSelect id="b-type" value={b.room_type_id} onChange={(v) => setB({ ...b, room_type_id: v })} types={types} /></Field>
        <Field label="Floor" htmlFor="b-fl"><Input id="b-fl" value={b.floor} onChange={(e) => setB({ ...b, floor: e.target.value })} /></Field>
      </FormDialog>
    </div>
  );
}
