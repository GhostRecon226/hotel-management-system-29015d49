#!/usr/bin/env node
// Requirement register check (wave 1, item 3, 6 Oct 2026). docs/requirements.csv is the single register.
// Fails when:
//   1. a test uses a requirement id that has no row (database checks tagged [ID], upgrade test, browser tests);
//   2. an id appears twice in the register;
//   3. a row says "Built+tested" but no test uses its id.
// Run on its own with `npm run check:requirements`; the full database run (scripts/test-db.sh) runs it too.
// Not part of `npm run build`: a register error must not block a deploy.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PREFIXES = "AI|PLT|GRP|ADM|SET|RES|FO|GST|ROOM|HK|MNT|SVC|FIN|DAY|RPT|NFR";
const ID = new RegExp(`\\b((?:${PREFIXES})-\\d{3}[a-z]?)\\b`, "g");
const TAG = new RegExp(`\\[((?:${PREFIXES})-\\d{3}[a-z]?)\\]`, "g");

function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ""));
}

const [head, ...rows] = parseCsv(readFileSync("docs/requirements.csv", "utf8"));
const col = (name) => { const i = head.indexOf(name); if (i < 0) throw new Error(`docs/requirements.csv has no "${name}" column`); return i; };
const iId = col("ID"); const iStatus = col("Status");

const used = new Map(); // id -> set of files
const note = (id, file) => { if (!used.has(id)) used.set(id, new Set()); used.get(id).add(file); };
const sqlFiles = [
  ...readdirSync("supabase/tests/db").filter((f) => f.endsWith(".sql")).map((f) => join("supabase/tests/db", f)),
  "supabase/tests/upgrade/after.sql",
  "supabase/tests/concurrency/last_room.sh",
];
for (const f of sqlFiles) for (const m of readFileSync(f, "utf8").matchAll(TAG)) note(m[1], f);
for (const f of readdirSync("e2e").filter((f) => f.endsWith(".spec.ts")).map((f) => join("e2e", f)))
  for (const m of readFileSync(f, "utf8").matchAll(ID)) note(m[1], f);

const problems = [];
const seen = new Set();
for (const r of rows) {
  const id = r[iId];
  if (seen.has(id)) problems.push(`${id} appears twice in docs/requirements.csv`);
  seen.add(id);
  if (r[iStatus].startsWith("Built+tested") && !used.has(id)) problems.push(`${id} says "${r[iStatus]}" but no test uses [${id}]`);
}
for (const [id, files] of used) if (!seen.has(id)) problems.push(`${id} is used by ${[...files].join(", ")} but has no row in docs/requirements.csv`);

if (problems.length) {
  console.error(`Requirement register check failed (${problems.length}):\n  ` + problems.sort().join("\n  "));
  process.exit(1);
}
const untested = rows.filter((r) => !used.has(r[iId])).length;
console.log(`OK: ${rows.length} requirements, ${used.size} used by tests, ${untested} with no tagged test.`);
