// Requirements: RPT-011, RPT-012
// Report period buttons and the change notes on the Dashboard. No browser, no network.
import { test, expect } from "@playwright/test";
import { matchingPeriod, periodRange } from "../src/lib/report-periods";
import { changeDirection, changeText } from "../src/lib/change-note";

test("[RPT-011] period buttons give the right dates from the business date", () => {
  const bd = "2026-11-08";
  expect(periodRange("yesterday", bd)).toEqual({ from: "2026-11-07", to: "2026-11-07" });
  expect(periodRange("7", bd)).toEqual({ from: "2026-11-01", to: "2026-11-07" });
  expect(periodRange("30", bd)).toEqual({ from: "2026-10-09", to: "2026-11-07" });
  expect(periodRange("month", bd)).toEqual({ from: "2026-11-01", to: "2026-11-08" });
});

test("[RPT-011] the matching period lights up, and typed dates light none", () => {
  const bd = "2026-11-08";
  expect(matchingPeriod(periodRange("30", bd), bd)).toBe("30");
  expect(matchingPeriod(periodRange("month", bd), bd)).toBe("month");
  expect(matchingPeriod({ from: "2026-11-02", to: "2026-11-05" }, bd)).toBeNull();
});

test("[RPT-011] this month on the first of the month is one day, not a backwards range", () => {
  expect(periodRange("month", "2026-12-01")).toEqual({ from: "2026-12-01", to: "2026-12-01" });
});

test("[RPT-012] a change figure shows its direction and a plain number", () => {
  expect(changeDirection(6)).toBe("up");
  expect(changeDirection("-3.5")).toBe("down");
  expect(changeDirection(0)).toBe("flat");
  expect(changeDirection(null)).toBeNull();
  expect(changeText(-3.04, " points")).toBe("3.0 points");
  expect(changeText("6", "%")).toBe("6.0%");
});
