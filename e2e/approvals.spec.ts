// QA-11: approvals with two people. The requester cannot approve their own request; a second person can, and it posts. Local Supabase only.
import { test, expect } from "@playwright/test";
import { signInAndCreateHotel, setUpRoomsAndRates, toasts } from "./helpers";
import { createTestUser, passwordTokens } from "./local-supabase";

test("QA-11 an adjustment waits for a second person; the requester is refused, the accountant approves and it posts", async ({ page, browser }) => {
  await signInAndCreateHotel(page, "approvals");
  await setUpRoomsAndRates(page);

  // Owner: a guest in house with a charge on the folio, then an adjustment request of -2,000.
  const setUp = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const out: string[] = [];
    const call = async (name: string, fn: string, args: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn as never, args as never);
      if (error) out.push(`${name}: ${error.message}`);
      return data as unknown;
    };
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const p = (ctx as { properties: { id: string; business_date: string }[] }).properties[0]!;
    const bd = p.business_date;
    const plus = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
    const { data: rt } = await supabase.from("room_types").select("id").eq("property_id", p.id).limit(1).single();
    const { data: rp } = await supabase.from("rate_plans").select("id").eq("property_id", p.id).limit(1).single();
    const g = await call("guest", "save_guest", { p_id: null, p_first_name: "Appr", p_last_name: "Guest", p_phone: null, p_email: null, p_nationality: "NG", p_address: null, p_notes: null });
    const res = await call("booking", "create_reservation", { p_property_id: p.id, p_idempotency_key: crypto.randomUUID(), p_guest_id: g, p_arrival: bd, p_departure: plus(bd, 2), p_room_type_id: rt!.id, p_rate_plan_id: rp!.id, p_adults: 1, p_children: 0, p_status: "confirmed", p_source: "direct", p_company_name: null, p_special_requests: null, p_notes: null, p_guarantee: "none", p_hold_until: null, p_group_id: null, p_rate_override: null, p_override_reason: null });
    const { data: rooms } = await supabase.from("rooms").select("id").eq("property_id", p.id).order("room_number").limit(1);
    await call("check-in", "check_in", { p_id: res, p_registration: { id_type: "passport", id_number: "T1", nationality: "NG" }, p_room_id: rooms![0]!.id, p_room_override_reason: null, p_deposit_waive_reason: null });
    const folio = await call("folio", "open_main_folio", { p_reservation_id: res }) as string;
    const { data: codes } = await supabase.from("charge_codes").select("id, code").eq("property_id", p.id);
    const rest = codes!.find((x) => x.code === "REST")!.id;
    await call("charge", "post_charge", { p_folio_id: folio, p_charge_code_id: rest, p_amount: 10000, p_tax_inclusive: false, p_description: "Dinner", p_reference: null, p_idempotency_key: crypto.randomUUID() });
    const { data: before } = await supabase.from("v_folio_balances").select("balance").eq("folio_id", folio).single();
    await call("request", "request_adjustment", { p_folio_id: folio, p_charge_code_id: rest, p_amount: -2000, p_reason: "Dinner was cold", p_idempotency_key: crypto.randomUUID() });
    const { data: roles } = await (supabase.from as never as (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { is: (k: string, v: null) => Promise<{ data: { id: string }[] }> } } })("roles")
      .select("id").eq("code", "ACCT").is("tenant_id", null);
    return { out, propertyId: p.id, folio, before: Number((before as { balance: string }).balance), acctRole: roles[0]!.id };
  });
  expect(setUp.out, "set-up calls").toEqual([]);

  // Owner: the request is in My requests, and approving it is refused because it is their own.
  await page.goto("/approvals");
  await page.getByRole("tab", { name: /My requests/ }).click();
  const mine = page.getByRole("row").filter({ hasText: "Dinner was cold" });
  await expect(mine).toBeVisible({ timeout: 10_000 });
  await expect(mine).toContainText("Waiting");
  await mine.getByRole("button", { name: "Approve" }).click();
  await page.getByLabel("Reason").fill("Approving my own request");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("You cannot decide your own request")).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Escape");

  // A second person with the Accountant role.
  const acct = await createTestUser("approvals-acct");
  const tokens = (await passwordTokens(acct.email, acct.password)) as unknown as { user: { id: string } };
  const staff = await page.evaluate(async ({ userId, propertyId, roleId }) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const out: string[] = [];
    const a = await supabase.rpc("register_invited_user" as never, { p_user_id: userId, p_full_name: "Ada Accountant", p_phone: null } as never);
    if (a.error) out.push(a.error.message);
    const b = await supabase.rpc("assign_role" as never, { p_user_id: userId, p_property_id: propertyId, p_role_id: roleId } as never);
    if (b.error) out.push(b.error.message);
    return out;
  }, { userId: tokens.user.id, propertyId: setUp.propertyId, roleId: setUp.acctRole });
  expect(staff, "staff set-up").toEqual([]);

  const ctx = await browser.newContext();
  const ada = await ctx.newPage();
  await ada.goto("/auth");
  await ada.getByLabel("Email").fill(acct.email);
  await ada.getByLabel("Password").fill(acct.password);
  await ada.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(ada).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await ada.goto("/approvals");
  const waiting = ada.getByRole("row").filter({ hasText: "Dinner was cold" });
  await expect(waiting).toBeVisible({ timeout: 10_000 });
  await waiting.getByRole("button", { name: "Approve" }).click();
  await ada.getByLabel("Reason").fill("Agreed, cold food");
  await ada.getByRole("button", { name: "Save" }).click();
  await expect(toasts(ada).filter({ hasText: "Approved and posted." })).toBeVisible({ timeout: 10_000 });
  await ada.getByRole("tab", { name: "Decided" }).click();
  await expect(ada.getByRole("row").filter({ hasText: "Dinner was cold" })).toContainText("Approved");
  await ctx.close();

  // The adjustment is on the folio: the balance moved by 2,000 (credit, plus its tax).
  const after = await page.evaluate(async (folio) => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { data } = await supabase.from("v_folio_balances").select("balance").eq("folio_id", folio).single();
    return Number((data as { balance: string }).balance);
  }, setUp.folio);
  expect(after).toBeLessThan(setUp.before);
});
