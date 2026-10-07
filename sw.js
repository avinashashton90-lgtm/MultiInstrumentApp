// Offline support: serve from the network when possible, fall back to the cached copy.
// The version must match APP_VERSION in index.html (the test suite checks this).
var CACHE = 'pocket-band-v8';
var FILES = ['./', './index.html', './selftest.html', './manifest.json', './icon-192.png', './icon-512.png', './tracks/melodies.json', './tracks/chords.json', './tracks/bass.json', './tracks/drums.json', './tracks/tabla.json'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // cache: 'no-cache' asks the server every time, so the browser's own HTTP cache can never hand back an old
  // index.html after an update (it still uses the cached copy when the server says nothing changed)
  e.respondWith(fetch(req.url, { cache: 'no-cache' }).then(function (res) { // by URL: a navigation request can't take options
    var copy = res.clone();
    if (res.ok) caches.open(CACHE).then(function (c) { c.put(req, copy); });
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('./index.html'); });
  }));
});
