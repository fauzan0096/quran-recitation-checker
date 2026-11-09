// Bayyin service worker: app shell offline, Quran text and page data cached.
// Model weights and the IndoPak API stay network-first (they are large/remote).

const CACHE = 'bayyin-v1';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'asr.js',
  'align.js',
  'normalize.js',
  'quran.js',
  'surahs.js',
  'tajweed.js',
  'selftest.js',
  'quran-pages.js',
  'indopak.js',
  'install.js',
  'manifest.webmanifest',
  'icon.svg',
  'icon-maskable.svg',
  'quran-tanzil.txt',
  'quran-pages.xml',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // CDN, Hugging Face, Quran.com

  // Navigations: network first so a new version shows up, cache as fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('index.html')))
    );
    return;
  }

  // Everything else: cache first, then network (and remember it).
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => hit);
    })
  );
});
