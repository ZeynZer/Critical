// Service worker : le jeu fonctionne hors-ligne après la première visite.
// Pour publier une mise à jour, change simplement VERSION.
const VERSION = 'critical-v1';
const CORE = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/main.js', 'js/engine.js', 'js/gen.js', 'js/levels.js', 'js/audio.js',
  'assets/fonts/orbitron-latin-700-normal.woff2', 'assets/fonts/orbitron-latin-900-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request).then((res) => {
        if (res && res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net; // cache d'abord, mise à jour en arrière-plan
    })
  );
});
