// First screen after sign-in (FO-015): a front desk officer lands on Front Desk, managers on the Dashboard. No browser, no network.
import { test, expect } from "@playwright/test";
import { landingPath } from "../src/lib/landing";

const at = (permissions: Record<string, "Y" | "L" | "O">) => ({ id: "p", name: "P", code: "P", business_date: "2026-11-06", base_currency: "NGN", timezone: "Africa/Lagos", permissions });

test("[FO-015] a front desk officer lands on Front Desk", () => {
  expect(landingPath({ properties: [at({ "fo.view": "Y", "fo.checkin": "Y", "fo.checkout": "Y", "res.view": "Y", "guest.view": "Y" })] })).toBe("/front-desk");
});

test("[FO-015] anyone with reports, admin or setup rights lands on the Dashboard", () => {
  expect(landingPath({ properties: [at({ "fo.checkin": "Y", "rpt.operations.view": "Y" })] })).toBe("/dashboard");
  expect(landingPath({ properties: [at({ "fo.checkin": "Y", "adm.user.manage": "Y" })] })).toBe("/dashboard");
  expect(landingPath({ properties: [at({ "fo.checkin": "Y", "setup.room.manage": "Y" })] })).toBe("/dashboard");
});

test("[FO-015] staff who cannot check guests in land on the Dashboard", () => {
  expect(landingPath({ properties: [at({ "fo.view": "Y", "fin.folio.view": "Y" })] })).toBe("/dashboard");
  expect(landingPath({ properties: [at({})] })).toBe("/dashboard");
  expect(landingPath({ properties: [] })).toBe("/dashboard");
  expect(landingPath({})).toBe("/dashboard");
});

test("[FO-015] a manager at any one property keeps the Dashboard", () => {
  expect(landingPath({ properties: [at({ "fo.checkin": "Y" }), at({ "fo.checkin": "Y", "rpt.finance.view": "Y" })] })).toBe("/dashboard");
});
