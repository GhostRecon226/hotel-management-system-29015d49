/* Zikora service worker (offline mode, stage 1).
 * It saves the app's own files and the pages a signed-in user has opened, so the app can start without internet.
 * It never touches the database, sign-in, server functions or any other website: only same-origin GET requests.
 * Data lists are saved by the app itself (src/lib/offline/cache.ts), not here. */
const VERSION = "v1";
const FILES = `zikora-files-${VERSION}`;
const PAGES = `zikora-pages-${VERSION}`;
const SHELL_KEY = "/__last-app-page";
let simulateOffline = false; // set by the browser tests only; a page can only break its own caching with it
let fallbacks = 0;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== FILES && key !== PAGES && key.startsWith("zikora-")) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "simulate-offline") simulateOffline = !!data.on;
  if (data.type === "stats" && event.ports[0]) event.ports[0].postMessage({ fallbacks });
  if (data.type === "clear") event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(FILES)]));
});

const PUBLIC_PAGES = new Set(["/", "/auth", "/forgot-password", "/reset-password", "/check-email"]);

function skip(url) {
  return url.origin !== self.location.origin
    || url.pathname.startsWith("/api/")
    || url.pathname.startsWith("/_serverFn")
    || url.pathname.startsWith("/@") && url.pathname.includes("hmr");
}

async function network(request) {
  if (simulateOffline) throw new TypeError("simulated offline");
  return fetch(request);
}

async function navigate(request, url) {
  const pages = await caches.open(PAGES);
  try {
    const response = await network(request);
    if (response.ok && response.type === "basic") {
      await pages.put(request.url, response.clone());
      if (!PUBLIC_PAGES.has(url.pathname)) await pages.put(SHELL_KEY, response.clone());
    }
    return response;
  } catch (err) {
    fallbacks += 1;
    return (await pages.match(request.url)) || (await pages.match(SHELL_KEY)) || (await pages.match("/auth")) || Response.error();
  }
}

async function asset(request) {
  const files = await caches.open(FILES);
  const hit = await files.match(request);
  const refresh = network(request).then((response) => {
    if (response.ok && response.type === "basic") files.put(request, response.clone());
    return response;
  });
  if (hit) { refresh.catch(() => { fallbacks += 1; }); return hit; }
  try { return await refresh; } catch (err) { fallbacks += 1; return Response.error(); }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (skip(url)) return;
  if (request.mode === "navigate") { event.respondWith(navigate(request, url)); return; }
  if (["script", "style", "font", "image", "manifest"].includes(request.destination) || url.pathname.startsWith("/assets/") || url.pathname.startsWith("/src/") || url.pathname.startsWith("/node_modules/")) {
    event.respondWith(asset(request));
  }
});
