// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Bayyin service worker.
//  - Big, never-changing files (Quran text, page data, images, font) come straight
//    from the cache: the app opens instantly, even offline.
//  - Code files (html / js / css) are served from the cache at once and refreshed in
//    the background, so a new version arrives on the next launch.
// CDN / network-only hosts (Quran audio, fonts) are left to the network.

const CACHE = 'bayyin-v66';
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
  'badges.js',
  'murajaa.js',
  'qari.js',
  'reminder.js',
  'push.js',
  'word-audio.js',
  'adhan.js',
  'extra-strings.js',
  'billing.js',
  'backup.js',
  'prayer.js',
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
  'widgets/noor-template.json',
  'widgets/noor-data.json',
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

const IMMUTABLE = /\.(?:png|ico|woff2|ttf|xml|txt|json)$/i;

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

  // Opening the app: ask the network first, so a fix reaches the phone on the
  // very next open instead of after another launch. Offline it falls back to the
  // cached page, so nothing is lost.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cacheKey = new Request(`${url.origin}${url.pathname}`);
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok && fresh.type === 'basic') {
            cache.put(cacheKey, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch (error) {
          const hit = await cache.match(cacheKey);
          if (hit) return hit;
          const shell = await cache.match('index.html');
          if (shell) return shell;
          return Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // One entry per path: "?go=dua" and "?demo=1" must not make copies.
      const cacheKey = new Request(`${url.origin}${url.pathname}`);

      // Code (html / js / css / manifest) always asks the network first: a stale
      // app.js is a broken app, and it was exactly that which kept an old build
      // on the phone. The cache is the fallback, so offline still works.
      if (!IMMUTABLE.test(url.pathname)) {
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok && fresh.type === 'basic') {
            cache.put(cacheKey, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch (error) {
          const hit = await cache.match(cacheKey);
          if (hit) return hit;
          if (request.mode === 'navigate') {
            const shell = await cache.match('index.html');
            if (shell) return shell;
          }
          return Response.error();
        }
      }

      // Big, never-changing files (Quran text, pages, images, font): cache only.
      const hit = await cache.match(cacheKey);
      if (hit) return hit;

      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok && fresh.type === 'basic') {
          cache.put(cacheKey, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (error) {
        return Response.error();
      }
    })()
  );
});

// ------------------------------------------------------------------ sync
// Re-fetch the app shell into the cache (used by Background Sync, Periodic
// Background Sync and the "refresh" message).
async function refreshShell() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    SHELL.filter((url) => !IMMUTABLE.test(url)).map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {
        /* offline or missing: try again next time */
      })
    )
  );
}

// Background Sync: runs as soon as the phone is back online.
self.addEventListener('sync', (event) => {
  if (event.tag === 'bayyin-sync') event.waitUntil(refreshShell());
});

// Periodic Background Sync: about once a day, quietly, while the app is installed.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'bayyin-daily') event.waitUntil(refreshShell());
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') self.skipWaiting();
  if (type === 'REFRESH') event.waitUntil(refreshShell());
});

// ------------------------------------------------------------------- push
// The app has no server of its own; this lets a push (or a locally triggered
// notification) show up with the right text and open the right screen.
/** The text of a push: Jumu'ah on Friday, Roz ki Naiki otherwise. */
function dailyBody() {
  const day = new Date().getDay();
  return day === 5
    ? 'Jumu’ah mubarak — aaj Surah Kahf parhein.'
    : 'Roz ki Naiki — aaj ki aya, hadith aur sunnah parhein.';
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'بيّن — Bayyin';
  const tag = data.tag || 'bayyin-reminder';
  const options = {
    body: data.body || dailyBody(),
    icon: 'icon-192.png',
    badge: 'icon-96.png',
    tag,
    // A prayer notification must not be silently replaced by the daily one.
    renotify: Boolean(data.tag),
    requireInteraction: Boolean(data.requireInteraction),
    lang: 'en',
    dir: 'auto',
    data: { url: data.url || './?go=daily' },
  };
  if (Array.isArray(data.vibrate) && data.vibrate.length) options.vibrate = data.vibrate;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('pushsubscriptionchange', (event) => {
  // Without a server there is nothing to re-send the subscription to; keep the
  // handler so the browser knows this worker handles it.
  event.waitUntil(Promise.resolve());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          if ('navigate' in client && target !== './') client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// ---------------------------------------------------------------- widgets
// Windows 11 widget board: install / resume / update with the bundled card.
async function renderWidget(widget) {
  if (!self.widgets || !widget) return;
  try {
    const template = await (await fetch(widget.definition.msAcTemplate)).text();
    const data = await (await fetch(widget.definition.data)).text();
    await self.widgets.updateByTag(widget.definition.tag, { template, data });
  } catch (error) {
    /* offline: the board keeps the last card */
  }
}
self.addEventListener('widgetinstall', (event) => event.waitUntil(renderWidget(event.widget)));
self.addEventListener('widgetresume', (event) => event.waitUntil(renderWidget(event.widget)));
self.addEventListener('widgetclick', (event) => event.waitUntil(renderWidget(event.widget)));
self.addEventListener('widgetuninstall', () => {});
