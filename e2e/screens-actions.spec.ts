// QA-11: real actions on screens that had no browser test: the cashier shift and the housekeeping board. Local Supabase only.
import { test, expect } from "@playwright/test";
import { signInAndCreateHotel, setUpRoomsAndRates } from "./helpers";

test("QA-11 the owner opens a cashier shift and sees it as open", async ({ page }) => {
  await signInAndCreateHotel(page, "cashieract");
  await page.goto("/cashier");
  await expect(page.getByText("Start your shift")).toBeVisible();
  await page.getByLabel(/Opening float/).fill("20000");
  await page.getByRole("button", { name: "Open shift" }).click();
  await expect(page.getByText("Your shift is open")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Close shift" })).toBeVisible();
  await expect(page.getByText("Start your shift")).toHaveCount(0);
});

test("QA-11 a new cleaning task appears in the Open column of the housekeeping board", async ({ page }) => {
  await signInAndCreateHotel(page, "hkboard");
  await setUpRoomsAndRates(page);
  const failures = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { data: rooms, error: re } = await supabase.from("rooms").select("id").limit(1);
    if (re || !rooms?.length) return [`rooms: ${re?.message ?? "none"}`];
    const { error } = await supabase.rpc("create_hk_task" as never, { p_room_id: rooms[0]!.id, p_type: "deep_clean", p_priority: "high" } as never);
    return error ? [`create_hk_task: ${error.message}`] : [];
  });
  expect(failures, "set-up calls").toEqual([]);
  await page.goto("/housekeeping");
  const open = page.locator("section").filter({ has: page.getByRole("heading", { name: /^Open/ }) });
  await expect(open.getByText("Deep clean")).toBeVisible({ timeout: 10_000 });
  await expect(open.getByText("High")).toBeVisible();
});
