// The security headers, tested on their own (no browser, no database). [PLT-020]
import { test, expect } from "@playwright/test";
import { SECURITY_HEADERS } from "../src/lib/security-headers";

test("[PLT-020] pages cannot be framed by other sites", () => {
  expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
  expect(SECURITY_HEADERS["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
});

test("[PLT-020] browsers may not guess file types, and send little to other sites", () => {
  expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
  expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
});

test("[PLT-020] the camera stays on for photos; microphone and location stay off", () => {
  const p = SECURITY_HEADERS["Permissions-Policy"];
  expect(p).toContain("camera=(self)");
  expect(p).toContain("microphone=()");
  expect(p).toContain("geolocation=()");
});

test("[PLT-020] the policy does not restrict scripts or connections, so no page can break", () => {
  const csp = SECURITY_HEADERS["Content-Security-Policy"];
  expect(csp).not.toContain("script-src");
  expect(csp).not.toContain("default-src");
  expect(csp).not.toContain("connect-src");
});
