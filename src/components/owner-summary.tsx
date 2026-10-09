import { useQuery } from "@tanstack/react-query";
import { Newspaper } from "lucide-react";
import { useAccess } from "@/lib/access";
import { callRpc } from "@/lib/setup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type OwnerSummary = { lines: string[]; text: string };

/** Yesterday at a glance. Plain sentences built in the database; works with AI off. Shows to people who may see finance and operations figures. */
export function OwnerSummaryCard() {
  const { property, can } = useAccess();
  const allowed = can("rpt.finance.view") && can("rpt.operations.view");
  const q = useQuery({
    queryKey: ["owner-summary", property?.id, property?.business_date], enabled: allowed && !!property,
    queryFn: () => callRpc<OwnerSummary>("owner_summary", { p_property_id: property!.id }),
  });
  if (!allowed || !property || !q.data) return null;
  return (
    <Card aria-label="Yesterday at a glance">
      <CardHeader><CardTitle className="flex items-center gap-2"><Newspaper className="size-4" /> Yesterday at a glance</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-1 text-[15px]">
          {q.data.lines.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </CardContent>
    </Card>
  );
}
