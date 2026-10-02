// The app on Peter's Mac must answer only on the Mac itself, not to other devices on the same network.
// Runs against the browser-test dev server (port 8081), which uses the same vite.config.ts as `npm run dev`.
import { test, expect } from "@playwright/test";
import { networkInterfaces } from "node:os";

const PORT = 8081;
const networkAddresses = Object.values(networkInterfaces()).flat()
  .filter((a): a is NonNullable<typeof a> => !!a && !a.internal)
  .map((a) => (a.family === "IPv6" ? `[${a.address.split("%")[0]}]` : a.address))
  .filter((a) => !a.startsWith("[fe80")); // link-local IPv6 needs an interface name; skip it

async function reachable(host: string) {
  try {
    const res = await fetch(`http://${host}:${PORT}/auth`, { signal: AbortSignal.timeout(3000) });
    return res.status > 0;
  } catch {
    return false;
  }
}

test("the dev server answers on this Mac", async () => {
  expect(await reachable("localhost")).toBe(true);
});

test("the dev server does not answer on the Mac's network addresses", async () => {
  test.skip(networkAddresses.length === 0, "this machine has no network address to test");
  for (const host of networkAddresses) expect(await reachable(host), `reachable from the network at ${host}`).toBe(false);
});
