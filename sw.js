/* Primal Odyssey asset cache hint */
const CACHE = "po-v54";
const ASSETS = [
  "./",
  "./index.html",
  "./primal.css?v=44",
  "./primal.js?v=44",
  "./primal_data.js?v=44",
  "./primal_sprites.js?v=44",
  "./primal_snes_data.js?v=44",
  "./primal_snes.js?v=44"
];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS).catch(function () {}); }));
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { try { c.put(e.request, copy); } catch (err) {} });
        return res;
      }).catch(function () { return hit; });
    })
  );
});
