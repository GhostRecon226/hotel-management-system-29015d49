import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAccess } from "@/lib/access";
import { Field, FormDialog, SectionHeader, StatusText, useSetupList, useSetupMutation } from "@/lib/setup";
import { NoAccess } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/setup/room-types")({ component: RoomTypes });

export interface RoomType {
  id: string; code: string; name: string; max_adults: number; max_children: number;
  description: string | null; is_active: boolean;
}

const empty = { id: null as string | null, code: "", name: "", max_adults: "2", max_children: "0", description: "", is_active: true };

function RoomTypes() {
  const { property, can } = useAccess();
  const { data = [] } = useSetupList<RoomType>("room_types", "code");
  const save = useSetupMutation("save_room_type", ["room_types"]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(empty);
  if (!can("setup.room.manage")) return <NoAccess />;

  const edit = (r?: RoomType) => {
    setF(r ? { id: r.id, code: r.code, name: r.name, max_adults: String(r.max_adults), max_children: String(r.max_children), description: r.description ?? "", is_active: r.is_active } : empty);
    setOpen(true);
  };
  const submit = () => save.mutate({
    p_property_id: property!.id, p_id: f.id, p_code: f.code, p_name: f.name,
    p_max_adults: Number(f.max_adults), p_max_children: Number(f.max_children),
    p_description: f.description, p_is_active: f.is_active,
  }, { onSuccess: () => setOpen(false) });

  return (
    <div>
      <SectionHeader title="Room types" description="Categories of rooms, e.g. Standard, Deluxe, Suite."
        action={<Button onClick={() => edit()}>Add room type</Button>} />
      <Table>
        <TableHeader><TableRow>
          <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Max adults</TableHead>
          <TableHead>Max children</TableHead><TableHead>Status</TableHead><TableHead />
        </TableRow></TableHeader>
        <TableBody>
          {data.length === 0 && <TableRow><TableCell colSpan={6} className="text-muted-foreground">No room types yet.</TableCell></TableRow>}
          {data.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.code}</TableCell><TableCell>{r.name}</TableCell>
              <TableCell>{r.max_adults}</TableCell><TableCell>{r.max_children}</TableCell>
              <TableCell><StatusText active={r.is_active} /></TableCell>
              <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => edit(r)}>Edit</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <FormDialog open={open} onOpenChange={setOpen} title={f.id ? "Edit room type" : "Add room type"} onSubmit={submit} busy={save.isPending}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="rt-code"><Input id="rt-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required /></Field>
          <Field label="Name" htmlFor="rt-name"><Input id="rt-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
          <Field label="Max adults" htmlFor="rt-ad"><Input id="rt-ad" type="number" min={1} value={f.max_adults} onChange={(e) => setF({ ...f, max_adults: e.target.value })} /></Field>
          <Field label="Max children" htmlFor="rt-ch"><Input id="rt-ch" type="number" min={0} value={f.max_children} onChange={(e) => setF({ ...f, max_children: e.target.value })} /></Field>
        </div>
        <Field label="Description" htmlFor="rt-desc"><Input id="rt-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} /> Active</label>
      </FormDialog>
    </div>
  );
}
