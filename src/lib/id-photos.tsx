// ID document photos in the browser (GST-007). Photos are shrunk here before upload (longest side 1600 px,
// JPEG): smaller files, and the photo's hidden data (camera, time, GPS location) is dropped because only the
// pixels are redrawn. PDFs are sent as they are, up to 2 MB. Storage links come from the server only.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { errorMessage } from "@/lib/errors";
import { callRpc, Field, FormDialog } from "@/lib/setup";
import { ID_PHOTO_BUCKET, idPhotoViewLink, purgeGuestIdPhotos, startIdPhotoUpload } from "@/lib/id-photos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const ID_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const LONG_SIDE = 1600;
export const ID_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export interface IdPhotoSettings { allow: boolean; require: boolean; require_effective: boolean; keep_months: number }
export interface IdPhoto { id: string; document_id: string | null; side: "front" | "back"; mime_type: string; size_bytes: number; uploaded_at: string; uploaded_by_name: string | null }

export function useIdPhotoSettings() {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["id-photos", "settings", property?.id], enabled: !!property,
    queryFn: () => callRpc<IdPhotoSettings>("get_id_photo_settings", { p_property_id: property!.id }),
  });
}

/** What this person may do with ID photos here, given the hotel switch. */
export function useIdPhotoAccess() {
  const { can } = useAccess();
  const settings = useIdPhotoSettings();
  const on = !!settings.data?.allow;
  return {
    settings: settings.data,
    canUpload: on && can("guest.document.file.upload"),
    canView: on && can("guest.document.file.view"),
    canDelete: can("guest.document.file.delete"),
    required: !!settings.data?.require_effective && can("guest.document.file.upload"),
  };
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The photo could not be prepared."))), "image/jpeg", quality));
}

/** Shrinks a photo to at most 1600 px on its longest side as JPEG, without its hidden data. PDFs pass through. */
export async function prepareIdPhoto(file: File): Promise<{ blob: Blob; mime: string }> {
  if (file.type === "application/pdf") {
    if (file.size > ID_PHOTO_MAX_BYTES) throw new Error("This PDF is larger than 2 MB. Scan it at a lower resolution, or take a photo instead.");
    return { blob: file, mime: "application/pdf" };
  }
  if (!file.type.startsWith("image/")) throw new Error("Use a photo (JPEG, PNG or WebP) or a PDF scan.");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("This photo could not be read. Try a JPEG or PNG photo."); }
  const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const q of [0.8, 0.65, 0.5]) {
    const blob = await canvasBlob(canvas, q);
    if (blob.size <= ID_PHOTO_MAX_BYTES) return { blob, mime: "image/jpeg" };
  }
  throw new Error("This photo is still larger than 2 MB after shrinking. Take it again in less detail.");
}

export interface UploadArgs { propertyId: string; guestId: string; docType: string; docNumber: string; expiry: string | null; side: "front" | "back"; file: File }

/** Shrink, reserve, upload with the one-time link, then confirm. Throws a plain message on any failure. */
export async function uploadIdPhoto(a: UploadArgs) {
  const { blob, mime } = await prepareIdPhoto(a.file);
  const start = await startIdPhotoUpload({ data: {
    propertyId: a.propertyId, guestId: a.guestId, docType: a.docType, docNumber: a.docNumber, expiry: a.expiry,
    side: a.side, mime, size: blob.size,
  } });
  const up = await supabase.storage.from(ID_PHOTO_BUCKET).uploadToSignedUrl(start.path, start.token, blob, { contentType: mime });
  if (up.error) throw new Error(`The photo could not be uploaded: ${up.error.message}`);
  return callRpc("finish_id_photo_upload", { p_file_id: start.fileId });
}

export function useGuestIdPhotos(guestId: string | undefined, enabled: boolean) {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["id-photos", "list", guestId, property?.id], enabled: !!guestId && !!property && enabled,
    queryFn: () => callRpc<IdPhoto[]>("list_id_photos", { p_guest_id: guestId, p_property_id: property!.id }),
  });
}

export function useIdPhotosChanged() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["id-photos", "list"] });
}

/** Removes at once from storage what the database has marked for this guest. Best effort: the daily clean-up retries. */
export async function purgeIdPhotosNow(guestId: string) {
  try { await purgeGuestIdPhotos({ data: { guestId } }); } catch { /* the daily clean-up removes it */ }
}

/** "Take or upload photo": a file input that also opens the camera on phones. */
export function IdPhotoPicker({ id, label, file, onFile, required }: { id: string; label: string; file: File | null; onFile: (f: File | null) => void; required?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Field label={label} htmlFor={id} hint={file ? `${file.name}, ready to upload with the check-in.` : "A photo (JPEG, PNG or WebP) or a PDF scan, up to 2 MB. Photos are made smaller first."}>
      <div className="flex flex-wrap items-center gap-2">
        <Input ref={ref} id={id} type="file" accept={ID_PHOTO_ACCEPT} capture="environment" className="max-w-xs"
          required={required && !file} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        {file && <Button type="button" size="sm" variant="ghost" onClick={() => { onFile(null); if (ref.current) ref.current.value = ""; }}>Clear</Button>}
      </div>
    </Field>
  );
}

/** Opens one photo with a 60-second link. Each opening is audited by the database. */
export function IdPhotoViewer({ photo, onOpenChange }: { photo: IdPhoto | null; onOpenChange: (o: boolean) => void }) {
  const { property } = useAccess();
  const link = useQuery({
    queryKey: ["id-photos", "view", photo?.id], enabled: !!photo && !!property, gcTime: 0, staleTime: 0, retry: false,
    queryFn: () => idPhotoViewLink({ data: { fileId: photo!.id, propertyId: property!.id } }),
  });
  return (
    <Dialog open={!!photo} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>ID photo · {photo?.side === "back" ? "Back" : "Front"}</DialogTitle>
          <DialogDescription>This link works for 60 seconds. Opening it is recorded.</DialogDescription>
        </DialogHeader>
        {link.isLoading ? <p className="text-sm text-muted-foreground">Opening…</p>
          : link.error ? <p className="text-sm text-danger-strong">{errorMessage(link.error)}</p>
          : link.data && (photo?.mime_type === "application/pdf"
            ? <Button asChild><a href={link.data.url} target="_blank" rel="noreferrer noopener">Open the PDF</a></Button>
            : <img src={link.data.url} alt={`ID document, ${photo?.side}`} className="max-h-[70vh] w-full rounded-lg object-contain" />)}
      </DialogContent>
    </Dialog>
  );
}

export function DeleteIdPhotoDialog({ photo, guestId, onOpenChange }: { photo: IdPhoto | null; guestId: string; onOpenChange: (o: boolean) => void }) {
  const { property } = useAccess();
  const changed = useIdPhotosChanged();
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      await callRpc("delete_id_photo", { p_file_id: photo!.id, p_property_id: property!.id, p_reason: reason });
      await purgeIdPhotosNow(guestId);
    },
    onSuccess: () => { changed(); toast.success("Photo deleted."); setReason(""); onOpenChange(false); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <FormDialog open={!!photo} onOpenChange={onOpenChange} title="Delete ID photo" busy={m.isPending} onSubmit={() => m.mutate()} submitLabel="Delete">
      <p className="text-sm text-muted-foreground">The photo is removed from storage. The ID type and number stay on the guest.</p>
      <Field label="Reason" htmlFor="dp-reason"><Input id="dp-reason" value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={300} /></Field>
    </FormDialog>
  );
}
