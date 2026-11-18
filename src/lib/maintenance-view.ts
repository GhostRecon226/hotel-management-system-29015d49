import type { Ticket } from "@/lib/maintenance";

/** Pure helpers for the maintenance screens: what needs attention, who has how much, how far along a ticket is (MNT-005 to MNT-008). */

/** Limits for "needs attention". Fixed in the screen, not settings. */
export const NOBODY_HOURS = 4;
export const WAITING_DAYS = 3;

const HOUR = 3_600_000;
const RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const rank = (p: string) => RANK[p] ?? 2;
const WORKING = ["assigned", "in_progress"];
const UNFINISHED = ["open", "assigned", "in_progress", "waiting"];

/** How long ago, in plain words: "just now", "5 hours", "2 days". */
export function ageText(iso: string, now: number): string {
  const hours = Math.floor((now - Date.parse(iso)) / HOUR);
  if (hours < 1) return "just now";
  if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}

export type AttentionReason = "urgent" | "check" | "nobody" | "waiting";
export interface AttentionItem { ticket: Ticket; reasons: AttentionReason[] }
const REASON_ORDER: AttentionReason[] = ["urgent", "check", "nobody", "waiting"];

/** Tickets a supervisor must act on: urgent and not finished, resolved but not checked, nobody assigned for a while, or waiting a long time. */
export function attentionItems(tickets: Ticket[], now: number): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const t of tickets) {
    const reasons: AttentionReason[] = [];
    if (t.priority === "urgent" && UNFINISHED.includes(t.status)) reasons.push("urgent");
    if (t.status === "resolved") reasons.push("check");
    if (t.status === "open" && !t.assignee_id && now - Date.parse(t.created_at) > NOBODY_HOURS * HOUR) reasons.push("nobody");
    if (t.status === "waiting" && now - Date.parse(t.updated_at) > WAITING_DAYS * 24 * HOUR) reasons.push("waiting");
    if (reasons.length) items.push({ ticket: t, reasons });
  }
  const first = (i: AttentionItem) => REASON_ORDER.indexOf(i.reasons[0]!);
  return items.sort((a, b) => first(a) - first(b) || rank(a.ticket.priority) - rank(b.ticket.priority) || a.ticket.created_at.localeCompare(b.ticket.created_at));
}

export interface BoardColumn { key: "open" | "working" | "waiting" | "check"; label: string; tickets: Ticket[] }

/** Four board columns: open, assigned and working, waiting, and resolved but not checked. Closed and cancelled tickets are not shown. */
export function boardColumns(tickets: Ticket[]): BoardColumn[] {
  const by = (f: (t: Ticket) => boolean) => tickets.filter(f).sort((a, b) => rank(a.priority) - rank(b.priority) || a.created_at.localeCompare(b.created_at));
  return [
    { key: "open", label: "Open", tickets: by((t) => t.status === "open") },
    { key: "working", label: "Assigned and working", tickets: by((t) => WORKING.includes(t.status)) },
    { key: "waiting", label: "Waiting", tickets: by((t) => t.status === "waiting") },
    { key: "check", label: "Check needed", tickets: by((t) => t.status === "resolved") },
  ];
}

export interface Workload { id: string; name: string; active: number; waiting: number }

/** Open work per technician: assigned and started tickets as "active", paused ones as "waiting". Busiest first. */
export function workload(tickets: Ticket[]): Workload[] {
  const by = new Map<string, Workload>();
  for (const t of tickets) {
    if (!t.assignee_id || ![...WORKING, "waiting"].includes(t.status)) continue;
    const w = by.get(t.assignee_id) ?? { id: t.assignee_id, name: t.assignee_name ?? "Technician", active: 0, waiting: 0 };
    if (t.status === "waiting") w.waiting += 1; else w.active += 1;
    by.set(t.assignee_id, w);
  }
  return [...by.values()].sort((a, b) => b.active + b.waiting - (a.active + a.waiting) || a.name.localeCompare(b.name));
}

/** Tickets nobody has been given yet. */
export const unassignedCount = (tickets: Ticket[]) => tickets.filter((t) => t.status === "open" && !t.assignee_id).length;

const JOB_ORDER = (t: Ticket) => (t.status === "in_progress" ? 0 : t.status === "assigned" ? 1 : 2);

/** One technician's jobs: started first, then assigned, then waiting; urgent before normal; oldest first. */
export function myJobs(tickets: Ticket[], userId: string): Ticket[] {
  return tickets
    .filter((t) => t.assignee_id === userId && ["assigned", "in_progress", "waiting"].includes(t.status))
    .sort((a, b) => JOB_ORDER(a) - JOB_ORDER(b) || rank(a.priority) - rank(b.priority) || a.created_at.localeCompare(b.created_at));
}

/** The job to do next: the started one, otherwise the most urgent assigned one. A waiting job is never "next". */
export function nextJob(jobs: Ticket[]): Ticket | null {
  return [...jobs].filter((t) => WORKING.includes(t.status)).sort((a, b) => JOB_ORDER(a) - JOB_ORDER(b) || rank(a.priority) - rank(b.priority) || a.created_at.localeCompare(b.created_at))[0] ?? null;
}

export const TICKET_STEPS = ["Open", "Assigned", "In progress", "Resolved", "Closed"];

/** Which of the five steps a ticket is on. A waiting ticket is still on "In progress". Cancelled is -1: not on the path. */
export function ticketStep(status: string): number {
  return ({ open: 0, assigned: 1, in_progress: 2, waiting: 2, resolved: 3, closed: 4 } as Record<string, number>)[status] ?? -1;
}

/** One-tap problems for Report a problem. The reporter can still type anything else. */
export const COMMON_PROBLEMS = [
  "No hot water", "AC not cooling", "Leak", "No power", "TV or remote", "Door lock", "Light out", "Blocked drain", "Other",
];

/** One-tap notes for Mark resolved. */
export const COMMON_FIXES = ["Replaced a part", "Reset the breaker", "Cleared a blockage", "Adjusted and tested"];

/** Add a line to a text box, one per line, without repeating one already there. */
export function addLine(text: string, line: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.some((l) => l.toLowerCase() === line.toLowerCase())) return text;
  return [...lines, line].join("\n");
}
