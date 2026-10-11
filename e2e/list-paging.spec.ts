// Requirements: PAG-001. A long guest list loads 50 at a time; Load more adds the rest with no repeats.
import { test, expect } from "@playwright/test";
import { signInAndCreateHotel } from "./helpers";

test("guest list: Load more shows the next page", async ({ page }) => {
  test.setTimeout(150_000);
  await signInAndCreateHotel(page, "paging");
  const made = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    let failed = 0;
    for (let i = 0; i < 53; i++) {
      const { error } = await supabase.rpc("save_guest" as never, {
        p_id: null, p_first_name: "Page", p_last_name: `Guest${String(i).padStart(2, "0")}`, p_phone: null, p_email: null,
        p_nationality: "NG", p_address: null, p_notes: null,
      } as never);
      if (error) failed++;
    }
    return failed;
  });
  expect(made, "guests that failed to save").toBe(0);

  await page.goto("/guests");
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(50, { timeout: 15_000 });
  await expect(page.getByText("Showing 50")).toBeVisible();
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(rows).toHaveCount(53, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Load more" })).toBeHidden();
  const names = await rows.locator("a").allTextContents();
  expect(new Set(names).size, "no guest shown twice").toBe(53);
});
