import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { useAccess } from "@/lib/access";
import { formatDate, fullName, GuestFormDialog, useGuestSearch } from "@/lib/guests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/guests/")({ component: GuestList });

function GuestList() {
  const { can } = useAccess();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data = [], isLoading } = useGuestSearch(q);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Guests</h1>
          <p className="text-sm text-muted-foreground">Guest profiles are shared across all your properties.</p>
        </div>
        <div className="flex gap-2">
          {can("guest.merge") && <Button variant="outline" asChild><Link to="/guests/merge">Merge duplicates</Link></Button>}
          {can("guest.create") && <Button onClick={() => setOpen(true)}>New guest</Button>}
        </div>
      </div>
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead>
          <TableHead>Nationality</TableHead><TableHead>Added</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {isLoading && <TableStateRow colSpan={5} title="Searching…" />}
          {!isLoading && data.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-muted-foreground">{q ? "No guests match." : "No guests yet."}</TableCell></TableRow>
          )}
          {data.map((g) => (
            <TableRow key={g.id} className="cursor-pointer" onClick={() => navigate({ to: "/guests/$id", params: { id: g.id } })}>
              <TableCell className="font-medium">
                <Link to="/guests/$id" params={{ id: g.id }} onClick={(e) => e.stopPropagation()}>{fullName(g)}</Link>
                {g.anonymised_at && <span className="ml-2 text-xs text-muted-foreground">(anonymised)</span>}
              </TableCell>
              <TableCell>{g.phone}</TableCell><TableCell>{g.email}</TableCell>
              <TableCell>{g.nationality}</TableCell><TableCell>{formatDate(g.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <GuestFormDialog open={open} onOpenChange={setOpen}
        onSaved={(id) => navigate({ to: "/guests/$id", params: { id } })} />
    </div>
  );
}
