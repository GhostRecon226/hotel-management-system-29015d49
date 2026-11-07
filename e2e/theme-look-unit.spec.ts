// Soft light look (PLT-035): the left menu is light and its logo is the normal one. No browser, no network.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const css = readFileSync("src/theme.css", "utf8");
const rootBlock = css.slice(0, css.indexOf(".dark {"));
const token = (name: string) => new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)`).exec(rootBlock)?.[1];

test("[PLT-035] the left menu is a light tint with dark text", () => {
  expect(Number(token("sidebar"))).toBeGreaterThan(0.9);
  expect(Number(token("sidebar-foreground"))).toBeLessThan(0.4);
});

test("[PLT-035] the menu uses the normal logo, not the dark-screen one", () => {
  const shell = readFileSync("src/components/app-shell.tsx", "utf8");
  expect(shell).not.toMatch(/BrandLogo onDark/);
});
