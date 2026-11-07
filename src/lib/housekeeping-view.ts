import type { ChecklistItem, HkTask } from "@/lib/housekeeping";
import { compareRoomLabels } from "@/lib/room-label";

/** Pure helpers for the housekeeping screens: what needs attention, who has how much, how far along a room is (HK-015). */

const RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const rank = (p: string) => RANK[p] ?? 2;

/** Order tasks by priority first, then by when they were created. */
export function byPriority(a: HkTask, b: HkTask) {
  return rank(a.priority) - rank(b.priority) || a.created_at.localeCompare(b.created_at);
}

/** Tasks a supervisor must act on: nobody has been given the room yet, or an inspection failed and the room needs a re-clean. */
export function needsAttention(tasks: HkTask[]): HkTask[] {
  return tasks.filter((t) => t.status === "open" || t.status === "failed").sort(byPriority);
}

export interface Workload { id: string; name: string; todo: number; working: number }

/** Open work per attendant. A task counts as "to do" when assigned or sent back, and "working" when started. */
export function workload(tasks: HkTask[]): Workload[] {
  const by = new Map<string, Workload>();
  for (const t of tasks) {
    if (!t.assignee_id) continue;
    if (!["assigned", "in_progress", "failed"].includes(t.status)) continue;
    const w = by.get(t.assignee_id) ?? { id: t.assignee_id, name: t.assignee_name ?? "Attendant", todo: 0, working: 0 };
    if (t.status === "in_progress") w.working += 1; else w.todo += 1;
    by.set(t.assignee_id, w);
  }
  return [...by.values()].sort((a, b) => b.todo + b.working - (a.todo + a.working) || a.name.localeCompare(b.name));
}

export function checklistProgress(list: ChecklistItem[] | null | undefined) {
  const items = list ?? [];
  return { done: items.filter((i) => i.done).length, total: items.length };
}

/** Rooms finished by one attendant today against all the rooms given to them today. Waiting inspection and passed both count as finished. */
export function dayProgress(tasks: HkTask[]) {
  const finished = tasks.filter((t) => t.status === "done" || t.status === "inspected").length;
  const total = tasks.filter((t) => t.status !== "cancelled").length;
  return { finished, total };
}

/** The room to clean next: a started room first, then sent-back rooms, then the highest priority one. */
export function nextUp(tasks: HkTask[]): HkTask | null {
  const live = tasks.filter((t) => ["assigned", "open", "failed", "in_progress"].includes(t.status));
  const order = (t: HkTask) => (t.status === "in_progress" ? 0 : t.status === "failed" ? 1 : 2);
  return [...live].sort((a, b) => order(a) - order(b) || byPriority(a, b) || compareRoomLabels(a.room_number, b.room_number))[0] ?? null;
}

export interface FloorGroup { floor: string; tasks: HkTask[] }

/** Group tasks by floor, lowest floor first, rooms in natural order. Rooms with no floor go last under "No floor". */
export function groupByFloor(tasks: HkTask[]): FloorGroup[] {
  const by = new Map<string, HkTask[]>();
  for (const t of tasks) {
    const key = t.floor?.trim() || "";
    by.set(key, [...(by.get(key) ?? []), t]);
  }
  return [...by.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : compareRoomLabels(a, b)))
    .map(([floor, list]) => ({ floor, tasks: [...list].sort((a, b) => compareRoomLabels(a.room_number, b.room_number)) }));
}

/** One-tap defects for a failed inspection. The inspector can still type anything else. */
export const COMMON_DEFECTS = [
  "Bed not made properly", "Hair in the shower", "Towels missing", "Bathroom not clean", "Floor not clean", "Dust on surfaces",
  "Bin not emptied", "Minibar not restocked", "Smell in the room",
];

/** Add a defect to the text box, one per line, without repeating one already there. */
export function addDefectLine(text: string, defect: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.some((l) => l.toLowerCase() === defect.toLowerCase())) return text;
  return [...lines, defect].join("\n");
}

export function removeDefectLine(text: string, defect: string): string {
  return text.split("\n").map((l) => l.trim()).filter((l) => l && l.toLowerCase() !== defect.toLowerCase()).join("\n");
}
