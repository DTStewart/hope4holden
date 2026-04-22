// Hope 4 Holden service worker.
// Minimal for now — registers a controller so the PWA is installable.
// Fetch handler is a pure pass-through (no caching, no interception) to avoid
// any risk of serving stale API responses. We can add targeted static-asset
// caching later as a separate change.

const CACHE_NAME = "h4h-v1";

self.addEventListener("install", (event) => {
  // Activate immediately on install instead of waiting for tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of any open pages without needing a reload.
  event.waitUntil(self.clients.claim());
  // Clean up any old caches from prior versions.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

// Pass-through fetch — no caching yet. Keeping this deliberately simple so
// the service worker never serves stale Supabase / Stripe / API data.
self.addEventListener("fetch", () => {
  // Intentionally empty — browser handles fetch normally.
});
