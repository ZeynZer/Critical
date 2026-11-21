// Service worker : le jeu fonctionne hors-ligne après la première visite.
// Pour publier une mise à jour, change simplement VERSION.
const VERSION = 'critical-v72';
const CORE = [
  './', 'index.html', 'style.css', 'manifest.webmanifest', 'favicon.ico',
  'js/app.js', 'js/boot.js', 'js/cloud.js', 'js/fusion.js', 'js/mine.js', 'js/home.js', 'assets/hole.webp', 'js/audio.js', 'js/quests.js', 'js/rank.js', 'js/intro.js', 'js/goals.js', 'js/admin.js', 'js/analytics.js', 'js/telemetry.js', 'js/catalog.js', 'js/packs.js', 'js/packfx.js', 'js/packui.js', 'js/immersive.js', 'js/style.js', 'js/ideas.js', 'js/collection.js', 'js/challenges.js', 'js/voidium.js', 'js/cuve.js', 'js/event.js', 'js/install.js', 'js/config.js', 'js/realtime.js',
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
  // Réseau d'abord (les mises à jour arrivent tout de suite), cache en secours hors-ligne.
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      if (res && res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
