/**
 * Al-Muslim Group ERP — High-Performance Production Service Worker
 * Build: v4.28.4
 *
 * Architecture:
 * 1. Static Assets (CSS, JS, Fonts, Images): Stale-While-Revalidate (0ms instantaneous boot from cache)
 * 2. HTML Documents: Network-First with Cache Fallback (guarantees fresh builds online, opens offline)
 * 3. Database & REST APIs: Strict Network-Only bypass (zero caching of live MySQL/PostgreSQL/SSE streams)
 */

const CACHE_NAME = 'amg-erp-v4.28.4';

const PRECACHE_ASSETS = [
  './',
  'index.html',
  'css/app.css?v=4.28.2',
  'css/grid.css?v=4.28.2',
  'css/components.css?v=4.28.2',
  'css/print.css?v=4.28.2',
  'js/app.js?v=4.28.4',
  'js/state.js?v=4.28.4',
  'js/db/storage.js?v=4.28.4',
  'js/db/schema.js',
  'js/services/authService.js',
  'js/services/router.js?v=4.28.3',
  'js/components/loginView.js?v=4.28.3',
  'js/components/sidebar.js',
  'js/components/navbar.js?v=4.27.9'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache partial notice (non-fatal):', err.message);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req || req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. Strict Bypass: Never cache database requests, PHP scripts, APIs, or real-time endpoints
  if (
    url.pathname.includes('/api/') ||
    url.pathname.endsWith('.php') ||
    url.searchParams.has('action') ||
    url.searchParams.has('reset') ||
    url.hostname.includes('moviezonex.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com')
  ) {
    return;
  }

  // 2. HTML Entrypoints: Network-First with Cache Fallback
  const isHtml = req.mode === 'navigate' || (req.headers.get('accept') && req.headers.get('accept').includes('text/html'));
  if (isHtml) {
    event.respondWith(
      fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
        }
        return networkRes;
      }).catch(() => {
        return caches.match(req).then((cached) => {
          return cached || caches.match('./') || caches.match('index.html');
        });
      })
    );
    return;
  }

  // 3. Static Assets: Stale-While-Revalidate (Instant 0ms delivery from cache, background refresh)
  const isStaticAsset = (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.ico')
  );

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cachedRes) => {
        const fetchPromise = fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          }
          return networkRes;
        }).catch(() => cachedRes);

        return cachedRes || fetchPromise;
      })
    );
  }
});
