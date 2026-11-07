import type { MyContext } from "@/lib/access";

export type LandingPath = "/front-desk" | "/housekeeping" | "/housekeeping/my-tasks" | "/maintenance" | "/cashier" | "/dashboard";

/**
 * Where a person lands after signing in. The rule reads permissions, not role names, so a hotel's own copy of a built-in
 * role lands the same way (FO-015, HK-014).
 * - Front desk officer (checks guests in, no report, admin or setup right): Front Desk.
 * - Housekeeping supervisor (assigns tasks): the Housekeeping board. Room attendant (completes tasks only): My tasks.
 * - Maintenance officer (works tickets): Maintenance. Cashier (posts payments and closes a shift): Cashier.
 * - Managers, owners, accountants and everyone else: the Dashboard.
 * A person with admin, setup or finance reporting rights always gets the Dashboard.
 */
export function landingPath(ctx: Pick<MyContext, "properties">): LandingPath {
  const keys = (ctx.properties ?? []).flatMap((p) => Object.keys(p.permissions));
  const has = (k: string) => keys.includes(k);
  const any = (re: RegExp) => keys.some((k) => re.test(k));
  if (any(/^(adm|setup)\./) || has("rpt.finance.view")) return "/dashboard";
  if (has("fo.checkin")) return any(/^rpt\./) ? "/dashboard" : "/front-desk";
  if (has("hk.task.assign")) return "/housekeeping";
  if (has("hk.task.complete")) return "/housekeeping/my-tasks";
  if (has("mnt.ticket.work")) return "/maintenance";
  if (has("fin.shift.close") && has("fin.payment.post") && !any(/^rpt\./)) return "/cashier";
  return "/dashboard";
}
