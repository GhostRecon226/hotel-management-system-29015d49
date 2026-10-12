// Measures what every page downloads first: the main script and every script it loads at once. [PLT-023]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

export const ASSETS = ".vercel/output/static/assets";
/** Raw size limit for the first load (before this change: 823 KB). */
export const LIMIT_BYTES = 470_000;
/** Libraries that only signed-in screens and forms need. The first load must not include them. */
export const APP_ONLY = [/^client-/, /^zod-/, /^dashboard-/, /^select-/];

export function entryClosure(dir = ASSETS) {
  if (!existsSync(dir)) return null;
  const entry = readdirSync(dir).find((f) => /^index-.*\.js$/.test(f));
  if (!entry) return null;
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f) || !existsSync(join(dir, f))) continue;
    seen.add(f);
    for (const m of readFileSync(join(dir, f), "utf8").matchAll(/from"\.\/([^"]+\.js)"/g)) stack.push(m[1]);
  }
  const files = [...seen];
  const raw = files.reduce((n, f) => n + statSync(join(dir, f)).size, 0);
  const gzip = files.reduce((n, f) => n + gzipSync(readFileSync(join(dir, f)), { level: 9 }).length, 0);
  return { files, raw, gzip };
}
