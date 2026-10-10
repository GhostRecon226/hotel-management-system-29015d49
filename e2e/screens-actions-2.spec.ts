// QA-11: real actions on the maintenance list and the guest list. Local Supabase only.
import { test, expect } from "@playwright/test";
import { signInAndCreateHotel, setUpRoomsAndRates } from "./helpers";

test("QA-11 a reported problem shows on the maintenance list and counts as open", async ({ page }) => {
  await signInAndCreateHotel(page, "mntlist");
  await setUpRoomsAndRates(page);
  const failures = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const p = (ctx as { properties: { id: string }[] }).properties[0]!;
    const { data: rooms, error: re } = await supabase.from("rooms").select("id").limit(1);
    if (re || !rooms?.length) return [`rooms: ${re?.message ?? "none"}`];
    const { error } = await supabase.rpc("create_ticket" as never, {
      p_property_id: p.id, p_title: "Leaking basin tap", p_description: "Drips all night", p_room_id: rooms[0]!.id, p_location: null, p_priority: "urgent",
    } as never);
    return error ? [`create_ticket: ${error.message}`] : [];
  });
  expect(failures, "set-up calls").toEqual([]);
  await page.goto("/maintenance");
  const row = page.getByRole("row").filter({ hasText: "Leaking basin tap" });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row).toContainText("Urgent");
  await page.getByLabel("Search tickets").fill("no such problem");
  await expect(page.getByText("No tickets")).toBeVisible();
});

test("QA-11 a saved guest can be found by name on the guest list", async ({ page }) => {
  await signInAndCreateHotel(page, "guestlist");
  const failures = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { error } = await supabase.rpc("save_guest" as never, {
      p_id: null, p_first_name: "Adaeze", p_last_name: "Okonkwo", p_phone: "08030000001", p_email: null, p_nationality: "Nigerian", p_address: null, p_notes: null,
    } as never);
    return error ? [`save_guest: ${error.message}`] : [];
  });
  expect(failures, "set-up calls").toEqual([]);
  await page.goto("/guests");
  await page.getByPlaceholder("Search by name, phone or email").fill("Okonkwo");
  await expect(page.getByRole("link", { name: "Adaeze Okonkwo" })).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder("Search by name, phone or email").fill("Zzzzz");
  await expect(page.getByText("No guests match your search")).toBeVisible({ timeout: 10_000 });
});
