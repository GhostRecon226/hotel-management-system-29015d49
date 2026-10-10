// Server functions for maintenance ticket photos (MNT-004). The database checks permission and the photo first
// (as the signed-in user); only then does the server use the service role to sign a storage link.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TICKET_PHOTO_BUCKET = "maintenance-photos";
const VIEW_SECONDS = 60;

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

/** Step 1: reserve a file name in the database, then sign a one-time upload link for exactly that name. */
export const startTicketPhotoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: { ticketId: string; mime: string; size: number }) => ({
    ticketId: String(i?.ticketId ?? ""), mime: String(i?.mime ?? ""), size: Number(i?.size ?? 0),
  }))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as Rpc;
    const begun = await rpc("begin_ticket_photo_upload", { p_ticket_id: data.ticketId, p_mime: data.mime, p_size: data.size });
    if (begun.error) throw new Error(begun.error.message);
    const { file_id, path } = begun.data as { file_id: string; path: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const signed = await supabaseAdmin.storage.from(TICKET_PHOTO_BUCKET).createSignedUploadUrl(path);
    if (signed.error || !signed.data) throw new Error(`The upload could not be prepared: ${signed.error?.message ?? "unknown error"}`);
    return { fileId: file_id, path, token: signed.data.token };
  });

/** A link to one photo that works for 60 seconds. The database checks permission and audits the view. */
export const ticketPhotoViewLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: { fileId: string }) => ({ fileId: String(i?.fileId ?? "") }))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as Rpc;
    const opened = await rpc("open_ticket_photo", { p_file_id: data.fileId });
    if (opened.error) throw new Error(opened.error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const signed = await supabaseAdmin.storage.from(TICKET_PHOTO_BUCKET).createSignedUrl(String(opened.data), VIEW_SECONDS);
    if (signed.error || !signed.data) throw new Error(`The photo could not be opened: ${signed.error?.message ?? "unknown error"}`);
    return { url: signed.data.signedUrl, seconds: VIEW_SECONDS };
  });

/** Removes from storage the photos the database has already marked (after a removal). The daily clean-up catches the rest. */
export const purgeTicketPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { removeMarkedTicketPhotos } = await import("@/lib/ticket-photos.server");
    return removeMarkedTicketPhotos({ limit: 50 });
  });
