import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAccess } from "@/lib/access";
import { errorMessage } from "@/lib/errors";
import { getMorningBrief } from "@/lib/ai-brief.functions";
import { AI_STATUS_KEY, useAiStatus } from "@/components/admin/ai-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Owner's morning brief. Shows only to people who may see finance and operations figures, and only when AI is on. */
export function MorningBrief() {
  const { property, can } = useAccess();
  const allowed = can("rpt.finance.view") && can("rpt.operations.view");
  const status = useAiStatus(allowed);
  const qc = useQueryClient();
  const run = useServerFn(getMorningBrief);
  const brief = useMutation({
    mutationFn: () => run({ data: { propertyId: property!.id } }),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: AI_STATUS_KEY }),
  });

  if (!allowed || !property || !status.data) return null;
  if (!status.data.enabled) {
    return can("adm.ai.manage") ? (
      <Card>
        <CardContent className="flex items-center justify-between gap-4 pt-6 text-sm">
          <span className="text-muted-foreground">The owner's morning brief is off.</span>
          <Link to="/admin" className="font-semibold text-primary hover:underline">Switch on in Admin</Link>
        </CardContent>
      </Card>
    ) : null;
  }

  const r = brief.data;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Sparkles className="size-4" /> Morning brief</CardTitle>
        <Button size="sm" disabled={brief.isPending || status.data.remaining <= 0} onClick={() => brief.mutate()}>
          {brief.isPending ? "Writing…" : r ? "Write again" : "Write today's brief"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {status.data.remaining <= 0 && <p className="text-muted-foreground">The monthly AI limit is reached. It resets next month.</p>}
        {r && (
          <>
            <div className="flex items-center gap-2">
              {r.source === "ai" ? <Badge variant="info">AI draft</Badge> : <Badge variant="warning">Figures only</Badge>}
              <span className="text-muted-foreground">{r.source === "ai" ? "Check it against the figures below." : r.note}</span>
            </div>
            {r.source === "ai" && <p className="whitespace-pre-line text-[15px] leading-relaxed">{r.text}</p>}
            <ul className="space-y-1 border-t pt-3 text-muted-foreground">
              {r.lines.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </>
        )}
        {!r && status.data.remaining > 0 && <p className="text-muted-foreground">{status.data.remaining} of {status.data.monthly_cap} drafts left this month.</p>}
      </CardContent>
    </Card>
  );
}
