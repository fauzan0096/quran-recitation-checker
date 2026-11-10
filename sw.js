// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Bayyin service worker.
//  - Big, never-changing files (Quran text, page data, images, font) come straight
//    from the cache: the app opens instantly, even offline.
//  - Code files (html / js / css) are served from the cache at once and refreshed in
//    the background, so a new version arrives on the next launch.
// CDN / model / Quran.com requests are left to the network.

const CACHE = 'bayyin-v27';
// Speech library (Transformers.js + ONNX runtime wasm) from the CDN: kept for good so
// the model starts offline and the library is not downloaded again each launch.
const LIB_CACHE = 'bayyin-lib-v1';
const LIB_HOSTS = ['cdn.jsdelivr.net', 'esm.sh'];

const SHELL = [
  './',
  'index.html',
  'privacy.html',
  'styles.css',
  'v2.css',
  'app.js',
  'i18n.js',
  'strings-v2.js',
  'progress.js',
  'hijri.js',
  'daily-content.js',
  'daily.js',
  'status-card.js',
  'tasbeeh-v2.js',
  'duas.js',
  'duas-data.js',
  'planners.js',
  'hifz-test.js',
  'premium-tools.js',
  'premium.js',
  'premium-strings.js',
  'qibla.js',
  'calendar.js',
  'asr.js',
  'align.js',
  'normalize.js',
  'quran.js',
  'surahs.js',
  'tajweed.js',
  'quran-pages.js',
  'indopak.js',
  'install.js',
  'manifest.webmanifest',
  'amiri-quran.ttf',
  'icon-96.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon-180.png',
  'favicon.ico',
  'favicon-32.png',
  'quran-tanzil.txt',
  'quran-pages.xml',
];

const IMMUTABLE = /\.(?:png|ico|woff2|ttf|xml|txt)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {
            /* one missing file must not break the install */
          })
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Only this app's own old shells go. The speech model lives in
      // "transformers-cache" and must survive every update.
      await Promise.all(
        keys
          .filter((key) => key.startsWith('bayyin-') && key !== CACHE && key !== LIB_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (LIB_HOSTS.includes(url.hostname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(LIB_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const fresh = await fetch(request);
        if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
        return fresh;
      })()
    );
    return;
  }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request, { ignoreSearch: true });

      const refresh = fetch(request)
        .then((fresh) => {
          if (fresh && fresh.ok && fresh.type === 'basic') {
            cache.put(request, fresh.clone()).catch(() => {});
          }
          return fresh;
        })
        .catch(() => null);

      if (hit) {
        // Heavy files: cache only. Code: cache now, refresh quietly.
        if (!IMMUTABLE.test(url.pathname)) event.waitUntil(refresh);
        return hit;
      }

      const fresh = await refresh;
      if (fresh) return fresh;
      if (request.mode === 'navigate') {
        const shell = await cache.match('index.html');
        if (shell) return shell;
      }
      return Response.error();
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) if ('focus' in client) return client.focus();
      return self.clients.openWindow('./');
    })
  );
});
