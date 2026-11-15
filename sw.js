// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Bayyin service worker.
//  - Big, never-changing files (Quran text, page data, images, font) come straight
//    from the cache: the app opens instantly, even offline.
//  - Code files (html / js / css) are served from the cache at once and refreshed in
//    the background, so a new version arrives on the next launch.
// CDN / network-only hosts (Quran audio, fonts) are left to the network.

const CACHE = 'bayyin-v116';
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
  'amiri-quran-full.ttf',
  'amiri-quran.ttf',
  'app.js',
  'i18n.js',
  'strings-v2.js',
  'progress.js',
  'accuracy.js',
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
  'gift.js',
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
  'geo.js',
  'cities.js',
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
  'madani-layout.js',
  'install.js',
  'manifest.webmanifest',
  'widgets/noor-template.json',
  'widgets/noor-data.json',
  'icon-96.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon-180.png',
  'favicon.ico',
  'favicon-32.png',
  // The Quran text and the page map (1.3 MB + 1.5 MB) are deliberately not
  // precached: they are fetched and cached on the first open by the runtime
  // handler, so a new code version does not re-download them for every update.
];

const IMMUTABLE = /\.(?:png|ico|woff2|ttf|xml|txt|json)$/i;

// Shown only when the page itself is not in the cache yet — a first visit that
// never reached the internet. Everything the person can see is on the phone
// after one online open.
const OFFLINE_PAGE = `<!doctype html>
<html lang="ur"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>بيّن — Bayyin</title>
<style>
body{margin:0;min-height:100svh;display:grid;place-content:center;padding:28px;text-align:center;background:#f7f1e6;color:#4b1b21;font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif}
h1{margin:0 0 10px;font-size:30px}p{margin:0 0 6px;color:#6b4a2a;line-height:1.55}small{color:#8a6a45}
</style></head><body><main>
<h1>بيّن — Bayyin</h1>
<p>App ko ek dafa internet ke sath khol lein.</p>
<p>Us ke baad poora Quran, duaein, tasbeeh aur auqaat <strong>bina internet</strong> chalte hain.</p>
<small>Please open the app once with internet. After that it works offline.</small>
</main></body></html>`;

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

  // Sound and video are left to the browser. A media element asks for its file
  // in byte ranges, and a worker answering those from a whole-file cache entry
  // is exactly what made the azaan stall with no sound and no error.
  if (request.destination === 'audio' || request.destination === 'video') return;
  if (request.headers.has('range')) return;

  // Opening the app: the cached page is shown at once — with no network at all,
  // and without waiting for a slow one — and a fresh copy is fetched quietly for
  // the next open. A new deploy still arrives with its own worker (a new CACHE
  // fills in install), so this cannot stick the app on an old version.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cacheKey = new Request(`${url.origin}${url.pathname}`);
        const hit = (await cache.match(cacheKey)) || (await cache.match('index.html'));

        const refresh = fetch(request)
          .then((fresh) => {
            if (fresh && fresh.ok && fresh.type === 'basic') {
              cache.put(cacheKey, fresh.clone()).catch(() => {});
              return fresh;
            }
            return null;
          })
          .catch(() => null);

        if (hit) {
          event.waitUntil(refresh);
          return hit;
        }
        const fresh = await refresh;
        if (fresh) return fresh;
        return new Response(OFFLINE_PAGE, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // One entry per path: "?go=dua" and "?demo=1" must not make copies.
      const cacheKey = new Request(`${url.origin}${url.pathname}`);

      // Code: serve from the cache at once (that is what makes the app open
      // fast and work offline) and refresh it quietly in the background. A new
      // deploy still reaches the phone: a new worker fills a new cache at
      // install and reloads the page (see install.js / watchForUpdate).
      if (!IMMUTABLE.test(url.pathname)) {
        const hit2 = await cache.match(cacheKey);
        const refresh = fetch(request)
          .then((fresh) => {
            if (fresh && fresh.ok && fresh.type === 'basic') {
              cache.put(cacheKey, fresh.clone()).catch(() => {});
            }
            return fresh;
          })
          .catch(() => null);

        if (hit2) {
          event.waitUntil(refresh);
          return hit2;
        }

        const fresh = await refresh;
        if (fresh) return fresh;
        return Response.error();
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
    data: { url: data.url || './?go=daily', adhan: data.adhan || '' },
  };
  if (Array.isArray(data.vibrate) && data.vibrate.length) options.vibrate = data.vibrate;
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // A prayer push also asks every open page to play the azaan at once, so
      // nothing has to be tapped. A page that is merely in the background can
      // still play audio; only a fully closed app cannot (a web app has no
      // way to start sound on its own then — the notification is the way in).
      if (!data.adhan) return;
      try {
        const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of list) {
          if (client.postMessage) client.postMessage({ type: 'ADHAN', name: data.adhan });
        }
      } catch (error) {
        /* no open window */
      }
    })()
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  // Without a server there is nothing to re-send the subscription to; keep the
  // handler so the browser knows this worker handles it.
  event.waitUntil(Promise.resolve());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.url || './';
  const adhan = data.adhan || '';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          // Tell the open app to play the azaan first: in an installed app
          // navigate() is often refused, and then nothing would play.
          if (adhan && client.postMessage) client.postMessage({ type: 'ADHAN', name: adhan });
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
