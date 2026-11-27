// Service worker : le jeu fonctionne hors-ligne après la première visite.
// Pour publier une mise à jour, change simplement VERSION.
const VERSION = 'critical-v82';
const CORE = [
  './', 'index.html', 'style.css', 'manifest.webmanifest', 'favicon.ico',
  'js/app.js', 'js/boot.js', 'js/cloud.js', 'js/skills.js', 'js/bot.js', 'js/botworker.js', 'js/liquid.js', 'js/fusion.js', 'js/mine.js', 'js/home.js', 'assets/hole.webp', 'js/audio.js', 'js/quests.js', 'js/rank.js', 'js/intro.js', 'js/goals.js', 'js/admin.js', 'js/analytics.js', 'js/telemetry.js', 'js/catalog.js', 'js/packs.js', 'js/packfx.js', 'js/packui.js', 'js/immersive.js', 'js/style.js', 'js/ideas.js', 'js/collection.js', 'js/challenges.js', 'js/voidium.js', 'js/cuve.js', 'js/event.js', 'js/install.js', 'js/config.js', 'js/realtime.js',
  'assets/fonts/orbitron-latin-700-normal.woff2', 'assets/fonts/orbitron-latin-900-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
let slowUntil = 0; // réseau jugé lent : pendant 15 s, les fichiers suivants partent directement du cache (sinon chaque import attendrait 2,5 s)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const same = new URL(e.request.url).origin === location.origin;
  // Réseau d'abord (les mises à jour arrivent tout de suite) ; mais si le réseau traîne plus de 2,5 s (métro, campagne),
  // la copie en cache répond aussitôt et la réponse du réseau, quand elle arrive, met le cache à jour pour la prochaine fois.
  const net = fetch(e.request, { cache: 'no-cache' }).then((res) => {
    if (res && res.ok && same) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return res;
  });
  e.respondWith((async () => {
    try {
      if (Date.now() < slowUntil) { const c = await caches.match(e.request); if (c) return c; }
      const first = await Promise.race([net, new Promise((ok) => setTimeout(ok, 2500, 'lent'))]);
      if (first !== 'lent') return first;
      slowUntil = Date.now() + 15000;
      return (await caches.match(e.request)) || (await net);
    } catch (err) { const c = await caches.match(e.request); if (c) return c; throw err; }
  })());
  if (same) e.waitUntil(net.catch(() => {}));
});
