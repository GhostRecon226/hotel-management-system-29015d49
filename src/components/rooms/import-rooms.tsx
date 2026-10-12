// "Import from a list" for the Rooms setup page (SET-010, AI-006, AI-007). Only for roles with setup.room.manage, and only
// when AI helpers are switched on. The AI drafts, the database previews, and nothing is added until the person confirms.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAccess } from "@/lib/access";
import { errorMessage } from "@/lib/errors";
import { callRpc } from "@/lib/setup";
import { draftSetupImport, type ImportPreview } from "@/lib/setup-import.functions";
import type { ImportProposal } from "@/lib/setup-import";
import { useAiStatus } from "@/components/admin/ai-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function ImportRoomsButton() {
  const { property, can } = useAccess();
  const allowed = can("setup.room.manage") && can("rpt.finance.view");
  const status = useAiStatus(allowed);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<{ proposal: ImportProposal; notes: string[]; preview: ImportPreview } | null>(null);
  const qc = useQueryClient();
  const run = useServerFn(draftSetupImport);
  const make = useMutation({
    mutationFn: () => run({ data: { propertyId: property!.id, text } }),
    onSuccess: setDraft,
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["setup", "ai"] }),
  });
  const apply = useMutation({
    mutationFn: () => callRpc<{ created_types: number; created_rooms: number }>("apply_setup_import", { p_property_id: property!.id, p_payload: draft!.proposal, p_preview: false }),
    onSuccess: (r) => {
      toast.success(`Added ${r.created_rooms} rooms and ${r.created_types} room types.`);
      ["rooms", "room_types"].forEach((k) => qc.invalidateQueries({ queryKey: ["setup", k] }));
      qc.invalidateQueries({ queryKey: ["rooms"] });
      setOpen(false); setDraft(null); setText("");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!allowed || !property || !status.data?.enabled) return null;
  const pv = draft?.preview;
  const blocked = !!pv && (pv.invalid.length > 0 || (pv.room_limit != null && pv.rooms_now + pv.would_create_rooms > pv.room_limit));
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Sparkles className="mr-2 size-4" /> Import from a list</Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setDraft(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Import rooms from a list</DialogTitle></DialogHeader>
          {!draft ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Paste your room list in any form: numbers, types, floors. AI drafts it and you check it before anything is added. Paste room details only, no guest names, emails or phone numbers.</p>
              <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Standard rooms 101 to 110, floor 1, sleeps 2\nDeluxe rooms 201 to 208, floor 2, sleeps 3"} />
              <p className="text-sm text-muted-foreground">{status.data.remaining} of {status.data.monthly_cap} AI drafts left this month.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button disabled={make.isPending || !text.trim() || status.data.remaining <= 0} onClick={() => make.mutate()}>{make.isPending ? "Reading…" : "Draft with AI"}</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-semibold">Check this before you add it.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>{pv!.would_create_types.length} new room types{pv!.would_create_types.length > 0 && `: ${pv!.would_create_types.join(", ")}`}</li>
                <li>{pv!.would_create_rooms} new rooms</li>
                {pv!.skipped_rooms > 0 && <li>{pv!.skipped_rooms} rooms skipped because they already exist</li>}
                {pv!.skipped_types.length > 0 && <li>Existing types reused: {pv!.skipped_types.join(", ")}</li>}
              </ul>
              {draft.notes.map((n) => <p key={n} className="text-muted-foreground">{n}</p>)}
              {pv!.invalid.length > 0 && <p className="text-destructive">{pv!.invalid.length} items cannot be added, for example {pv!.invalid[0]!.label}: {pv!.invalid[0]!.reason}. Fix the list and draft again.</p>}
              {pv!.room_limit != null && pv!.rooms_now + pv!.would_create_rooms > pv!.room_limit && <p className="text-destructive">This would go over your plan's limit of {pv!.room_limit} rooms.</p>}
              <div className="max-h-56 overflow-y-auto rounded-md border p-2 text-muted-foreground">
                {draft.proposal.rooms.map((r) => <span key={r.number} className="mr-3 inline-block">{r.number} ({r.type_code}{r.floor ? `, floor ${r.floor}` : ""})</span>)}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDraft(null)}>Back</Button>
                <Button disabled={apply.isPending || blocked || pv!.would_create_rooms + pv!.would_create_types.length === 0} onClick={() => apply.mutate()}>{apply.isPending ? "Adding…" : "Add to my hotel"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
