// Shared by the phone and tablet layout test and the measuring tool. Local Supabase only.
import type { Page } from "@playwright/test";

// Runs inside the page. Counts what is wrong with the layout, ignoring boxes that scroll on purpose.
export const MEASURE = () => {
  const vw = document.documentElement.clientWidth;
  const vis = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0;
  };
  const scrollParent = (el: Element) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if ((ox === "auto" || ox === "scroll") && p.scrollWidth > p.clientWidth + 1) return p;
    }
    return null;
  };
  const clipped = (el: Element) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX === "hidden" || s.overflowX === "clip" || s.overflowX === "auto" || s.overflowX === "scroll") {
        const pr = p.getBoundingClientRect();
        if (pr.right <= vw + 1) return true;
      }
    }
    return false;
  };
  const label = (el: Element) => {
    const t = (el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("placeholder") || el.getAttribute("name") || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${t ? ` "${t}"` : ""}`;
  };
  const overflow: string[] = [];
  const tiny: string[] = [];
  const smallText = new Set<string>();
  const wideTables: string[] = [];
  const all = Array.from(document.body.querySelectorAll("*"));
  for (const el of all) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !scrollParent(el) && !clipped(el) && !el.closest("[data-sonner-toaster]")) {
      if (overflow.length < 12) overflow.push(`${label(el)} spans ${Math.round(r.left)}..${Math.round(r.right)} of ${vw}`);
    }
  }
  // Smallest comfortable target: 24px for links, check boxes and switches (WCAG 2.2), 36px for buttons and fields.
  for (const el of Array.from(document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=combobox], [role=checkbox], [role=switch], [role=menuitem]'))) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    const small = Math.min(r.width, r.height);
    if (small <= 2 || el.closest("[aria-hidden=true]") || el.matches(".sr-only")) continue; // hidden file inputs and the skip link are not touched by people
    const kind = el.getAttribute("role") ?? "";
    const isLink = el.tagName === "A";
    const isToggle = kind === "checkbox" || kind === "switch" || kind === "radio" || (el as HTMLInputElement).type === "checkbox" || (el as HTMLInputElement).type === "radio";
    const need = isToggle || isLink ? 24 : 36;
    const inline = isLink && getComputedStyle(el).display === "inline"; // a link inside a sentence may be short
    if (small < need && !inline && tiny.length < 25) tiny.push(`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)} (needs ${need})`);
  }
  for (const el of all) {
    if (!vis(el)) continue;
    const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || "").trim().length > 1);
    if (!own) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) smallText.add(`${fs}px: ${((el as HTMLElement).innerText || "").replace(/\s+/g, " ").trim().slice(0, 30)}`);
  }
  for (const t of Array.from(document.querySelectorAll("table"))) {
    if (!vis(t)) continue;
    const sp = scrollParent(t);
    const w = t.getBoundingClientRect().width;
    if (w > vw + 1) wideTables.push(`table ${Math.round(w)}px wide, ${sp ? "inside a scrolling box" : "NOT in a scrolling box"}, ${t.querySelectorAll("thead th").length} columns`);
  }
  const h1 = document.querySelector("main h1");
  const h1Ratio = h1 && vis(h1) && h1.getBoundingClientRect().width > 2 ? h1.getBoundingClientRect().width / vw : null; // the dashboard title is for screen readers only
  const tabsShort = Array.from(document.querySelectorAll("[role=tab]")).filter((t) => vis(t) && t.getBoundingClientRect().height < 40)
    .slice(0, 6).map((t) => `${label(t)} ${Math.round(t.getBoundingClientRect().height)}px tall`);
  const scrollTables: string[] = [];
  for (const t of Array.from(document.querySelectorAll("table"))) {
    if (!vis(t) || t.hasAttribute("data-scroll")) continue;
    const box = t.parentElement;
    if (box && box.scrollWidth > box.clientWidth + 1) scrollTables.push(`table with ${t.querySelectorAll("thead th").length} columns scrolls sideways (${box.scrollWidth}px in ${box.clientWidth}px)`);
  }
  // An iPhone zooms the page in when you tap a field with text under 16px.
  const smallFields = Array.from(document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), textarea, select, [role=combobox]"))
    .filter((f) => vis(f) && parseFloat(getComputedStyle(f).fontSize) < 16).slice(0, 6).map(label);
  return {
    h1Ratio, tabsShort, scrollTables, smallFields,
    pageOverflow: document.documentElement.scrollWidth - vw,
    overflow, tiny, smallText: Array.from(smallText).slice(0, 8), wideTables,
    tables: document.querySelectorAll("table").length, height: document.documentElement.scrollHeight,
  };
};

/** A busy hotel: long names, bookings, a folio with charges and a payment, an invoice, tasks, tickets, a shift. */
export async function seedBusyHotel(page: Page) {
  return await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const out: string[] = [];
    const call = async (fn: string, args: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn as never, args as never);
      if (error) out.push(`${fn}: ${error.message}`);
      return data as unknown;
    };
    const { data: ctx } = await supabase.rpc("my_context" as never);
    const p = (ctx as { properties: { id: string; business_date: string }[]; user_id: string }).properties[0]!;
    const me = (ctx as { user_id: string }).user_id;
    const plus = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
    const { data: rt } = await supabase.from("room_types").select("id").eq("code", "STD").single();
    const { data: rp } = await supabase.from("rate_plans").select("id").eq("code", "BAR").single();
    await call("bulk_add_rooms", { p_property_id: p.id, p_from: 3, p_to: 12, p_room_type_id: rt!.id, p_floor: "2" });
    const names: [string, string][] = [["Oluwaseun", "Adebayo-Johnson"], ["Chinedu", "Okonkwo-Eze"], ["Folasade", "Ogunleye"], ["Ibrahim", "Abdulrahman"], ["Ngozi", "Nwachukwu"], ["Tunde", "Bakare"], ["Amaka", "Onyekachukwu-Uzoma"]];
    const guests: string[] = [];
    // Only the first guest has an email address, and a long one (it must wrap on a phone). A booking for a guest with an
    // email queues a confirmation, and the sender takes only 25 waiting emails per run: seeding many would pile up in the
    // local test mailbox and push the email test (outbox-cron.spec.ts) out of its batch on the next run.
    for (const [i, [f, l]] of names.entries()) {
      const g = await call("save_guest", { p_id: null, p_first_name: f, p_last_name: l, p_phone: "+2348012345678", p_email: i === 0 ? "oluwaseun.adebayo-johnson@example.com" : null, p_nationality: "NG", p_address: "12 Admiralty Way, Lekki Phase 1, Lagos", p_notes: null });
      guests.push(g as string);
    }
    const book = async (i: number, arr: number, dep: number, status: string) =>
      (await call("create_reservation", { p_property_id: p.id, p_idempotency_key: crypto.randomUUID(), p_guest_id: guests[i], p_arrival: plus(p.business_date, arr), p_departure: plus(p.business_date, dep), p_room_type_id: rt!.id, p_rate_plan_id: rp!.id, p_adults: 2, p_children: 0, p_status: status, p_source: "direct", p_company_name: i === 1 ? "Dangote Industries Nigeria Limited" : null, p_special_requests: "Late arrival, quiet room away from the lift please", p_notes: null, p_guarantee: "none", p_hold_until: null, p_group_id: null, p_rate_override: null, p_override_reason: null })) as string;
    const r0 = await book(0, 0, 3, "confirmed");
    const r1 = await book(1, 0, 2, "confirmed");
    const r2 = await book(2, 1, 4, "confirmed");
    const r3 = await book(3, 0, 5, "confirmed");
    const r4 = await book(4, 2, 4, "confirmed");
    await book(5, 3, 6, "confirmed");
    await book(6, 0, 1, "confirmed");
    const reg = { id_type: "national_id", id_number: "A1234567", nationality: "NG", address: "12 Admiralty Way, Lekki Phase 1, Lagos", registration_accepted: true };
    const { data: rms } = await supabase.from("rooms").select("id").order("room_number").limit(6);
    await call("check_in", { p_id: r0, p_registration: reg, p_room_id: rms![0]!.id });
    await call("check_in", { p_id: r3, p_registration: reg, p_room_id: rms![1]!.id });
    // charges and a payment on the first guest's folio
    const { data: folio } = await supabase.from("folios").select("id").eq("reservation_id", r0).eq("is_main", true).maybeSingle();
    if (!folio) return { failures: [...out, `no folio for reservation ${r0}`], r0, r1, r2, r4, guest: guests[0], folio: null, invoice: null, ticket: null, room: null, group: null };
    const { data: ccs } = await supabase.from("charge_codes").select("id, code").eq("is_active", true).limit(6);
    const { data: pms } = await supabase.from("payment_methods").select("id, code").eq("is_active", true);
    for (let i = 0; i < Math.min(4, ccs!.length); i++) {
      await call("post_charge", { p_folio_id: folio!.id, p_charge_code_id: ccs![i]!.id, p_amount: 7500 + i * 2500, p_tax_inclusive: false, p_description: `Restaurant and bar, table ${i + 4}, dinner for two`, p_reference: `RCPT-${1000 + i}`, p_idempotency_key: crypto.randomUUID() });
    }
    await call("post_payment", { p_folio_id: folio!.id, p_payment_method_id: pms![0]!.id, p_amount: 20000, p_currency: "NGN", p_is_deposit: false, p_description: "Part payment", p_reference: "POS-77881", p_idempotency_key: crypto.randomUUID() });
    const inv = await call("issue_invoice", { p_folio_id: folio!.id, p_kind: "interim", p_idempotency_key: crypto.randomUUID() });
    const rooms = rms;
    for (let i = 0; i < 4; i++) {
      const t = await call("create_hk_task", { p_room_id: rooms![i]!.id, p_type: i % 2 ? "deep_clean" : "turnover", p_priority: i === 0 ? "high" : "normal" });
      if (t && i < 3) await call("assign_hk_task", { p_id: t, p_assignee_id: me });
    }
    const tk: string[] = [];
    for (let i = 0; i < 3; i++) {
      const t = await call("create_ticket", { p_property_id: p.id, p_title: ["Air conditioner not cooling in the room", "Bathroom tap leaking", "TV remote missing"][i], p_description: "Guest reported this at the front desk this morning.", p_room_id: rooms![i]!.id, p_location: null, p_priority: ["high", "normal", "low"][i], p_assignee_id: i ? null : me });
      if (t) tk.push(t as string);
    }
    await call("create_service_request", { p_reservation_id: r0, p_category: "amenities", p_description: "Two extra towels and a baby cot", p_chargeable: false, p_charge_amount: null, p_charge_code_id: null, p_assignee_id: null });
    await call("create_service_request", { p_reservation_id: r3, p_category: "laundry", p_description: "Express laundry, 6 items", p_chargeable: true, p_charge_amount: 6000, p_charge_code_id: ccs![0]!.id, p_assignee_id: null });
    await call("open_cashier_shift", { p_property_id: p.id, p_opening_float: 50000, p_idempotency_key: crypto.randomUUID() });
    const { data: grp } = await supabase.from("booking_groups").select("id").limit(1);
    return { failures: out, r0, r1, r2, r4, guest: guests[0], folio: folio?.id, invoice: inv as string, ticket: tk[0], room: rooms![0]!.id, group: grp?.[0]?.id ?? null };
  });
}


export type Seed = Awaited<ReturnType<typeof seedBusyHotel>>;

/** Every signed-in screen, with the ids of the seeded records for the detail screens. */
export function appScreens(ids: Seed): [string, string][] {
  return [
    ["dashboard", "/dashboard"], ["front-desk", "/front-desk"], ["reservations", "/reservations"], ["reservation-new", "/reservations/new"],
    ["reservation-detail", `/reservations/${ids.r0}`], ["availability", "/reservations/availability"], ["groups", "/reservations/groups"],
    ["checkout", `/checkout/${ids.r0}`], ["folios", "/folios"], ["folio-detail", `/folios/${ids.folio}`], ["invoice", `/invoices/${ids.invoice}`],
    ["guests", "/guests"], ["guest-detail", `/guests/${ids.guest}`], ["guests-merge", "/guests/merge"],
    ["rooms", "/rooms"], ["room-detail", `/rooms/${ids.room}`],
    ["housekeeping", "/housekeeping"], ["hk-my-tasks", "/housekeeping/my-tasks"], ["hk-inspections", "/housekeeping/inspections"], ["hk-lost-found", "/housekeeping/lost-found"], ["hk-minibar", "/housekeeping/minibar"],
    ["maintenance", "/maintenance"], ["ticket-detail", `/maintenance/${ids.ticket}`], ["service-requests", "/service-requests"],
    ["cashier", "/cashier"], ["approvals", "/approvals"], ["group", "/group"], ["reports", "/reports"], ["admin", "/admin"], ["downtime", "/downtime"],
    ["setup", "/setup"], ["setup-property", "/setup/property"], ["setup-room-types", "/setup/room-types"], ["setup-rooms", "/setup/rooms"], ["setup-rates", "/setup/rates"], ["setup-charges", "/setup/charges"], ["setup-exchange", "/setup/exchange-rates"],
  ];
}
