// Sign-in page look (Nov 2026): rounded cards, dark panel with a hotel-at-night drawing (sample data). No database calls. [PLT-034]
import { test, expect } from "@playwright/test";

test.describe("sign-in page look", () => {
  test("[PLT-034] desktop shows the brand panel with a labelled sample screen and the form", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/auth");
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back." })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Know what’s happening in your hotel." })).toBeVisible();
    await expect(page.getByRole("img", { name: /hotel front at night.*Sample data/ })).toBeVisible();
    await expect(page.getByText(/of 20 rooms occupied/)).toBeVisible();
    await expect(page.getByRole("tab", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Create account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
  });

  test("[PLT-034] the page links back to the site and the create-account link opens that tab", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("link", { name: "Back to site" })).toHaveAttribute("href", "/");
    await page.goto("/auth?mode=signup");
    await expect(page.getByRole("tab", { name: "Create account" })).toHaveAttribute("aria-selected", "true");
  });

  test("[PLT-034] on a phone the brand panel is hidden and nothing scrolls sideways", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/auth");
    await expect(page.getByRole("img", { name: /hotel front at night/ })).toBeHidden();
    await expect(page.getByRole("button", { name: "Sign in", exact: true }).last()).toBeVisible();
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    expect(m.sw).toBeLessThanOrEqual(m.iw);
  });

  test("[PLT-034] the drawing makes no claim beyond sample figures", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/auth");
    const text = await page.locator("aside").innerText();
    expect(text).not.toMatch(/trusted by|customers|\d+\s?%\s*(more|less|faster)/i);
  });
});
