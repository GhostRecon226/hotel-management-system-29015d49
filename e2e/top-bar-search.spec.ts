// Requirements: SRC-001. The top bar search finds a guest from any screen and opens the profile.
import { test, expect } from "@playwright/test";
import { signInAndCreateHotel } from "./helpers";

test("top bar search finds a guest and opens the profile", async ({ page }) => {
  await signInAndCreateHotel(page, "search");
  const id = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { data, error } = await supabase.rpc("save_guest" as never, {
      p_id: null, p_first_name: "Searchable", p_last_name: "Zedekiah", p_phone: null, p_email: null,
      p_nationality: "NG", p_address: null, p_notes: null,
    } as never);
    if (error) throw new Error(error.message);
    return data as string;
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Search guests, bookings and rooms" }).first().click();
  await page.getByRole("textbox", { name: "Search" }).fill("Zedek");
  const hit = page.getByRole("button", { name: /Searchable Zedekiah/ });
  await expect(hit).toBeVisible({ timeout: 15_000 });
  await hit.click();
  await expect(page).toHaveURL(new RegExp(`/guests/${id}`));
});
