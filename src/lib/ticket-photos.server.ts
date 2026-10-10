// Server only. Removes maintenance photo files from storage once the database has marked them (removed by
// staff, or an upload that never finished). Service role.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "maintenance-photos";
type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

export async function removeMarkedTicketPhotos({ limit = 200 }: { limit?: number } = {}) {
  const rpc = supabaseAdmin.rpc as unknown as Rpc;
  const due = await rpc("ticket_photo_cleanup_due", { p_limit: limit });
  if (due.error) throw new Error(due.error.message);
  const rows = (due.data ?? []) as { file_id: string; path: string }[];
  if (rows.length === 0) return { removed: 0 };
  const removed = await supabaseAdmin.storage.from(BUCKET).remove(rows.map((r) => r.path));
  if (removed.error) throw new Error(removed.error.message);
  const done = await rpc("ticket_photo_files_removed", { p_ids: rows.map((r) => r.file_id) });
  if (done.error) throw new Error(done.error.message);
  return { removed: Number(done.data ?? 0) };
}
