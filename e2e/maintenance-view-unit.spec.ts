// Requirements: MNT-005, MNT-006, MNT-007, MNT-008. Maintenance screen helpers. No browser, no network.
import { test, expect } from "@playwright/test";
import type { Ticket } from "../src/lib/maintenance";
import {
  addLine, ageText, attentionItems, boardColumns, COMMON_FIXES, COMMON_PROBLEMS, myJobs, nextJob, ticketStep, TICKET_STEPS, unassignedCount, workload,
} from "../src/lib/maintenance-view";

const NOW = Date.parse("2026-11-18T12:00:00Z");
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();
let n = 0;
const ticket = (o: Partial<Ticket>): Ticket => ({
  id: `k${++n}`, property_id: "p", title: "Tap dripping", description: null, room_id: "r", room_number: "101", location: null, priority: "normal", status: "open",
  assignee_id: null, assignee_name: null, wait_reason: null, resolution: null, resolved_by: null, resolved_by_name: null, resolved_at: null, closed_by_name: null,
  closed_at: null, cancel_reason: null, reopen_count: 0, last_reopen_reason: null, created_by: null, created_by_name: null, created_at: ago(1), updated_at: ago(1),
  has_active_block: false, has_approved_block: false, ...o,
});

test("[MNT-007] age shows in hours or days, never more exact than that", () => {
  expect(ageText(ago(0.1), NOW)).toBe("just now");
  expect(ageText(ago(1), NOW)).toBe("1 hour");
  expect(ageText(ago(5), NOW)).toBe("5 hours");
  expect(ageText(ago(24), NOW)).toBe("1 day");
  expect(ageText(ago(60), NOW)).toBe("2 days");
});

test("[MNT-006] needs attention lists urgent, unchecked, unassigned and long-waiting tickets, most pressing first", () => {
  const items = attentionItems([
    ticket({ id: "fine", status: "assigned", assignee_id: "u1", created_at: ago(2) }),
    ticket({ id: "new-open", status: "open", created_at: ago(2) }),
    ticket({ id: "nobody", status: "open", created_at: ago(5) }),
    ticket({ id: "urgent", status: "in_progress", priority: "urgent", assignee_id: "u1" }),
    ticket({ id: "check", status: "resolved", assignee_id: "u1" }),
    ticket({ id: "wait", status: "waiting", assignee_id: "u1", updated_at: ago(24 * 4) }),
    ticket({ id: "wait-short", status: "waiting", assignee_id: "u1", updated_at: ago(24 * 2) }),
    ticket({ id: "closed", status: "closed", priority: "urgent" }),
    ticket({ id: "cancelled", status: "cancelled", priority: "urgent" }),
  ], NOW);
  expect(items.map((i) => i.ticket.id)).toEqual(["urgent", "check", "nobody", "wait"]);
  expect(items.map((i) => i.reasons[0])).toEqual(["urgent", "check", "nobody", "waiting"]);
});

test("[MNT-006] an urgent ticket nobody has shows both reasons", () => {
  const [item] = attentionItems([ticket({ status: "open", priority: "urgent", created_at: ago(30) })], NOW);
  expect(item!.reasons).toEqual(["urgent", "nobody"]);
});

test("[MNT-006] the board has four columns and puts each ticket in one", () => {
  const cols = boardColumns([
    ticket({ id: "a", status: "open" }), ticket({ id: "b", status: "assigned", assignee_id: "u1" }), ticket({ id: "c", status: "in_progress", assignee_id: "u1" }),
    ticket({ id: "d", status: "waiting" }), ticket({ id: "e", status: "resolved" }), ticket({ id: "f", status: "closed" }),
  ]);
  expect(cols.map((c) => [c.key, c.tickets.map((t) => t.id)])).toEqual([["open", ["a"]], ["working", ["b", "c"]], ["waiting", ["d"]], ["check", ["e"]]]);
});

test("[MNT-006] workload counts active tickets per technician and the tickets nobody has", () => {
  const list = [
    ticket({ status: "assigned", assignee_id: "u1", assignee_name: "Emeka" }), ticket({ status: "in_progress", assignee_id: "u1", assignee_name: "Emeka" }),
    ticket({ status: "waiting", assignee_id: "u2", assignee_name: "Kunle" }), ticket({ status: "resolved", assignee_id: "u2", assignee_name: "Kunle" }),
    ticket({ status: "closed", assignee_id: "u2", assignee_name: "Kunle" }), ticket({ status: "open" }), ticket({ status: "open" }),
  ];
  expect(workload(list)).toEqual([{ id: "u1", name: "Emeka", active: 2, waiting: 0 }, { id: "u2", name: "Kunle", active: 0, waiting: 1 }]);
  expect(unassignedCount(list)).toBe(2);
});

test("[MNT-005] my jobs are my assigned, started or waiting tickets, and the next job is the started one, then the most urgent", () => {
  const list = [
    ticket({ id: "a", status: "assigned", assignee_id: "me", priority: "urgent", created_at: ago(30) }),
    ticket({ id: "b", status: "in_progress", assignee_id: "me", priority: "low" }),
    ticket({ id: "c", status: "waiting", assignee_id: "me" }),
    ticket({ id: "d", status: "assigned", assignee_id: "other" }),
    ticket({ id: "e", status: "resolved", assignee_id: "me" }),
    ticket({ id: "f", status: "assigned", assignee_id: "me", priority: "normal", created_at: ago(50) }),
  ];
  const mine = myJobs(list, "me");
  expect(mine.map((t) => t.id)).toEqual(["b", "a", "f", "c"]);
  expect(nextJob(mine)?.id).toBe("b");
  expect(nextJob(mine.filter((t) => t.id !== "b"))?.id).toBe("a");
  expect(nextJob([ticket({ status: "waiting", assignee_id: "me" })])).toBeNull();
});

test("[MNT-007] a ticket shows five steps and where it stands", () => {
  expect(TICKET_STEPS).toEqual(["Open", "Assigned", "In progress", "Resolved", "Closed"]);
  expect(["open", "assigned", "in_progress", "waiting", "resolved", "closed", "cancelled"].map(ticketStep)).toEqual([0, 1, 2, 2, 3, 4, -1]);
});

test("[MNT-008] the report form offers nine common problems and the resolve box offers common fixes", () => {
  expect(COMMON_PROBLEMS).toHaveLength(9);
  expect(COMMON_PROBLEMS).toContain("No hot water");
  expect(COMMON_FIXES.length).toBeGreaterThanOrEqual(4);
  expect(addLine("", "Reset the breaker")).toBe("Reset the breaker");
  expect(addLine("Reset the breaker", "reset the breaker")).toBe("Reset the breaker");
  expect(addLine("Reset the breaker", "Replaced a part")).toBe("Reset the breaker\nReplaced a part");
});
