// Carnet alimentaire : fonctionnement hors connexion et mises à jour automatiques.
// À CHAQUE MODIFICATION DE L'APPLI : augmenter VERSION ci-dessous, puis remplacer les fichiers en ligne.
const VERSION = '2026-10-02-2';
const APP_CACHE = 'carnet-app-' + VERSION;
const FONT_CACHE = 'carnet-fonts';
const APP_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((cache) => cache.addAll(APP_FILES.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('carnet-app-') && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Page de l'appli : la version en ligne d'abord (pour les mises à jour), sinon celle gardée sur le téléphone.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      try {
        const res = await Promise.race([fetch(req.url, { cache: 'no-store', credentials: 'same-origin' }), timeout(4000)]);
        if (res && res.ok) cache.put('index.html', res.clone());
        return res;
      } catch (e) {
        return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Polices Google : gardées sur le téléphone après la première ouverture.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const cached = await cache.match(req);
      const network = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })());
    return;
  }

  // Icônes et autres fichiers de l'appli : depuis le téléphone, sinon depuis internet.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.ok) caches.open(APP_CACHE).then((c) => c.put(req, res.clone()));
        return res;
      }))
    );
  }
});
