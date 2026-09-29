import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useAccess } from "@/lib/access";
import { formatDay } from "@/lib/reservations";
import {
  BLOCK_TYPES, BlockRoomDialog, BlockStatusBadge, ConditionBadge, ReasonDialog, SetConditionDialog,
  useBoardRoom, useRoomBlocks, useRoomMutation, type RoomBlock,
} from "@/lib/rooms";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, LoadingState, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/rooms/$id")({ component: RoomDetail });

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b py-3 text-[15px] last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2">{children || "—"}</dd>
    </div>
  );
}

function RoomDetail() {
  const { id } = Route.useParams();
  const { can } = useAccess();
  const { data: room, isLoading } = useBoardRoom(id);
  const { data: blocks = [], isLoading: blocksLoading } = useRoomBlocks(id);
  const [dialog, setDialog] = useState<null | "condition" | "block">(null);
  const [release, setRelease] = useState<RoomBlock | null>(null);
  const [reject, setReject] = useState<RoomBlock | null>(null);
  const approve = useRoomMutation("approve_room_block", "Block approved.");
  const rel = useRoomMutation("release_room_block", "Block released.");
  const rej = useRoomMutation("reject_room_block", "Block rejected.");

  if (isLoading) return <LoadingState label="Loading room…" />;
  if (!room) return <EmptyState title="Room not found" />;

  const openBlocks = blocks.filter((b) => b.status === "pending" || b.status === "approved");
  const canRelease = can("room.ooo.set") || can("room.block.approve");

  return (
    <div>
      <Link to="/rooms" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Rooms
      </Link>
      <PageHeader title={`Room ${room.room_number}`} description={`${room.room_type_name}${room.floor ? ` · Floor ${room.floor}` : ""}`}
        actions={<>
          {can("room.status.set") && <Button variant="outline" onClick={() => setDialog("condition")}>Set condition</Button>}
          {can("room.ooo.set") && <Button onClick={() => setDialog("block")}>Block room</Button>}
        </>} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent><dl>
            <Row label="Condition"><ConditionBadge condition={room.condition} /></Row>
            <Row label="Occupancy">{room.is_occupied ? <Badge variant="info" dot>Occupied</Badge> : <Badge variant="neutral">Vacant</Badge>}</Row>
            <Row label="Sellable">{room.is_sellable ? <Badge variant="success">Yes</Badge>
              : <Badge variant="danger">{room.block_type ? `No · ${BLOCK_TYPES[room.block_type]} until ${formatDay(room.block_to_date)}` : room.is_active ? "No" : "No · inactive"}</Badge>}</Row>
          </dl></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Guests</CardTitle></CardHeader>
          <CardContent><dl>
            <Row label="Current guest">{room.current_reservation_id && (
              <Link to="/reservations/$id" params={{ id: room.current_reservation_id }} className="font-medium text-primary-strong hover:underline">
                {room.current_guest_name ?? "Guest"} · {room.current_number}
              </Link>)}
              {room.current_departure_date && <span className="block text-sm text-muted-foreground">Leaves {formatDay(room.current_departure_date)}</span>}
            </Row>
            <Row label="Next arrival">{room.next_reservation_id && (
              <Link to="/reservations/$id" params={{ id: room.next_reservation_id }} className="font-medium text-primary-strong hover:underline">
                {room.next_guest_name ?? "Guest"} · {room.next_number}
              </Link>)}
              {room.next_arrival_date && <span className="block text-sm text-muted-foreground">Arrives {formatDay(room.next_arrival_date)}</span>}
            </Row>
          </dl></CardContent>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-xl font-semibold">Open tasks</h2>
      <Card><CardContent className="py-4">
        {openBlocks.filter((b) => b.status === "pending").length > 0
          ? <p className="text-[15px]">{openBlocks.filter((b) => b.status === "pending").length} block request waiting for approval.</p>
          : <p className="text-[15px] text-muted-foreground">No open tasks. Housekeeping and maintenance tasks will show here once those sections are built.</p>}
      </CardContent></Card>

      <h2 className="mb-3 mt-8 text-xl font-semibold">Blocks</h2>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead className="w-56" />
        </TableRow></TableHeader>
        <TableBody>
          {blocksLoading && <TableStateRow colSpan={5} loading title="Loading blocks…" />}
          {!blocksLoading && blocks.length === 0 && <TableStateRow colSpan={5} title="No blocks" description="Out-of-order, out-of-service and hold blocks appear here." />}
          {blocks.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-medium">{BLOCK_TYPES[b.block_type]}</TableCell>
              <TableCell className="tabular">{formatDay(b.from_date)} – {formatDay(b.to_date)}</TableCell>
              <TableCell>{b.reason}{(b.decision_reason || b.release_reason) && <span className="block text-sm text-muted-foreground">{b.decision_reason ?? b.release_reason}</span>}</TableCell>
              <TableCell><BlockStatusBadge status={b.status} /></TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {b.status === "pending" && can("room.block.approve") && <>
                    <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate({ p_id: b.id })}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => setReject(b)}>Reject</Button>
                  </>}
                  {(b.status === "pending" || b.status === "approved") && canRelease &&
                    <Button size="sm" variant="outline" onClick={() => setRelease(b)}>{b.status === "pending" ? "Cancel" : "Release"}</Button>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <SetConditionDialog room={dialog === "condition" ? room : null} onOpenChange={(o) => !o && setDialog(null)} />
      <BlockRoomDialog room={dialog === "block" ? room : null} onOpenChange={(o) => !o && setDialog(null)} />
      <ReasonDialog open={!!release} title={release?.status === "pending" ? "Cancel block request" : "Release block"} label="Note (optional)"
        busy={rel.isPending} onOpenChange={(o) => !o && setRelease(null)}
        onSubmit={(reason) => rel.mutate({ p_id: release!.id, p_reason: reason || null }, { onSuccess: () => setRelease(null) })} />
      <ReasonDialog open={!!reject} title="Reject block" label="Reason" required
        busy={rej.isPending} onOpenChange={(o) => !o && setReject(null)}
        onSubmit={(reason) => rej.mutate({ p_id: reject!.id, p_reason: reason }, { onSuccess: () => setReject(null) })} />
    </div>
  );
}
