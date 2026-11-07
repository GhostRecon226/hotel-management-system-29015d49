// Housekeeping screens (HK-015 to HK-017): what needs attention, workload, progress, floors, defect buttons. No browser, no network.
import { test, expect } from "@playwright/test";
import type { HkTask } from "../src/lib/housekeeping";
import { addDefectLine, checklistProgress, COMMON_DEFECTS, dayProgress, groupByFloor, needsAttention, nextUp, removeDefectLine, workload } from "../src/lib/housekeeping-view";

let n = 0;
const task = (o: Partial<HkTask>): HkTask => ({
  id: `t${++n}`, property_id: "p", room_id: "r", type: "turnover", status: "open", priority: "normal", assignee_id: null, assignee_name: null,
  checklist: [], defects: [], notes: null, business_date: "2026-11-07", created_at: `2026-11-07T0${n % 10}:00:00Z`, started_at: null, completed_at: null,
  completed_by: null, completed_by_name: null, inspected_at: null, inspected_by_name: null, inspection_result: null, fail_count: 0, cancel_reason: null,
  room_number: "101", floor: "1", room_condition: "dirty", is_occupied: false, room_type_name: "Standard", board_column: "open", ...o,
});

test("[HK-015] needs attention lists open and failed rooms, most urgent first", () => {
  const list = needsAttention([
    task({ id: "a", status: "open", priority: "normal" }), task({ id: "b", status: "failed", priority: "urgent", assignee_id: "u1" }),
    task({ id: "c", status: "assigned", assignee_id: "u1" }), task({ id: "d", status: "open", priority: "high" }), task({ id: "e", status: "done" }),
  ]);
  expect(list.map((t) => t.id)).toEqual(["b", "d", "a"]);
});

test("[HK-015] workload counts to do and working per attendant, busiest first", () => {
  const w = workload([
    task({ status: "assigned", assignee_id: "u1", assignee_name: "Ada" }), task({ status: "in_progress", assignee_id: "u1", assignee_name: "Ada" }),
    task({ status: "failed", assignee_id: "u2", assignee_name: "Bola" }), task({ status: "open" }), task({ status: "done", assignee_id: "u2", assignee_name: "Bola" }),
  ]);
  expect(w).toEqual([{ id: "u1", name: "Ada", todo: 1, working: 1 }, { id: "u2", name: "Bola", todo: 1, working: 0 }]);
});

test("[HK-016] checklist and day progress", () => {
  expect(checklistProgress([{ label: "a", done: true }, { label: "b", done: false }])).toEqual({ done: 1, total: 2 });
  expect(checklistProgress(null)).toEqual({ done: 0, total: 0 });
  expect(dayProgress([task({ status: "done" }), task({ status: "inspected" }), task({ status: "assigned" }), task({ status: "in_progress" })])).toEqual({ finished: 2, total: 4 });
});

test("[HK-016] next up is the started room, then a sent-back room, then the highest priority", () => {
  expect(nextUp([task({ id: "a", status: "assigned", priority: "urgent" }), task({ id: "b", status: "in_progress" })])?.id).toBe("b");
  expect(nextUp([task({ id: "a", status: "assigned", priority: "urgent" }), task({ id: "b", status: "failed" })])?.id).toBe("b");
  expect(nextUp([task({ id: "a", status: "assigned" }), task({ id: "b", status: "assigned", priority: "high" })])?.id).toBe("b");
  expect(nextUp([task({ status: "done" })])).toBeNull();
});

test("[HK-016] rooms group by floor in natural order, rooms with no floor last", () => {
  const g = groupByFloor([
    task({ room_number: "201", floor: "2" }), task({ room_number: "102", floor: "1" }), task({ room_number: "9", floor: "1" }),
    task({ room_number: "Zurich", floor: null }), task({ room_number: "101", floor: "1" }),
  ]);
  expect(g.map((x) => x.floor)).toEqual(["1", "2", ""]);
  expect(g[0]!.tasks.map((t) => t.room_number)).toEqual(["9", "101", "102"]);
});

test("[HK-017] defect buttons add and remove lines without repeats", () => {
  let text = "";
  text = addDefectLine(text, "Towels missing");
  text = addDefectLine(text, "Hair in the shower");
  text = addDefectLine(text, "towels missing");
  expect(text).toBe("Towels missing\nHair in the shower");
  expect(removeDefectLine(text, "Towels missing")).toBe("Hair in the shower");
  expect(addDefectLine("Window left open", "Bin not emptied")).toBe("Window left open\nBin not emptied");
  expect(new Set(COMMON_DEFECTS).size).toBe(COMMON_DEFECTS.length);
});
