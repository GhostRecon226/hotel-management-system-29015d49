// QA-11: every main screen opens for a hotel owner and shows its heading, with no error page. Local Supabase only.
import { test, expect } from "@playwright/test";
import { signInAndCreateHotel, setUpRoomsAndRates } from "./helpers";

const screens: { path: string; heading: string }[] = [
  { path: "/housekeeping", heading: "Housekeeping" },
  { path: "/housekeeping/inspections", heading: "Inspections" },
  { path: "/housekeeping/lost-found", heading: "Lost and found" },
  { path: "/maintenance", heading: "Maintenance" },
  { path: "/approvals", heading: "Approvals" },
  { path: "/cashier", heading: "Cashier shift" },
  { path: "/reservations/groups", heading: "Group bookings" },
  { path: "/reservations/availability", heading: "Availability" },
  { path: "/guests", heading: "Guests" },
  { path: "/reports", heading: "Reports" },
  { path: "/service-requests", heading: "Service requests" },
  { path: "/rooms", heading: "Rooms" },
  { path: "/admin", heading: "Admin" },
];

test("QA-11 each main screen opens for the owner without an error page", async ({ page }) => {
  await signInAndCreateHotel(page, "screensmoke");
  await setUpRoomsAndRates(page);
  const problems: string[] = [];
  for (const s of screens) {
    await page.goto(s.path);
    const heading = page.getByRole("heading", { name: s.heading, exact: true }).first();
    try {
      await expect(heading).toBeVisible({ timeout: 10_000 });
    } catch {
      problems.push(`${s.path}: no "${s.heading}" heading`);
      continue;
    }
    if (await page.getByText("Something went wrong on our end").count()) problems.push(`${s.path}: error page`);
  }
  expect(problems).toEqual([]);
});
