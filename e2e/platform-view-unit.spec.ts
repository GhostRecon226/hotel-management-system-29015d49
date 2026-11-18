// Requirements: PLT-036, PLT-037, PLT-038. Platform console helpers. No browser, no network.
import { test, expect } from "@playwright/test";
import type { FailedPayment, PlatformSummary, PlatformTenant } from "../src/lib/platform";
import { callsToday, filterTenants, nextDate, nextStep, readOnlyOn, statusCounts } from "../src/lib/platform-view";

const NOW = Date.parse("2026-11-18T10:00:00Z");
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString();
let n = 0;
const tenant = (o: Partial<PlatformTenant>): PlatformTenant => ({
  tenant_id: `t${++n}`, hotel_name: `Hotel ${n}`, country: "Nigeria", access_status: "active", subscription_status: "active", plan_code: "standard", plan_name: "Standard",
  trial_ends_at: null, paid_until: null, created_at: day(-60), properties: 1, rooms: 10, active_users: 3, last_change_at: null, ...o,
});
const pay = (o: Partial<FailedPayment>): FailedPayment => ({
  payment_id: `p${++n}`, created_at: day(-1), tenant_id: "x", tenant_name: "X", plan_code: "standard", period: "month", amount: 50000, currency: "NGN", status: "failed", reference: "ref1", failure_reason: null, ...o,
});
const quiet = (id: string, days: number | null): PlatformSummary["quiet"][number] => ({ tenant_id: id, hotel_name: id, country: "Nigeria", last_sign_in_at: null, days_inactive: days });

test("[PLT-036] calls today: trials ending, past due, failed and waiting payments, quiet hotels, in that order", () => {
  const list = [
    tenant({ tenant_id: "quiet", hotel_name: "Quiet", subscription_status: "active", paid_until: day(60) }),
    tenant({ tenant_id: "late", hotel_name: "Late", subscription_status: "past_due", paid_until: day(-5) }),
    tenant({ tenant_id: "soon", hotel_name: "Soon", subscription_status: "trial", trial_ends_at: day(2) }),
    tenant({ tenant_id: "far", hotel_name: "Far", subscription_status: "trial", trial_ends_at: day(40) }),
    tenant({ tenant_id: "paid", hotel_name: "Paid", subscription_status: "active", paid_until: day(90) }),
  ];
  const calls = callsToday(list, [pay({ tenant_id: "paid", tenant_name: "Paid", status: "pending" }), pay({ tenant_id: "paid", tenant_name: "Paid", status: "failed", failure_reason: "Card declined" })], [quiet("quiet", 12)], NOW);
  expect(calls.map((c) => [c.kind, c.tenantId])).toEqual([["trial", "soon"], ["past_due", "late"], ["payment_failed", "paid"], ["payment_waiting", "paid"], ["quiet", "quiet"]]);
  expect(calls[0]!.days).toBe(2);
  expect(calls[2]!.detail).toContain("Card declined");
});

test("[PLT-036] the soonest trial comes first, and a trial ending today is a call", () => {
  const calls = callsToday([tenant({ tenant_id: "a", subscription_status: "trial", trial_ends_at: day(9) }), tenant({ tenant_id: "b", subscription_status: "trial", trial_ends_at: day(0.2) })], [], [], NOW);
  expect(calls.map((c) => c.tenantId)).toEqual(["b", "a"]);
});

test("[PLT-036] a hotel that never signed in has no day count and still shows as quiet", () => {
  const [c] = callsToday([tenant({ tenant_id: "q" })], [], [quiet("q", null)], NOW);
  expect(c!.kind).toBe("quiet");
  expect(c!.days).toBeNull();
});

test("[PLT-037] status counts, status filter and search by name or country", () => {
  const list = [
    tenant({ hotel_name: "Lekki Palms", subscription_status: "trial" }), tenant({ hotel_name: "Abuja Crown", subscription_status: "past_due" }),
    tenant({ hotel_name: "Accra Gardens", country: "Ghana", subscription_status: "active" }), tenant({ hotel_name: "Ibadan Lodge", subscription_status: "active" }),
  ];
  expect(statusCounts(list)).toEqual({ all: 4, trial: 1, past_due: 1, active: 2 });
  expect(filterTenants(list, "active", "").map((t) => t.hotel_name)).toEqual(["Accra Gardens", "Ibadan Lodge"]);
  expect(filterTenants(list, "all", "ghana").map((t) => t.hotel_name)).toEqual(["Accra Gardens"]);
  expect(filterTenants(list, "all", "  CROWN ").map((t) => t.hotel_name)).toEqual(["Abuja Crown"]);
  expect(filterTenants(list, "trial", "abuja")).toEqual([]);
});

test("[PLT-038] a past-due hotel goes read-only 14 days after its period ended", () => {
  expect(readOnlyOn("2026-11-13T23:59:59Z")).toBe("2026-11-27");
  expect(readOnlyOn(null)).toBeNull();
});

test("[PLT-038] the next step names the situation and the main action", () => {
  expect(nextStep(tenant({ subscription_status: "trial", trial_ends_at: day(2) }), NOW)).toMatchObject({ kind: "trial_ending", days: 2, main: "activate" });
  expect(nextStep(tenant({ subscription_status: "trial", trial_ends_at: day(40) }), NOW)).toMatchObject({ kind: "trial", days: 40, main: "activate" });
  expect(nextStep(tenant({ subscription_status: "past_due", paid_until: day(-5) }), NOW)).toMatchObject({ kind: "past_due", date: "2026-11-27", main: "activate" });
  expect(nextStep(tenant({ subscription_status: "suspended" }), NOW)).toMatchObject({ kind: "suspended", main: "activate" });
  expect(nextStep(tenant({ subscription_status: "cancelled" }), NOW)).toMatchObject({ kind: "cancelled", main: "activate" });
  expect(nextStep(tenant({ subscription_status: "expired" }), NOW)).toMatchObject({ kind: "expired", main: "activate" });
  expect(nextStep(tenant({ subscription_status: "active", paid_until: day(90) }), NOW)).toMatchObject({ kind: "active", main: null });
  expect(nextStep(tenant({ subscription_status: "active", paid_until: day(6) }), NOW)).toMatchObject({ kind: "active_ending", days: 6, main: "activate" });
});

test("[PLT-037] the next date column says what matters for each status", () => {
  expect(nextDate(tenant({ subscription_status: "trial", trial_ends_at: day(2) }), NOW)).toEqual({ label: "2 days left", date: day(2) });
  expect(nextDate(tenant({ subscription_status: "past_due", paid_until: day(-5) }), NOW)).toEqual({ label: "Read-only on", date: "2026-11-27" });
  expect(nextDate(tenant({ subscription_status: "active", paid_until: day(90) }), NOW)).toEqual({ label: "Paid until", date: day(90) });
  expect(nextDate(tenant({ subscription_status: "suspended", last_change_at: day(-17) }), NOW)).toEqual({ label: "Since", date: day(-17) });
  expect(nextDate(tenant({ subscription_status: "active" }), NOW)).toBeNull();
});
