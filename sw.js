// © 2026 fauzan0096 — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).

// Bayyin service worker: network-first, so a new version of any app file reaches
// the phone on the next load, with the cached copy as the offline fallback.
// CDN / model / Quran.com requests are left to the network.

const CACHE = 'bayyin-v6';
const SHELL = [
  './',
  'index.html',
  'privacy.html',
  'styles.css',
  'app.js',
  'i18n.js',
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
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon-180.png',
  'favicon.ico',
  'favicon-32.png',
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
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(request, { cache: 'no-cache' });
        if (fresh && fresh.ok && fresh.type === 'basic') {
          cache.put(request, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (error) {
        const hit = await cache.match(request);
        if (hit) return hit;
        if (request.mode === 'navigate') {
          const shell = await cache.match('index.html');
          if (shell) return shell;
        }
        throw error;
      }
    })()
  );
});
