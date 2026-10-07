/* Service worker – offline support for Picture Range Tool.
   Bump VERSION whenever you want every device to drop its old cache. */
const VERSION = "v2";
const CACHE   = `picture-range-${VERSION}`;
const SHELL   = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
const LIB_HOST = "cdn.jsdelivr.net";          // the Excel (SheetJS) library

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith("picture-range-") && k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isLib = url.hostname === LIB_HOST;
  if (url.origin !== location.origin && !isLib) return;

  e.respondWith(isLib ? cacheFirst(req) : staleWhileRevalidate(e));
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

/* Serve from cache instantly (works offline), refresh in the background. */
async function staleWhileRevalidate(e) {
  const req = e.request;
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });

  const network = fetch(req)
    .then(res => { if (res.ok) cache.put(req, res.clone()); return res; })
    .catch(() => null);

  if (hit) { e.waitUntil(network); return hit; }

  const res = await network;
  if (res) return res;
  return req.mode === "navigate" ? (await cache.match("index.html")) || Response.error() : Response.error();
}
