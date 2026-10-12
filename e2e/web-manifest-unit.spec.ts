// The web app manifest, tested on its own (no browser, no database). [PLT-021]
import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));

test("[PLT-021] the manifest names the app and opens it as its own window on sign-in", () => {
  expect(manifest.name).toBe("Zikora");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/auth");
  expect(manifest.scope).toBe("/");
});

test("[PLT-021] the manifest has 192 and 512 icons and both files exist", () => {
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  for (const i of manifest.icons as { src: string }[]) expect(existsSync(`public${i.src}`)).toBe(true);
});

test("[PLT-021] the colours are real hex codes", () => {
  expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
});

test("[PLT-021] every page links the manifest", () => {
  expect(readFileSync("src/routes/__root.tsx", "utf8")).toContain('href: "/manifest.webmanifest"');
});
