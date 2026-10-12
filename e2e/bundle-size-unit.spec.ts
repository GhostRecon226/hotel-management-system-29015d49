// The first page load stays small. Needs a build (`npm run build`); skipped when there is none. [PLT-023]
import { test, expect } from "@playwright/test";
// @ts-expect-error plain script without types
import { APP_ONLY, LIMIT_BYTES, entryClosure } from "../scripts/bundle-size.mjs";

const closure = entryClosure() as { files: string[]; raw: number; gzip: number } | null;

test.describe("first page load", () => {
  test.skip(!closure, "no build output");

  test("[PLT-023] the first load stays under the size limit", () => {
    expect(closure!.raw).toBeLessThan(LIMIT_BYTES);
  });

  test("[PLT-023] the first load leaves out the sign-in library, form checker, toasts and screen code", () => {
    const bad = closure!.files.filter((f) => (APP_ONLY as RegExp[]).some((re) => re.test(f)));
    expect(bad).toEqual([]);
  });
});
