import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runDraft, screenInput, type ImportProposal } from "@/lib/setup-import";

export type ImportPreview = {
  would_create_types: string[]; skipped_types: string[]; would_create_rooms: number; skipped_rooms: number;
  invalid: { label: string; reason: string }[]; room_limit: number | null; rooms_now: number;
};

/**
 * Setup import assistant, step 1: draft a list from pasted text and preview what would be added.
 * The database checks permission, the AI switch and the monthly limit. Nothing is added here.
 * Step 2 is the browser calling apply_setup_import, which checks the whole list again.
 */
export const draftSetupImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { propertyId: string; text: string }) => {
    if (!input?.propertyId) throw new Error("Choose a property.");
    const refusal = screenInput(String(input.text ?? ""));
    if (refusal) throw new Error(refusal);
    return { propertyId: String(input.propertyId), text: String(input.text) };
  })
  .handler(async ({ data, context }): Promise<{ proposal: ImportProposal; notes: string[]; preview: ImportPreview }> => {
    const { data: start, error } = await context.supabase.rpc("ai_import_start", { p_property_id: data.propertyId });
    if (error) throw new Error(error.message);
    const { usage_id, context: ctx } = start as { usage_id: string; context: { room_type_codes: string[] } };
    try {
      const draft = await runDraft(data.text, ctx.room_type_codes, {
        ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"], ANTHROPIC_API_URL: process.env["ANTHROPIC_API_URL"], AI_MODEL: process.env["AI_MODEL"],
      });
      const { data: preview, error: pe } = await context.supabase.rpc("apply_setup_import", {
        p_property_id: data.propertyId, p_payload: draft.proposal as never, p_preview: true,
      });
      if (pe) throw new Error(pe.message);
      await context.supabase.rpc("ai_call_finish", { p_usage_id: usage_id, p_ok: true });
      return { ...draft, preview: preview as unknown as ImportPreview };
    } catch (e) {
      await context.supabase.rpc("ai_call_finish", { p_usage_id: usage_id, p_ok: false });
      throw e;
    }
  });
