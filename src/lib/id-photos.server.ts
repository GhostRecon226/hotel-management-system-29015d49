// Server only. Removes ID photo files from storage once the database has marked them (keep period ended,
// anonymised guest, deleted by a manager, replaced, or an upload that never finished). Service role.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "guest-id-documents";

export async function removeMarkedIdPhotos({ guestId = null, limit = 200 }: { guestId?: string | null; limit?: number } = {}) {
  const due = await (supabaseAdmin.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
    "id_photo_cleanup_due", { p_guest_id: guestId, p_limit: limit });
  if (due.error) throw new Error(due.error.message);
  const rows = (due.data ?? []) as { file_id: string; path: string }[];
  if (rows.length === 0) return { removed: 0 };
  const removed = await supabaseAdmin.storage.from(BUCKET).remove(rows.map((r) => r.path));
  if (removed.error) throw new Error(removed.error.message);
  // A file already gone from storage counts as removed too.
  const done = await (supabaseAdmin.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
    "id_photo_files_removed", { p_ids: rows.map((r) => r.file_id) });
  if (done.error) throw new Error(done.error.message);
  return { removed: Number(done.data ?? 0) };
}
