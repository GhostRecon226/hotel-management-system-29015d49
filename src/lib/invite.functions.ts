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
  tempPassword: string | null;
}

function randomPassword() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return `Hd-${btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}9!`;
}

/**
 * Invites a staff member: creates the sign-in account, registers the profile in
 * the inviter's hotel, then gives them their role. All hotel-side rules
 * (permission, escalation, plan limits) are enforced by the database functions,
 * which run as the signed-in inviter.
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
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find an existing account with this email, otherwise create one.
    let userId: string | null = null;
    let emailed = false;
    let tempPassword: string | null = null;

    const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    userId = existing?.users?.find((u) => u.email?.toLowerCase() === data.email)?.id ?? null;

    let createdUserId: string | null = null;
    if (!userId) {
      const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        ...(data.redirectTo ? { redirectTo: data.redirectTo } : {}),
        data: { full_name: data.fullName },
      });
      if (!invited.error && invited.data?.user) {
        userId = invited.data.user.id;
        emailed = true;
      } else {
        tempPassword = randomPassword();
        const created = await supabaseAdmin.auth.admin.createUser({
          email: data.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: data.fullName },
        });
        if (created.error || !created.data.user) {
          throw new Error(created.error?.message ?? "Could not create the sign-in account.");
        }
        userId = created.data.user.id;
      }
      createdUserId = userId;
    }

    try {
      const reg = await supabase.rpc("register_invited_user", {
        p_user_id: userId,
        p_full_name: data.fullName,
        p_phone: data.phone ?? undefined,
      });
      if (reg.error) throw new Error(reg.error.message);

      const role = await supabase.rpc("assign_role", {
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

    return { userId: userId!, emailed, tempPassword };
  });
