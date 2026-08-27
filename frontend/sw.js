/* CGPA Tracker service worker.
   Strategy:
   - HTML / CSS / JS / manifest -> NETWORK-FIRST, so the newest code always
     loads when online; the cache is only an offline fallback. This prevents
     the app from getting "stuck" on an old cached version after an update.
   - Icons / images -> cache-first (they rarely change).
   - API calls (POST/PUT/DELETE, and cross-origin requests to the backend)
     are never cached. */

const CACHE = 'cgpa-cache-v3';

const ASSETS = [
  'index.html', 'login.html', 'register.html', 'forgot-password.html',
  'dashboard.html', 'admin.html', 'semester.html',
  'css/style.css',
  'js/api.js', 'js/auth.js', 'js/dashboard.js', 'js/admin.js', 'js/semester.js',
  'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-512.png', 'icons/icon-180.png'
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

  // Never intercept non-GET (API writes) or cross-origin (backend API).
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isImage = /\.(png|jpe?g|svg|ico|webp|gif)$/i.test(url.pathname);

  if (isImage) {
    // Cache-first for images/icons.
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
    return;
  }

  // Network-first for HTML/CSS/JS/manifest -> always fresh when online.
  event.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(cached => cached || caches.match('index.html')))
  );
});
