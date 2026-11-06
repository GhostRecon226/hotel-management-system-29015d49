import type { MyContext } from "@/lib/access";

/**
 * Where a person lands after signing in. A front desk officer (can check guests in, holds no report, admin or setup
 * permission) goes to Front Desk. Managers, owners and everyone else go to the Dashboard. The rule reads permissions, not
 * role names, so a hotel's own copy of the Front Desk Officer role lands the same way (FO-015).
 */
export function landingPath(ctx: Pick<MyContext, "properties">): "/front-desk" | "/dashboard" {
  const keys = (ctx.properties ?? []).flatMap((p) => Object.keys(p.permissions));
  const isDesk = keys.includes("fo.checkin") && !keys.some((k) => /^(rpt|adm|setup)\./.test(k));
  return isDesk ? "/front-desk" : "/dashboard";
}
