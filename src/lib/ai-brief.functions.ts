import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runBrief, type BriefResult } from "@/lib/ai-brief";

/**
 * Owner's morning brief. The database checks permission, the on/off switch and the monthly limit, and returns the
 * only facts that may leave it (counts and money, no guest details). The provider key stays on the server.
 */
export const getMorningBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { propertyId: string }) => {
    if (!input?.propertyId) throw new Error("Choose a property.");
    return { propertyId: String(input.propertyId) };
  })
  .handler(async ({ data, context }): Promise<BriefResult & { lines: string[] }> => {
    const { data: start, error } = await context.supabase.rpc("ai_morning_brief_start", { p_property_id: data.propertyId });
    if (error) throw new Error(error.message);
    const { usage_id, facts } = start as { usage_id: string; facts: { lines: string[] } };
    try {
      const result = await runBrief(facts.lines, {
        ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"], ANTHROPIC_API_URL: process.env["ANTHROPIC_API_URL"], AI_MODEL: process.env["AI_MODEL"],
      });
      await context.supabase.rpc("ai_call_finish", { p_usage_id: usage_id, p_ok: true });
      return { ...result, lines: facts.lines };
    } catch (e) {
      await context.supabase.rpc("ai_call_finish", { p_usage_id: usage_id, p_ok: false });
      throw e;
    }
  });
