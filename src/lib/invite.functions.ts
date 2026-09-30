import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface InviteInput {
  email: string;
  fullName: string;
  phone?: string | null;
  propertyId: string;
  roleId: string;
  redirectTo: string;
}

export interface InviteResult {
  userId: string;
  emailed: boolean;
}

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

/** Refuses unless the signed-in user may manage staff. Runs before anything else touches accounts or email. */
async function requireStaffManager(rpc: Rpc, propertyId: string | null) {
  const { error } = await rpc("require_permission", { p_key: "adm.user.manage", p_property_id: propertyId });
  if (error) throw new Error(error.message);
}

/**
 * Invites a staff member. Order matters:
 * 1. the inviter's permission is checked first, so nobody else can make the system send email;
 * 2. an existing sign-in account is looked up by email;
 * 3. otherwise an invite email is sent (no temporary passwords: if email fails, nothing is created);
 * 4. the profile and role are registered as the inviter, so hotel rules (escalation, plan limits) apply.
 * An account created here is deleted again if step 4 fails.
 */
export const inviteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: InviteInput) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    const fullName = String(input?.fullName ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (!fullName) throw new Error("Enter the person's full name.");
    if (!input?.propertyId || !input?.roleId) throw new Error("Choose a property and a role.");
    return {
      email,
      fullName,
      phone: input.phone ? String(input.phone).trim() : null,
      propertyId: String(input.propertyId),
      roleId: String(input.roleId),
      redirectTo: String(input.redirectTo ?? ""),
    };
  })
  .handler(async ({ data, context }): Promise<InviteResult> => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as Rpc;
    await requireStaffManager(rpc, data.propertyId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminRpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as Rpc;

    const found = await adminRpc("find_user_id_by_email", { p_email: data.email });
    if (found.error) throw new Error(found.error.message);
    let userId = (found.data as string | null) ?? null;

    let createdUserId: string | null = null;
    let emailed = false;
    if (!userId) {
      const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        ...(data.redirectTo ? { redirectTo: data.redirectTo } : {}),
        data: { full_name: data.fullName },
      });
      if (invited.error || !invited.data?.user) {
        throw new Error(`The invitation email could not be sent: ${invited.error?.message ?? "unknown error"}. Nothing was created. Try again later.`);
      }
      userId = invited.data.user.id;
      createdUserId = userId;
      emailed = true;
    }

    try {
      const reg = await rpc("register_invited_user", {
        p_user_id: userId,
        p_full_name: data.fullName,
        p_phone: data.phone,
      });
      if (reg.error) throw new Error(reg.error.message);

      const role = await rpc("assign_role", {
        p_user_id: userId,
        p_property_id: data.propertyId,
        p_role_id: data.roleId,
      });
      if (role.error) throw new Error(role.error.message);
    } catch (e) {
      // Never leave an orphan sign-in account behind.
      if (createdUserId) await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => undefined);
      throw e;
    }

    return { userId: userId!, emailed };
  });

/** Sends the invitation email again to a staff member who has not accepted it yet. */
export const resendStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; redirectTo: string }) => {
    if (!input?.userId) throw new Error("Choose a staff member.");
    return { userId: String(input.userId), redirectTo: String(input.redirectTo ?? "") };
  })
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as Rpc;
    await requireStaffManager(rpc, null);

    // Row-level security only returns profiles of the caller's own hotel.
    const { data: profile, error } = await context.supabase.from("profiles").select("id").eq("id", data.userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Staff member not found.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminRpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as Rpc;
    const pending = await adminRpc("invite_pending", { p_user_id: data.userId });
    if (pending.error) throw new Error(pending.error.message);
    if (!pending.data) throw new Error("This person has already accepted the invitation.");

    const account = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = account.data.user?.email;
    if (account.error || !email) throw new Error("The sign-in account could not be found.");

    const sent = await supabaseAdmin.auth.admin.inviteUserByEmail(email, data.redirectTo ? { redirectTo: data.redirectTo } : {});
    if (sent.error) throw new Error(`The invitation email could not be sent: ${sent.error.message}`);
    return { emailed: true };
  });
