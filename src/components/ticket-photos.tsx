// Photos on a maintenance ticket (MNT-004). Photos are shrunk in the browser first (longest side 1600 px, JPEG),
// which also drops hidden data such as GPS location. Storage links come from the server only.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";
import { callRpc } from "@/lib/setup";
import { prepareIdPhoto } from "@/lib/id-photos";
import { purgeTicketPhotos, startTicketPhotoUpload, ticketPhotoViewLink, TICKET_PHOTO_BUCKET } from "@/lib/ticket-photos.functions";
import { formatDateTime } from "@/lib/reservations";
import { TextReasonDialog } from "@/lib/maintenance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TicketPhoto { id: string; mime_type: string; size_bytes: number; uploaded_at: string; uploaded_by_name: string | null; mine: boolean }

export function TicketPhotos({ ticketId, canAdd, canRemoveAny }: { ticketId: string; canAdd: boolean; canRemoveAny: boolean }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<TicketPhoto | null>(null);
  const [removing, setRemoving] = useState<TicketPhoto | null>(null);
  const list = useQuery({ queryKey: ["ticket-photos", ticketId], queryFn: () => callRpc<TicketPhoto[]>("list_ticket_photos", { p_ticket_id: ticketId }) });
  const changed = () => qc.invalidateQueries({ queryKey: ["ticket-photos", ticketId] });

  const add = useMutation({
    mutationFn: async (file: File) => {
      if (file.type === "application/pdf") throw new Error("Use a photo (JPEG, PNG or WebP).");
      const { blob, mime } = await prepareIdPhoto(file);
      const start = await startTicketPhotoUpload({ data: { ticketId, mime, size: blob.size } });
      const up = await supabase.storage.from(TICKET_PHOTO_BUCKET).uploadToSignedUrl(start.path, start.token, blob, { contentType: mime });
      if (up.error) throw new Error(`The photo could not be uploaded: ${up.error.message}`);
      return callRpc("finish_ticket_photo_upload", { p_file_id: start.fileId });
    },
    onSuccess: () => { changed(); toast.success("Photo added."); },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => { if (input.current) input.current.value = ""; },
  });
  const remove = useMutation({
    mutationFn: async ({ photo, reason }: { photo: TicketPhoto; reason: string }) => {
      await callRpc("delete_ticket_photo", { p_file_id: photo.id, p_reason: reason });
      try { await purgeTicketPhotos(); } catch { /* the daily clean-up removes it */ }
    },
    onSuccess: () => { changed(); setRemoving(null); toast.success("Photo removed."); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const photos = list.data ?? [];

  return (
    <Card className="lg:col-span-2">
      <CardHeader><CardTitle>Photos</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {list.isLoading ? <p className="text-muted-foreground">Loading…</p>
          : photos.length === 0 ? <p className="text-muted-foreground">No photos yet.</p>
          : <ul className="divide-y">{photos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Button variant="link" className="h-11 px-0" onClick={() => setOpen(p)}>
                  Photo · {formatDateTime(p.uploaded_at)}{p.uploaded_by_name ? ` · ${p.uploaded_by_name}` : ""}
                </Button>
                {(p.mine || canRemoveAny) && <Button variant="ghost" className="h-11 text-destructive" onClick={() => setRemoving(p)}>Remove</Button>}
              </li>))}
            </ul>}
        {canAdd && (
          <>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" aria-label="Add photo"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) add.mutate(f); }} />
            <Button className="h-12 w-full text-base sm:w-auto" disabled={add.isPending || photos.length >= 5} onClick={() => input.current?.click()}>
              <Camera className="mr-2 h-5 w-5" />{add.isPending ? "Uploading…" : photos.length >= 5 ? "5 photos is the limit" : "Add photo"}
            </Button>
          </>
        )}
      </CardContent>
      <PhotoViewer photo={open} onOpenChange={(o) => !o && setOpen(null)} />
      <TextReasonDialog open={!!removing} title="Remove photo" label="Reason" busy={remove.isPending}
        onOpenChange={(o) => !o && setRemoving(null)} onSubmit={(reason) => remove.mutate({ photo: removing!, reason })} />
    </Card>
  );
}

function PhotoViewer({ photo, onOpenChange }: { photo: TicketPhoto | null; onOpenChange: (o: boolean) => void }) {
  const link = useQuery({
    queryKey: ["ticket-photos", "view", photo?.id], enabled: !!photo, gcTime: 0, staleTime: 0, retry: false,
    queryFn: () => ticketPhotoViewLink({ data: { fileId: photo!.id } }),
  });
  return (
    <Dialog open={!!photo} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ticket photo</DialogTitle>
          <DialogDescription>This link works for 60 seconds. Opening it is recorded.</DialogDescription>
        </DialogHeader>
        {link.isLoading ? <p className="text-sm text-muted-foreground">Opening…</p>
          : link.error ? <p className="text-sm text-danger-strong">{errorMessage(link.error)}</p>
          : link.data && <img src={link.data.url} alt="Maintenance ticket" className="max-h-[70vh] w-full rounded-lg object-contain" />}
      </DialogContent>
    </Dialog>
  );
}
