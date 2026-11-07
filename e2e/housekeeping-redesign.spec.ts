// Requirements: HK-015, HK-016, HK-017
// The housekeeping board, My tasks and Inspections after the redesign. Local Supabase only.
import { test, expect } from "@playwright/test";
import { setUpRoomsAndRates, signInAndCreateHotel, toasts } from "./helpers";

async function makeTasks(page: import("@playwright/test").Page) {
  const failures = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const out: string[] = [];
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const me = (ctx as { user_id: string }).user_id;
    const { data: rooms } = await supabase.from("rooms").select("id, room_number").order("room_number");
    const make = async (room: string, type: string, priority: string, assign: boolean) => {
      const { data: id, error } = await supabase.rpc("create_hk_task" as never, { p_room_id: room, p_type: type, p_priority: priority } as never);
      if (error) { out.push(`create_hk_task: ${error.message}`); return; }
      if (assign) {
        const { error: ae } = await supabase.rpc("assign_hk_task" as never, { p_id: id, p_assignee_id: me } as never);
        if (ae) out.push(`assign_hk_task: ${ae.message}`);
      }
    };
    await make(rooms![0]!.id, "deep_clean", "urgent", false);
    await make(rooms![1]!.id, "stayover", "normal", true);
    return out;
  });
  expect(failures, "set-up calls").toEqual([]);
}

test("[HK-015] the board shows what needs attention, the workload and the tiles", async ({ page }) => {
  await signInAndCreateHotel(page, "hkredo1");
  await setUpRoomsAndRates(page);
  await makeTasks(page);
  await page.goto("/housekeeping");
  const attention = page.locator("section").filter({ has: page.getByRole("heading", { name: /^Needs attention/ }) });
  await expect(attention).toBeVisible({ timeout: 10_000 });
  await expect(attention.getByText("Nobody assigned yet")).toBeVisible();
  await expect(attention.getByRole("button", { name: "Assign" })).toBeVisible();
  const load = page.locator("section").filter({ has: page.getByRole("heading", { name: "Workload" }) });
  await expect(load.getByText("1 to do · 0 working")).toBeVisible();
  await expect(page.getByText("To clean", { exact: true })).toBeVisible();
  await expect(page.getByText("Waiting inspection", { exact: true }).first()).toBeVisible();
  // Assigning from the list clears the row.
  await attention.getByRole("button", { name: "Assign" }).click();
  await expect(page.getByRole("dialog", { name: /Assign/ })).toBeVisible();
});

test("[HK-016] My tasks shows progress, Next up and the room's floor", async ({ page }) => {
  await signInAndCreateHotel(page, "hkredo2");
  await setUpRoomsAndRates(page);
  await makeTasks(page);
  await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const me = (ctx as { user_id: string }).user_id;
    const { data: t } = await supabase.from("hk_tasks").select("id").eq("type", "deep_clean").single();
    await supabase.rpc("assign_hk_task" as never, { p_id: (t as { id: string }).id, p_assignee_id: me } as never);
  });
  await page.goto("/housekeeping/my-tasks");
  await expect(page.getByText("0 of 2 rooms done today")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Floor 1" })).toBeVisible();
  await expect(page.getByText("Next up")).toHaveCount(1);
  await page.getByRole("button", { name: "Start" }).first().click();
  await expect(toasts(page).filter({ hasText: "Task started." })).toBeVisible();
  await expect(page.getByText(/0 of \d+ ticked/)).toBeVisible();
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: "Complete" }).click();
  await expect(toasts(page).filter({ hasText: "Done. Waiting for inspection." })).toBeVisible();
  await expect(page.getByText("1 of 2 rooms done today")).toBeVisible({ timeout: 10_000 });
});

test("[HK-017] inspections show a card for each cleaned room and keep the own-room rule", async ({ page }) => {
  await signInAndCreateHotel(page, "hkredo3");
  await setUpRoomsAndRates(page);
  const failures = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const out: string[] = [];
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const me = (ctx as { user_id: string }).user_id;
    const { data: rooms } = await supabase.from("rooms").select("id").limit(1);
    const { data: id, error } = await supabase.rpc("create_hk_task" as never, { p_room_id: rooms![0]!.id, p_type: "turnover", p_priority: "normal" } as never);
    if (error) return [error.message];
    for (const [fn, args] of [["assign_hk_task", { p_id: id, p_assignee_id: me }], ["start_hk_task", { p_id: id }]] as const) {
      const { error: e } = await supabase.rpc(fn as never, args as never);
      if (e) out.push(`${fn}: ${e.message}`);
    }
    const { data: t } = await supabase.from("hk_tasks").select("checklist").eq("id", id as string).single();
    const list = ((t as { checklist: { label: string }[] }).checklist ?? []).map((i) => ({ ...i, done: true }));
    const { error: ce } = await supabase.rpc("complete_hk_task" as never, { p_id: id, p_checklist: list, p_notes: null } as never);
    if (ce) out.push(`complete_hk_task: ${ce.message}`);
    return out;
  });
  expect(failures, "set-up calls").toEqual([]);
  await page.goto("/housekeeping/inspections");
  await expect(page.getByText("You cleaned this room")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Checklist: \d+ of \d+ ticked/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Pass" })).toHaveCount(0);
});
