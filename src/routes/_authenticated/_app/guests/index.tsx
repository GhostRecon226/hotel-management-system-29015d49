import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { useAccess } from "@/lib/access";
import { formatDate, fullName, GuestFormDialog, useGuestSearch } from "@/lib/guests";
import { PageHeader, FilterBar } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { TableSkeletonRows } from "@/components/ui/states";
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
      <PageHeader title="Guests" description="Guest profiles are shared across all your properties."
        actions={<>
          {can("guest.merge") && <Button variant="outline" asChild><Link to="/guests/merge">Merge duplicates</Link></Button>}
          {can("guest.create") && <Button onClick={() => setOpen(true)}>New guest</Button>}
        </>} />
      <FilterBar>
        <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-10" placeholder="Search by name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
      </FilterBar>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead>
          <TableHead>Nationality</TableHead><TableHead>Added</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {isLoading && <TableSkeletonRows cols={5} />}
          {!isLoading && data.length === 0 && (
            <TableStateRow colSpan={5} title={q ? "No guests match your search" : "No guests yet"} description={q ? "Check the spelling, or search by phone number instead." : "Guests you add will appear here."} />
          )}
          {data.map((g) => (
            <TableRow key={g.id} className="cursor-pointer" onClick={() => navigate({ to: "/guests/$id", params: { id: g.id } })}>
              <TableCell className="font-medium">
                <Link to="/guests/$id" params={{ id: g.id }} className="text-primary-strong hover:underline" onClick={(e) => e.stopPropagation()}>{fullName(g)}</Link>
                {g.anonymised_at && <Badge variant="neutral" className="ml-2">Anonymised</Badge>}
              </TableCell>
              <TableCell>{g.phone}</TableCell><TableCell>{g.email}</TableCell>
              <TableCell>{g.nationality}</TableCell><TableCell className="tabular">{formatDate(g.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <GuestFormDialog open={open} onOpenChange={setOpen}
        onSaved={(id) => navigate({ to: "/guests/$id", params: { id } })} />
    </div>
  );
}
