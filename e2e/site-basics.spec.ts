// [PLT-022] Search and security basics every public page should have. Static: no sign-in, no database calls.
import { test, expect } from "@playwright/test";

const SITE = "https://www.zikorahq.com";
const INDEXED = ["/", "/features", "/pricing", "/security", "/faq", "/about", "/contact", "/privacy", "/terms"];

test("[PLT-022] every page in the sitemap names its own canonical address", async ({ page, request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!.replace(SITE, "") || "/");
  expect(listed.sort(), "the sitemap lists exactly the public pages").toEqual([...INDEXED].sort());
  const problems: string[] = [];
  for (const path of INDEXED) {
    await page.goto(path);
    const href = await page.locator('link[rel="canonical"]').getAttribute("href");
    const want = `${SITE}${path === "/" ? "/" : path}`;
    if (href !== want) problems.push(`${path}: canonical is ${href ?? "missing"}, expected ${want}`);
    const og = await page.locator('meta[property="og:url"]').getAttribute("content");
    if (og !== want) problems.push(`${path}: og:url is ${og ?? "missing"}, expected ${want}`);
  }
  expect(problems).toEqual([]);
});

test("[PLT-022] security.txt tells researchers how to report a problem", async ({ request }) => {
  const res = await request.get("/.well-known/security.txt");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^text\/plain/);
  const body = await res.text();
  expect(body).toMatch(/^Contact: \S+/m);
  expect(body).toMatch(/^Canonical: https:\/\/www\.zikorahq\.com\/\.well-known\/security\.txt$/m);
  const expires = body.match(/^Expires: (\S+)$/m)?.[1];
  expect(expires, "an Expires date is required").toBeTruthy();
  const days = (Date.parse(expires!) - Date.now()) / 86_400_000;
  expect(days, "Expires must be in the future, and not more than a year away").toBeGreaterThan(30);
  expect(days).toBeLessThanOrEqual(366);
});
