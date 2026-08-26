/* CGPA Tracker service worker.
   Caches the app shell so the app opens offline. API calls (POST/PUT/DELETE
   and cross-origin requests to the backend) are never cached — they always
   go to the network so data stays fresh. */

const CACHE = 'cgpa-cache-v1';

const ASSETS = [
  'index.html',
  'login.html',
  'register.html',
  'forgot-password.html',
  'dashboard.html',
  'admin.html',
  'semester.html',
  'css/style.css',
  'js/api.js',
  'js/auth.js',
  'js/dashboard.js',
  'js/admin.js',
  'js/semester.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon-180.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET requests. API writes (POST/PUT/DELETE) always hit network.
  if (req.method !== 'GET') return;

  // Never cache cross-origin requests (the backend API on another domain).
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for our own static files, with a runtime cache update.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('index.html'));
    })
  );
});
