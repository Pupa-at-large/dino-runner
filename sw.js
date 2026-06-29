/* Dino Runner service worker.
   Network-first for the app shell so deploys show up immediately when online;
   falls back to the cache offline. (The old cache-first strategy pinned clients
   to the first version they ever loaded — that's why updates didn't appear.) */
const CACHE = "dino-runner-v3";
const SHELL = [
  "./",
  "index.html",
  "style.css",
  "game.js",
  "manifest.json",
  "icon.svg",
  "fonts/space-grotesk.woff2",
  "fonts/space-mono-400.woff2",
  "fonts/space-mono-700.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== location.origin) return; // leave cross-origin alone
  // Network-first: always try the latest, cache it, fall back to cache offline.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : undefined))
      )
  );
});
