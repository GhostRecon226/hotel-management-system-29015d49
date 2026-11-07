// First screen after sign-in for housekeeping, maintenance and cashier staff (HK-014). No browser, no network.
import { test, expect } from "@playwright/test";
import { landingPath } from "../src/lib/landing";

const at = (keys: string[]) => ({
  id: "p", name: "P", code: "P", business_date: "2026-11-07", base_currency: "NGN", timezone: "Africa/Lagos",
  permissions: Object.fromEntries(keys.map((k) => [k, "Y" as const])),
});
const ctx = (...keys: string[]) => ({ properties: [at(keys)] });

test("[HK-014] a housekeeping supervisor lands on the Housekeeping board", () => {
  expect(landingPath(ctx("hk.view", "hk.inspect", "hk.task.assign", "hk.task.complete", "mnt.view", "room.view", "rpt.operations.view"))).toBe("/housekeeping");
});

test("[HK-014] a room attendant lands on My tasks", () => {
  expect(landingPath(ctx("hk.view", "hk.task.complete", "hk.minibar.record", "mnt.ticket.create", "room.view"))).toBe("/housekeeping/my-tasks");
});

test("[HK-014] a maintenance officer lands on Maintenance", () => {
  expect(landingPath(ctx("mnt.view", "mnt.ticket.work", "mnt.ticket.close", "mnt.ticket.create", "room.view", "room.ooo.set"))).toBe("/maintenance");
});

test("[HK-014] a cashier lands on the Cashier shift", () => {
  expect(landingPath(ctx("fin.payment.post", "fin.charge.post", "fin.shift.close", "fin.folio.view", "fo.view", "guest.view"))).toBe("/cashier");
});

test("[HK-014] admin, setup and finance report rights keep the Dashboard", () => {
  expect(landingPath(ctx("hk.task.assign", "adm.user.manage"))).toBe("/dashboard");
  expect(landingPath(ctx("hk.task.complete", "setup.room.manage"))).toBe("/dashboard");
  expect(landingPath(ctx("fin.payment.post", "fin.shift.close", "rpt.finance.view"))).toBe("/dashboard");
  expect(landingPath(ctx("fin.payment.post", "fin.shift.close", "rpt.operations.view"))).toBe("/dashboard");
});

test("[HK-014] the front desk rule still wins over housekeeping rights", () => {
  expect(landingPath(ctx("fo.checkin", "hk.view", "hk.task.assign"))).toBe("/front-desk");
});

test("[HK-014] no permissions lands on the Dashboard", () => {
  expect(landingPath(ctx())).toBe("/dashboard");
  expect(landingPath({ properties: [] })).toBe("/dashboard");
});
