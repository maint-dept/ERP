/**
 * Al-Muslim Group ERP — High-Performance Production Service Worker
 * Build: v4.28.4
 *
 * Architecture:
 * 1. Static Assets (CSS, JS, Fonts, Images): Stale-While-Revalidate (0ms instantaneous boot from cache)
 * 2. HTML Documents: Network-First with Cache Fallback (guarantees fresh builds online, opens offline)
 * 3. Database & REST APIs: Strict Network-Only bypass (zero caching of live MySQL/PostgreSQL/SSE streams)
 */

const CACHE_NAME = 'amg-erp-v4.30.9';

const PRECACHE_ASSETS = [
  './',
  'index.html',
  'css/app.css?v=4.30.6',
  'css/grid.css?v=4.30.6',
  'css/components.css?v=4.30.6',
  'css/print.css?v=4.30.6',
  'js/app.js?v=4.30.6',
  'js/state.js',
  'js/db/storage.js',
  'js/db/schema.js',
  'js/services/authService.js',
  'js/services/webPushService.js',
  'js/services/router.js?v=4.29.0',
  'js/components/loginView.js?v=4.29.0',
  'js/components/sidebar.js',
  'js/components/navbar.js?v=4.29.0'
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

// =========================================================================
// 4. Web Push Notification Engine & Notification Click Handlers
// =========================================================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  let targetUrl = notifData.url || './';

  if (targetUrl.startsWith('#')) {
    targetUrl = './' + targetUrl;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. If an existing ERP window/tab is already open, focus it and navigate
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          if (targetUrl && client.navigate) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // 2. Otherwise open a new window to the destination
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || 'Al-Muslim ERP Notice';
    const options = {
      body: payload.message || payload.body || 'New operational update received.',
      icon: payload.icon || 'favicon.ico',
      badge: 'favicon.ico',
      tag: payload.tag || payload.id || 'amg-erp-notice',
      data: {
        url: payload.targetUrl || payload.url || './',
        id: payload.id || null
      },
      vibrate: [200, 100, 200],
      requireInteraction: Boolean(payload.requireInteraction || payload.action === 'APPROVE')
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (_) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Al-Muslim ERP', {
        body: text,
        icon: 'favicon.ico',
        badge: 'favicon.ico'
      })
    );
  }
});
