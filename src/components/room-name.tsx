// "Zurich (Deluxe)" for lists and boards: the label as typed, then the room type in a lighter colour.
// Lists that only carry the label look the type up from the hotel's rooms (labels are unique per hotel,
// ignoring case). Titles and sentences use the plain label instead (ROOM-005).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Room label (lower case) to room type name, for the current hotel. */
export function useRoomTypeNames() {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["rooms", "type-names", property?.id], enabled: !!property, staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("rooms").select("room_number, room_types(name)").eq("property_id", property!.id);
      if (error) throw error;
      return new Map((data as { room_number: string; room_types: { name: string } | null }[])
        .map((r) => [r.room_number.toLowerCase(), r.room_types?.name ?? ""]));
    },
  });
}

/** Shows "Zurich (Deluxe)". Pass typeName when the row has it; otherwise it is looked up. */
export function RoomName({ label, typeName, className }: { label: string | null | undefined; typeName?: string | null; className?: string }) {
  const names = useRoomTypeNames();
  if (!label) return null;
  const type = typeName ?? names.data?.get(label.toLowerCase());
  return (
    <span className={cn("font-semibold tabular", className)}>
      {label}{type ? <span className="font-normal text-muted-foreground"> ({type})</span> : null}
    </span>
  );
}
