/* Dino Runner service worker — offline-first app shell cache.
   Bump CACHE when any shell file changes so clients pick up the new version. */
const CACHE = "dino-runner-v2";
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
  // Cache-first for the static shell; fall back to network and cache the result.
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req)
        .then((res) => {
          if (res && res.ok && new URL(req.url).origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("index.html"))
    )
  );
});
