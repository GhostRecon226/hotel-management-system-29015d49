// Sign-up check (PLT-026): what is sent to Supabase and when the form must wait. No browser, no network.
import { test, expect } from "@playwright/test";
import { captchaBlock, captchaEnabled, captchaOptions } from "../src/lib/captcha";

test("[PLT-026] with no site key the check is off and nothing extra is sent", () => {
  expect(captchaEnabled(undefined)).toBe(false);
  expect(captchaEnabled("")).toBe(false);
  expect(captchaOptions("tok", false)).toBeUndefined();
  expect(captchaBlock(null, false)).toBeNull();
});

test("[PLT-026] with a site key the token goes with the request", () => {
  expect(captchaEnabled("0x4AAAA")).toBe(true);
  expect(captchaOptions("tok-123", true)).toEqual({ captchaToken: "tok-123" });
});

test("[PLT-026] with a site key the form waits until the check has finished", () => {
  expect(captchaBlock(null, true)).toMatch(/safety check/i);
  expect(captchaBlock(undefined, true)).toMatch(/safety check/i);
  expect(captchaBlock("tok-123", true)).toBeNull();
  expect(captchaOptions(null, true)).toBeUndefined();
});
