import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin "Run now": sends this hotel's due messages. Permission checked by outbox_status(). */
export const runOutboxNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("outbox_status");
    if (error) throw new Error(error.message);
    const tenantId = (data as { tenant_id: string }).tenant_id;
    const { processOutbox } = await import("./outbox.server");
    return processOutbox({ tenantId, limit: 50 });
  });
