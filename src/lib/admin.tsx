import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccess, type GrantLevel } from "@/lib/access";
import { errorMessage } from "@/lib/errors";
import { callRpc } from "@/lib/setup";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const ADMIN_PERMS = ["adm.user.manage", "adm.role.manage", "adm.audit.view", "adm.subscription.manage"];

export interface AdminUserRole {
  id: string; property_id: string; property_name: string;
  role_id: string; role_code: string; role_name: string;
}
export interface AdminUser {
  id: string; full_name: string; phone: string | null; status: string;
  email: string | null; email_confirmed: boolean; last_sign_in_at: string | null;
  created_at: string; is_me: boolean; roles: AdminUserRole[];
}
export interface RolePermission { key: string; level: GrantLevel; max_amount: string | number | null }
export interface AdminRole {
  id: string; code: string; name: string; is_system: boolean;
  user_count: number; permissions: RolePermission[];
}
export interface PermissionRow { key: string; description: string; module: string }
export interface AuditRow {
  id: string; action: string; table_name: string | null; record_id: string | null;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null;
  reason: string | null; created_at: string; actor_id: string | null; actor_name: string;
}
export interface SubscriptionInfo {
  tenant_name: string; tenant_status: string; country: string; writable: boolean;
  plan_code: string; plan_name: string; status: string;
  trial_ends_at: string | null; current_period_end: string | null; trial_days_left: number | null;
  limits: { rooms: number | null; properties: number | null; users: number | null };
  usage: { rooms: number; properties: number; users: number };
  plans: { code: string; name: string; max_rooms: number | null; max_properties: number | null; max_users: number | null }[];
}

export const GRANT_LEVELS: { value: GrantLevel; label: string; hint: string }[] = [
  { value: "Y", label: "Y — Full", hint: "Can do this with no money limit." },
  { value: "L", label: "L — Up to a limit", hint: "Can do this up to the amount set in Approval limits. No limit set means zero." },
  { value: "O", label: "O — Own only", hint: "Can do this for their own records only." },
];

export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "users"], enabled,
    queryFn: () => callRpc<AdminUser[]>("admin_users", {}),
  });
}

export function useAdminRoles(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "roles"], enabled,
    queryFn: () => callRpc<AdminRole[]>("admin_roles", {}),
  });
}

export function usePermissions(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "permissions"], enabled, staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("permissions").select("key, description, module").order("module").order("key");
      if (error) throw error;
      return data as PermissionRow[];
    },
  });
}

export function useSubscriptionInfo(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "subscription"], enabled,
    queryFn: () => callRpc<SubscriptionInfo>("subscription_info", {}),
  });
}

export interface BillingPlan {
  code: string; name: string; max_rooms: number | null; max_properties: number | null; max_users: number | null;
  month: number | null; year: number | null; fits: boolean; can_buy: boolean;
}
export interface BillingPayment {
  created_at: string; plan_code: string; period: "month" | "year"; amount: number; currency: string;
  status: "pending" | "paid" | "failed"; failure_reason: string | null; paid_at: string | null;
}
export interface BillingOptions { currency: string; plans: BillingPlan[]; payments: BillingPayment[] }

/** Prices (already in whole currency, worked out by the database) and the hotel's own payments. */
export function useBillingOptions(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "billing"], enabled,
    queryFn: () => callRpc<BillingOptions>("billing_options", {}),
  });
}

/** Runs an admin database function and refreshes the admin screens. */
export function useAdminAction(name: string, success: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) => callRpc(name, args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["my-context"] });
      toast.success(success);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useMyProperties() {
  const { ctx } = useAccess();
  return ctx.properties ?? [];
}

export function moduleLabel(module: string) {
  const map: Record<string, string> = {
    admin: "Admin", reservations: "Reservations", frontdesk: "Front desk", rooms: "Rooms",
    housekeeping: "Housekeeping", maintenance: "Maintenance", guests: "Guests",
    finance: "Money", reports: "Reports", setup: "Setup",
  };
  return map[module] ?? module.charAt(0).toUpperCase() + module.slice(1);
}
