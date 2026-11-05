/**
 * Al-Muslim Group ERP — High-Performance Production Service Worker
 * Build: v4.37.0
 *
 * Architecture:
 * 1. Offline Machine Image Caching: Cache-First + Stale-While-Revalidate (Instant offline access for factory floor technicians)
 * 2. 60-Day Auto-Pruning & Storage Quota Guard: Automatically cleans up inspection photos older than 60 days
 * 3. Static Assets (CSS, JS, Fonts): Stale-While-Revalidate (0ms instantaneous boot from cache)
 * 4. HTML Documents: Network-First with Cache Fallback (guarantees fresh builds online, opens offline)
 * 5. Database & REST APIs: Strict Network-Only bypass (zero caching of live MySQL/PostgreSQL/SSE streams)
 */

const BUILD_VER = '4.37.0';
const CACHE_NAME = 'amg-erp-v4.38.0';
const IMAGE_CACHE_NAME = 'amg-erp-images-v1';

const PRECACHE_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'favicon.ico',
  'icon.svg',
  'icon-192.png',
  'apple-touch-icon.png',
  `css/app.css?v=${BUILD_VER}`,
  `css/grid.css?v=${BUILD_VER}`,
  `css/components.css?v=${BUILD_VER}`,
  `css/print.css?v=${BUILD_VER}`,
  `js/app.js?v=${BUILD_VER}`,
  `js/state.js?v=${BUILD_VER}`,
  `js/db/storage.js?v=${BUILD_VER}`,
  `js/db/schema.js?v=${BUILD_VER}`,
  `js/services/authService.js?v=${BUILD_VER}`,
  `js/services/webPushService.js?v=${BUILD_VER}`,
  `js/services/notificationGatewayService.js?v=${BUILD_VER}`,
  `js/services/router.js?v=${BUILD_VER}`,
  `js/services/moduleLoader.js?v=${BUILD_VER}`,
  `js/components/loginView.js?v=${BUILD_VER}`,
  `js/components/sidebar.js?v=${BUILD_VER}`,
  `js/components/navbar.js?v=${BUILD_VER}`,
  `js/components/dashboard.js?v=${BUILD_VER}`,
  `js/components/qrScannerModal.js?v=${BUILD_VER}`,
  `js/components/machinePocketCardModal.js?v=${BUILD_VER}`,
  `js/components/smartSearchActionModal.js?v=${BUILD_VER}`
];

/**
 * 60-Day Auto-Pruning & Storage Quota Guard for Machine Images
 * Prevents mobile technician phones from running out of storage.
 */
async function pruneExpiredImageCache() {
  try {
    const imgCache = await caches.open(IMAGE_CACHE_NAME);
    const requests = await imgCache.keys();
    const now = Date.now();
    const MAX_IMAGE_AGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 Days
    const MAX_IMAGE_COUNT = 500; // Cap at 500 images max

    // Check browser storage quota
    let isQuotaCritical = false;
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota && (estimate.usage / estimate.quota) > 0.8) {
        isQuotaCritical = true;
      }
    }

    let deletedCount = 0;
    const itemsWithDates = [];

    for (const req of requests) {
      const res = await imgCache.match(req);
      if (!res) continue;
      const dateHeader = res.headers.get('date');
      const fetchTime = dateHeader ? new Date(dateHeader).getTime() : now;
      itemsWithDates.push({ req, ageMs: now - fetchTime });

      // Evict if older than 60 days
      if (now - fetchTime > MAX_IMAGE_AGE_MS) {
        await imgCache.delete(req);
        deletedCount++;
      }
    }

    // If quota critical or over 500 images, prune oldest
    if (isQuotaCritical || requests.length > MAX_IMAGE_COUNT) {
      itemsWithDates.sort((a, b) => b.ageMs - a.ageMs); // Oldest first
      const excess = Math.max(0, requests.length - deletedCount - 350);
      for (let i = 0; i < excess && i < itemsWithDates.length; i++) {
        await imgCache.delete(itemsWithDates[i].req);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[SW Image Cache] Pruned ${deletedCount} expired/excess machine images.`);
    }
  } catch (err) {
    console.warn('[SW Image Cache Prune Notice]:', err.message);
  }
}

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
          // Preserve current app cache and persistent offline image cache
          if (key !== CACHE_NAME && key !== IMAGE_CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      // Run 60-day auto-pruning & storage quota check
      return pruneExpiredImageCache();
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req || req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. Strict Bypass: Never cache database requests, PHP scripts, APIs, or real-time endpoints
  const isApiBypass = (
    url.pathname.includes('/api/') ||
    url.pathname.endsWith('.php') ||
    url.pathname.includes('mysql_api.php') ||
    url.pathname.includes('pg_api.php') ||
    url.pathname.includes('erp_database.json') ||
    url.pathname.includes('/data/') ||
    url.pathname.endsWith('.json') ||
    url.searchParams.has('action') ||
    url.searchParams.has('reset') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com')
  );

  if (isApiBypass) {
    return;
  }

  // 2. Offline Machine Images Caching: Cache-First with Stale-While-Revalidate
  // Technicians can view uploaded machine pictures offline on the factory floor
  const isImageRequest = (
    req.destination === 'image' ||
    url.pathname.match(/\.(?:png|jpe?g|gif|webp|svg|ico|bmp|avif)$/i) ||
    url.pathname.includes('/uploads/') ||
    url.pathname.includes('/images/') ||
    url.pathname.includes('/img/')
  );

  if (isImageRequest) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((imgCache) => {
        return imgCache.match(req).then((cachedRes) => {
          const fetchPromise = fetch(req).then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              imgCache.put(req, networkRes.clone());
            }
            return networkRes;
          }).catch(() => {
            return cachedRes;
          });

          return cachedRes || fetchPromise;
        });
      })
    );
    return;
  }

  // 3. HTML Entrypoints: Network-First with Cache Fallback
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

  // 4. Static Assets: Stale-While-Revalidate (Instant 0ms delivery from cache, background refresh)
  const isStaticAsset = (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.ttf')
  );

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cachedRes) => {
        if (cachedRes) return cachedRes;
        return caches.match(req, { ignoreSearch: true });
      }).then((cachedRes) => {
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
      icon: payload.icon || 'icon-192.png',
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
        icon: 'icon-192.png',
        badge: 'favicon.ico'
      })
    );
  }
});
