import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAccess } from "@/lib/access";
import { errorMessage } from "@/lib/errors";
import { NoAccess, callRpc } from "@/lib/setup";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/ui/money";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/_app/housekeeping/minibar")({ component: Minibar });

interface Item { id: string; name: string; price: number; is_active: boolean }
interface MiniRoom { room_id: string; room_number: string }

function Minibar() {
  const { can, property } = useAccess();
  if (!can("hk.minibar.record") && !can("setup.minibar.manage")) return <NoAccess />;
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="Minibar" description="Pick the room, tap what the guest used, then send. Front desk confirms the charge." />
      {can("hk.minibar.record") && property && <LogUse propertyId={property.id} currency={property.base_currency} />}
      {can("setup.minibar.manage") && property && <PriceList propertyId={property.id} />}
    </div>
  );
}

function useItems(propertyId: string) {
  return useQuery({ queryKey: ["minibar", "items", propertyId], queryFn: () => callRpc<Item[]>("list_minibar_items", { p_property_id: propertyId }) });
}

function LogUse({ propertyId, currency }: { propertyId: string; currency: string }) {
  const qc = useQueryClient();
  const items = useItems(propertyId);
  const rooms = useQuery({ queryKey: ["minibar", "rooms", propertyId], queryFn: () => callRpc<MiniRoom[]>("list_minibar_rooms", { p_property_id: propertyId }) });
  const [room, setRoom] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  // One key per attempt. A retry on a weak signal sends the same key, so the charge request is never doubled.
  const key = useRef(crypto.randomUUID());
  const send = useMutation({
    mutationFn: () => callRpc("record_minibar_use", {
      p_room_id: room,
      p_items: Object.entries(qty).filter(([, n]) => n > 0).map(([item_id, n]) => ({ item_id, qty: n })),
      p_idempotency_key: key.current,
    }),
    onSuccess: () => {
      toast.success("Sent to front desk.");
      key.current = crypto.randomUUID();
      setQty({});
      qc.invalidateQueries({ queryKey: ["service-requests"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const active = (items.data ?? []).filter((i) => i.is_active);
  const chosen = Object.values(qty).some((n) => n > 0);
  const step = (id: string, d: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(99, (q[id] ?? 0) + d)) }));

  if (items.isLoading || rooms.isLoading) return <LoadingState label="Loading minibar…" />;
  if ((rooms.data ?? []).length === 0) return <EmptyState title="No guests in house" description="Minibar can be logged for rooms with a guest in house." />;
  if (active.length === 0) return <EmptyState title="No minibar items yet" description="A manager adds items and prices below, or on this page." />;
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="mb-room">Room</Label>
          <Select value={room} onValueChange={setRoom}>
            <SelectTrigger id="mb-room" className="h-12 text-base"><SelectValue placeholder="Pick a room" /></SelectTrigger>
            <SelectContent>{(rooms.data ?? []).map((r) => <SelectItem key={r.room_id} value={r.room_id}>{r.room_number}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <ul className="divide-y rounded-md border">
          {active.map((i) => (
            <li key={i.id} className="flex min-h-14 items-center justify-between gap-3 px-3">
              <div>
                <div className="text-[15px] font-medium">{i.name}</div>
                <Money amount={i.price} currency={currency} className="text-sm text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" className="h-11 w-11" aria-label={`Less ${i.name}`} onClick={() => step(i.id, -1)}><Minus className="h-5 w-5" /></Button>
                <span className="w-7 text-center text-lg tabular-nums">{qty[i.id] ?? 0}</span>
                <Button type="button" variant="outline" size="icon" className="h-11 w-11" aria-label={`More ${i.name}`} onClick={() => step(i.id, 1)}><Plus className="h-5 w-5" /></Button>
              </div>
            </li>
          ))}
        </ul>
        <Button className="h-12 w-full text-base" disabled={!room || !chosen || send.isPending} onClick={() => send.mutate()}>Send to front desk</Button>
      </CardContent>
    </Card>
  );
}

function PriceList({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient();
  const items = useItems(propertyId);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const save = useMutation({
    mutationFn: (a: { id: string | null; name: string; price: string | number; active: boolean }) =>
      callRpc("save_minibar_item", { p_property_id: propertyId, p_id: a.id, p_name: a.name, p_price: a.price, p_is_active: a.active }),
    onSuccess: () => { toast.success("Saved."); qc.invalidateQueries({ queryKey: ["minibar"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <h2 className="text-lg font-semibold">Price list</h2>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !(Number(price) > 0)) { toast.error("Enter the item name and a price."); return; }
          save.mutate({ id: null, name, price, active: true }, { onSuccess: () => { setName(""); setPrice(""); } });
        }}>
          <div className="min-w-40 flex-1 space-y-1.5"><Label htmlFor="mb-name">Item</Label><Input id="mb-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="w-32 space-y-1.5"><Label htmlFor="mb-price">Price</Label><Input id="mb-price" type="number" inputMode="decimal" min="0" step="0.01" className="text-right" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <Button type="submit" disabled={save.isPending}>Add</Button>
        </form>
        <ul className="divide-y rounded-md border">
          {(items.data ?? []).map((i) => (
            <li key={i.id} className="flex min-h-12 items-center justify-between gap-3 px-3">
              <span className={i.is_active ? "" : "text-muted-foreground line-through"}>{i.name}</span>
              <div className="flex items-center gap-3">
                <Money amount={i.price} />
                <Switch checked={i.is_active} aria-label={`${i.name} on the list`} onCheckedChange={(v) => save.mutate({ id: i.id, name: i.name, price: i.price, active: v })} />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
