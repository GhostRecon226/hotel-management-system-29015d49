#!/usr/bin/env node
// First page load budget. Run after `npm run build`. [PLT-023]
import { APP_ONLY, LIMIT_BYTES, entryClosure } from "./bundle-size.mjs";

const c = entryClosure();
if (!c) { console.error("No build found. Run `npm run build` first."); process.exit(1); }
const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`First load: ${c.files.length} scripts, ${kb(c.raw)} raw, ${kb(c.gzip)} compressed (limit ${kb(LIMIT_BYTES)} raw).`);
const bad = c.files.filter((f) => APP_ONLY.some((re) => re.test(f)));
if (bad.length) { console.error(`App-only code is in the first load: ${bad.join(", ")}`); process.exit(1); }
if (c.raw > LIMIT_BYTES) { console.error("The first load is over the limit."); process.exit(1); }
console.log("OK");
