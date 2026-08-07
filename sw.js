/* Primal Odyssey — network-first so Pages updates are not stuck on stale CSS/HTML */
const CACHE = "po-v70";
self.addEventListener("install", function (e) {
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = e.request.url || "";
  // Always network-first for app shell / JS / CSS so ?v=N and embed boots stay fresh.
  if (
    e.request.mode === "navigate" ||
    /index\.html(?:\?|$)/.test(url) ||
    /primal(?:_[\w]+)?\.(?:css|js)(?:\?|$)/.test(url) ||
    /po_viewport\.js(?:\?|$)/.test(url) ||
    /sw\.js(?:\?|$)/.test(url)
  ) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        return res;
      }).catch(function () {
        return caches.match(e.request);
      })
    );
    return;
  }
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) {
        try { c.put(e.request, copy); } catch (err) {}
      });
      return res;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});
