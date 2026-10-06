// Fails while any detail on the public pages still waits for Peter's confirmation ([TO CONFIRM] markers).
// Runs before every build (npm run build). Production (VERCEL_ENV=production) fails while any marker is left, so stand-in text can never go live; previews and local builds only warn.
// Usage: npm run check:confirm
import fs from "node:fs";
import path from "node:path";

const roots = ["src/routes/_public", "src/components/public"];
const skip = new Set([path.normalize("src/components/public/to-confirm.tsx")]); // the marker component itself
const hits = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|mdx?)$/.test(e.name) && !skip.has(path.normalize(p))) {
      fs.readFileSync(p, "utf8").split("\n").forEach((line, i) => {
        for (const m of line.matchAll(/<ToConfirm\s+what="([^"]*)"|\[TO CONFIRM[^\]]*\]/g)) hits.push(`${p}:${i + 1}  ${m[1] ?? m[0]}`);
      });
    }
  }
}
roots.forEach((r) => fs.existsSync(r) && walk(r));
if (hits.length) {
  const isProduction = process.env.VERCEL_ENV === "production";
  const msg = `${hits.length} detail(s) on the public pages are still stand-in text ([TO CONFIRM], filled from src/lib/site-info.ts):`;
  if (isProduction) {
    console.error(msg);
    for (const h of hits) console.error("  " + h);
    console.error("Replace each one with the confirmed text, then build again.");
    process.exit(1);
  }
  console.warn(`PREVIEW ONLY: ${msg}`);
  for (const h of hits) console.warn("  " + h);
  console.warn("A production build (VERCEL_ENV=production) refuses to run until these are confirmed.");
  process.exit(0);
}
console.log("OK: no [TO CONFIRM] left on the public pages.");
