// Service worker : le jeu fonctionne hors-ligne après la première visite.
// Pour publier une mise à jour, change simplement VERSION.
const VERSION = 'critical-v13';
const CORE = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/main.js', 'js/engine.js', 'js/gen.js', 'js/levels.js', 'js/audio.js', 'js/endless.js', 'js/home.js', 'js/levelcode.js', 'js/editor.js', 'js/chest.js', 'js/skins.js',
  'assets/fonts/orbitron-latin-700-normal.woff2', 'assets/fonts/orbitron-latin-900-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'js/intro.js', 'js/daily.js', 'js/dailyworker.js',
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
