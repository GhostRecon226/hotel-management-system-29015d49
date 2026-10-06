import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

export const TEST_ERROR_SERVER = "Hotel Desk test error, sent on purpose from the server (Setup, Property)";
export const TEST_ERROR_BROWSER = "Hotel Desk test error, sent on purpose from the browser (Setup, Property)";

/**
 * Safety net check (docs/safety-net.md): fails on purpose so the error reaches Sentry and the alert email arrives.
 * Only users who can edit the property may trigger it. Nothing is written anywhere.
 */
export const sendTestError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string }) => ({ propertyId: String(input?.propertyId ?? "") }))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as Rpc;
    const { error } = await rpc("require_permission", { p_key: "setup.property.edit", p_property_id: data.propertyId });
    if (error) throw new Error(error.message);
    throw new Error(TEST_ERROR_SERVER);
  });
