// Starts the service worker. In development it stays off unless a test or developer turns it on, so edits are never served stale.
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  let enabled = import.meta.env.PROD;
  try { if (window.localStorage.getItem("zikora.sw") === "1") enabled = true; } catch { /* storage blocked */ }
  if (!enabled) return;
  navigator.serviceWorker.register("/sw.js").catch(() => { /* offline mode simply stays off */ });
}
