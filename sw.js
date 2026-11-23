// Offline support. App files are cached on install; data and map library too.
// Change VERSION (cache name) when shipping changes so phones pick up the new files.
const VERSION = 'runsheet-cache-13';
const CORE = [
  './', './index.html', './styles.css', './app.js', './route.js', './loader.js', './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  './data/places.json', './data/guide.json', './data/tonight.json', './data/money.json', './data/basemap.json', './data/more.json', './data/outline.json',
  // whole-map view of the map art, so it shows offline; closer tiles are cached as you look at them
  './tiles/-2/0_0.webp', './tiles/-2/0_1.webp', './tiles/-1/0_0.webp', './tiles/-1/0_1.webp', './tiles/-1/0_2.webp', './tiles/-1/1_0.webp', './tiles/-1/1_1.webp', './tiles/-1/1_2.webp', './tiles/0/0_0.webp', './tiles/0/0_1.webp', './tiles/0/0_2.webp', './tiles/0/0_3.webp', './tiles/0/0_4.webp', './tiles/0/0_5.webp', './tiles/0/1_0.webp', './tiles/0/1_1.webp', './tiles/0/1_2.webp', './tiles/0/1_3.webp', './tiles/0/1_4.webp', './tiles/0/1_5.webp', './tiles/0/2_0.webp', './tiles/0/2_1.webp', './tiles/0/2_2.webp', './tiles/0/2_3.webp', './tiles/0/2_4.webp', './tiles/0/2_5.webp', './tiles/0/3_0.webp', './tiles/0/3_1.webp', './tiles/0/3_2.webp', './tiles/0/3_3.webp', './tiles/0/3_4.webp', './tiles/0/3_5.webp',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// App files and data: network first, so a new version shows on the next open; the cache is only the offline copy.
// Map tiles, icons and libraries: cache first. If tiles change, bump VERSION so old ones are dropped.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const keep = (res) => { if (res.ok && (url.origin === location.origin || /unpkg\.com|gstatic\.com|googleapis\.com$/.test(url.hostname))) {
    const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; };
  const stable = url.origin !== location.origin || /\/(tiles|icons)\//.test(url.pathname);
  if (stable) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(keep)).catch(() => Response.error()));
    return;
  }
  // no-cache: always check with the server (GitHub Pages lets browsers reuse files for 10 min otherwise); unchanged files cost a tiny 304
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(keep).catch(() => caches.match(req, { ignoreSearch: true })
    .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
