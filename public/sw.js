// Al-Muslim Group ERP - Service Worker
// Handles automatic cache invalidation on new deployments

var CACHE_NAME = 'al-muslim-erp-v4.9.9';
var STATIC_ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './css/grid.css',
  './css/components.css',
  './css/print.css',
  './js/app.js'
];

// Install: cache core assets
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    }).catch(function(e) {
      console.warn('SW: cache install failed', e);
    })
  );
});

// Activate: clear OLD caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) {
              console.log('SW: Deleting old cache:', key);
              return caches.delete(key);
            })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: network-first strategy (always try server, fallback to cache)
self.addEventListener('fetch', function(event) {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      // Cache fresh responses
      if (response && response.status === 200) {
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
      }
      return response;
    }).catch(function() {
      // Network failed, serve from cache
      return caches.match(event.request);
    })
  );
});

// Message: force refresh from admin panel
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) { return caches.delete(key); }));
    }).then(function() {
      self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'CACHE_CLEARED' });
        });
      });
    });
  }
});
