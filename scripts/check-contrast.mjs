// Checks text contrast in src/theme.css against WCAG AA (4.5:1 for normal text). Light theme.
// Usage: npm run check:contrast
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/theme.css", import.meta.url), "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
const vars = Object.fromEntries([...root.matchAll(/--([a-z0-9-]+):\s*oklch\(([^)]+)\)/g)].map((m) => [m[1], m[2]]));

function luminance(name) {
  const v = vars[name];
  if (!v) throw new Error(`--${name} is not an oklch colour in theme.css`);
  const [L, C, H] = v.split("/")[0].trim().split(/\s+/).map(Number);
  const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (x) => Math.min(1, Math.max(0, x));
  const r = clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}
const ratio = (fg, bg) => { const [x, y] = [luminance(fg), luminance(bg)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [text, background, what it is]
const pairs = [
  ["foreground", "background", "body text on the page"],
  ["foreground", "card", "body text on cards"],
  ["muted-foreground", "card", "secondary text on cards"],
  ["muted-foreground", "background", "secondary text on the page"],
  ["muted-foreground", "muted", "secondary text on grey fills"],
  ["muted-foreground", "primary-tint", "secondary text on accent tiles"],
  ["primary", "card", "links and accent text on cards"],
  ["primary-strong", "primary-soft", "active pill, accent chips"],
  ["primary-strong", "primary-tint", "accent tile figures"],
  ["primary-foreground", "primary", "text on accent buttons"],
  ["primary-foreground", "primary-fill-from", "filled card text (start of gradient)"],
  ["primary-foreground", "primary-fill-to", "filled card text (end of gradient)"],
  ["on-primary-muted", "primary-fill-from", "filled card secondary text (start)"],
  ["on-primary-muted", "primary-fill-to", "filled card secondary text (end)"],
  ["success-strong", "success-soft", "success chips and tiles"],
  ["warning-strong", "warning-soft", "warning chips and tiles"],
  ["danger-strong", "danger-soft", "danger chips and tiles"],
  ["info-strong", "info-soft", "info chips and tiles"],
  ["destructive", "card", "negative amounts and error text"],
  ["destructive-foreground", "destructive", "text on danger buttons"],
  ["warning-foreground", "warning", "text on warning fills"],
  ["secondary-foreground", "secondary", "secondary buttons"],
  ["accent-foreground", "accent", "hovered menu items"],
  ["sidebar-foreground", "sidebar", "menu items"],
  ["sidebar-accent-foreground", "sidebar-accent", "active menu item"],
];
let failed = 0;
for (const [fg, bg, what] of pairs) {
  const r = ratio(fg, bg);
  const ok = r >= 4.5;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${r.toFixed(2).padStart(5)}:1  ${what} (--${fg} on --${bg})`);
}
if (failed) { console.log(`\n${failed} pair(s) below WCAG AA 4.5:1`); process.exit(1); }
console.log("\nAll text pairs meet WCAG AA (4.5:1).");
