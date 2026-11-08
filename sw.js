const CACHE_NAME = 'lord-of-the-woods-v10-admin-prayers-battle-audit-34';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './extensions.css',
  './app.js',
  './backend.js',
  './backend-config.js',
  './military-advisor.js',
  './SUPABASE_SETUP_RU.md',
  './manifest.webmanifest',
  './assets/lord-portrait.webp',
  './assets/forest-banner.webp',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/races/undead.webp',
  './assets/races/arenians.webp',
  './assets/races/vampires.webp',
  './assets/races/run.webp',
  './assets/races/shandi.webp',
  './assets/races/nekomata.webp',
  './assets/races/gobs.webp',
  './assets/races/valessians.webp',
  './assets/races/grandians.webp',
  './assets/races/inverses.webp',
  './assets/races/mazury.webp',
  './assets/races/skaven.webp',
  './assets/races/barzum.webp',
  './assets/races/tavurs.webp',
  './assets/races/taungurs.webp',
  './assets/races/brugachi.webp',
  './assets/races/drukhari.webp',
  './assets/races/humans.webp',
  './assets/races/dwarves.webp',
  './assets/races/orcs.webp',
  './assets/races/elves.webp',
  './assets/races/halflings.webp'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => {
    const network = fetch(event.request).then(response => {
      if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => cached);
    return cached || network;
  }));
});
