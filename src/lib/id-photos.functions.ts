// Server functions for ID document photos (GST-007). The database checks permission, the hotel switch and the
// file first (as the signed-in user); only then does the server use the service role to sign a storage link.
// The browser never gets storage access of its own and never sees the service role key.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ID_PHOTO_BUCKET = "guest-id-documents";
const VIEW_SECONDS = 60;

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

export interface StartUploadInput {
  propertyId: string; guestId: string; docType: string; docNumber: string; expiry: string | null;
  side: "front" | "back"; mime: string; size: number;
}

/** Step 1: reserve a file name in the database, then sign a one-time upload link for exactly that name. */
export const startIdPhotoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: StartUploadInput) => ({
    propertyId: String(i?.propertyId ?? ""), guestId: String(i?.guestId ?? ""), docType: String(i?.docType ?? ""),
    docNumber: String(i?.docNumber ?? ""), expiry: i?.expiry ? String(i.expiry) : null,
    side: i?.side === "back" ? "back" as const : "front" as const, mime: String(i?.mime ?? ""), size: Number(i?.size ?? 0),
  }))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as Rpc;
    const begun = await rpc("begin_id_photo_upload", {
      p_property_id: data.propertyId, p_guest_id: data.guestId, p_doc_type: data.docType, p_doc_number: data.docNumber,
      p_expiry: data.expiry, p_side: data.side, p_mime: data.mime, p_size: data.size,
    });
    if (begun.error) throw new Error(begun.error.message);
    const { file_id, path } = begun.data as { file_id: string; path: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const signed = await supabaseAdmin.storage.from(ID_PHOTO_BUCKET).createSignedUploadUrl(path);
    if (signed.error || !signed.data) throw new Error(`The upload could not be prepared: ${signed.error?.message ?? "unknown error"}`);
    return { fileId: file_id, path, token: signed.data.token };
  });

/** A link to one photo that works for 60 seconds. The database checks permission and the switch, and audits the view. */
export const idPhotoViewLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: { fileId: string; propertyId: string }) => ({ fileId: String(i?.fileId ?? ""), propertyId: String(i?.propertyId ?? "") }))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as Rpc;
    const opened = await rpc("open_id_photo", { p_file_id: data.fileId, p_property_id: data.propertyId });
    if (opened.error) throw new Error(opened.error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const signed = await supabaseAdmin.storage.from(ID_PHOTO_BUCKET).createSignedUrl(String(opened.data), VIEW_SECONDS);
    if (signed.error || !signed.data) throw new Error(`The photo could not be opened: ${signed.error?.message ?? "unknown error"}`);
    return { url: signed.data.signedUrl, seconds: VIEW_SECONDS };
  });

/**
 * Removes from storage the files of one guest that the database has already marked for deletion (after a manager
 * deletes a photo, or the guest is anonymised). Only marked files are touched; the daily clean-up catches the rest.
 */
export const purgeGuestIdPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: { guestId: string }) => ({ guestId: String(i?.guestId ?? "") }))
  .handler(async ({ data, context }) => {
    // The guest must belong to the caller's hotel (row-level security on guests).
    const { data: guest, error } = await context.supabase.from("guests").select("id").eq("id", data.guestId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!guest) throw new Error("Guest not found.");
    const { removeMarkedIdPhotos } = await import("@/lib/id-photos.server");
    return removeMarkedIdPhotos({ guestId: data.guestId });
  });
