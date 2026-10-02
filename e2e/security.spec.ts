// Security regression checks.
// CVE-2026-102989 / GHSA-qx66-fv34-fjm8 (disclosed 30 Sep 2026): in TanStack Start before @tanstack/react-start 1.168.60
// and @tanstack/start-server-core 1.169.39, a crafted link to a server-function address (/_serverFn/...) could make the
// app return the attacker's HTML from its own address and run their script in the visitor's browser.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

function installed(pkg: string) {
  return (JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, "utf8")) as { version: string }).version;
}
function atLeast(version: string, min: string) {
  const a = version.split(/[.-]/).map(Number), b = min.split(".").map(Number);
  for (let i = 0; i < 3; i++) { if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0); }
  return true;
}

test("TanStack Start is on a version patched for CVE-2026-102989", () => {
  expect(atLeast(installed("@tanstack/react-start"), "1.168.60"), `@tanstack/react-start ${installed("@tanstack/react-start")}`).toBe(true);
  expect(atLeast(installed("@tanstack/start-server-core"), "1.169.39"), `@tanstack/start-server-core ${installed("@tanstack/start-server-core")}`).toBe(true);
});

test("a crafted link to a server-function address cannot put a page or script on our address", async ({ page }) => {
  await page.goto("/auth"); // a normal page first, so a script that ran would leave its mark on window
  const marker = `pwned-${Date.now()}`;
  const html = `<html><body><script>window.__pwned = "${marker}"</script>${marker}</body></html>`;
  const payloads = [
    JSON.stringify({ t: 1, s: html }),
    JSON.stringify({ response: html, data: html, context: { response: html } }),
  ];
  for (const payload of payloads) {
    for (const id of ["not-a-real-function", "eyJmaWxlIjoiL3NyYy9saWIvb3V0Ym94LmZ1bmN0aW9ucy50cyIsImV4cG9ydCI6InJ1bk91dGJveE5vd19jcmVhdGVTZXJ2ZXJGbl9oYW5kbGVyIn0"]) {
      const res = await page.goto(`/_serverFn/${id}?payload=${encodeURIComponent(payload)}`);
      const type = res?.headers()["content-type"] ?? "";
      const body = (await res?.text()) ?? "";
      expect(type.includes("text/html") && body.includes(marker), `${id}: served attacker HTML (${type})`).toBe(false);
      expect(await page.evaluate(() => (window as unknown as { __pwned?: string }).__pwned)).toBeUndefined();
    }
  }
});
