// Al-Muslim Group ERP - Service Worker v4.22.4
// KILL SWITCH: Clears ALL old caches, unregisters self, passes all requests direct to network.
// This replaces broken v4.9.9 and all previous cached versions.

var SW_VERSION = 'kill-v4.22.4';

// INSTALL: Skip waiting immediately so this SW takes over right away
self.addEventListener('install', function(event) {
  console.log('[SW Kill] Installing kill-switch SW ' + SW_VERSION);
  // Force immediate activation — no waiting
  self.skipWaiting();
  event.waitUntil(
    // Nuke ALL caches
    caches.keys().then(function(keys) {
      console.log('[SW Kill] Deleting all caches:', keys);
      return Promise.all(keys.map(function(key) {
        return caches.delete(key);
      }));
    })
  );
});

// ACTIVATE: Claim all open clients immediately, then self-unregister
self.addEventListener('activate', function(event) {
  console.log('[SW Kill] Activating kill-switch SW — wiping all caches and unregistering');
  event.waitUntil(
    // Delete all remaining caches
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) {
        return caches.delete(key);
      }));
    }).then(function() {
      // Claim all clients so they get the network-fresh version
      return self.clients.claim();
    }).then(function() {
      // Notify all clients to reload
      return self.clients.matchAll({ includeUncontrolled: true }).then(function(clients) {
        clients.forEach(function(client) {
          console.log('[SW Kill] Telling client to reload:', client.url);
          client.postMessage({ type: 'SW_KILLED', action: 'RELOAD' });
        });
      });
    }).then(function() {
      // Self-unregister so no SW remains installed
      return self.registration.unregister();
    })
  );
});

// FETCH: Pure network pass-through — NO caching whatsoever
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  // Go direct to network, no cache read or write
  event.respondWith(
    fetch(event.request.clone()).catch(function(err) {
      console.warn('[SW Kill] Network fetch failed:', event.request.url, err);
      // Last resort: try cache (won't exist after kill but safe fallback)
      return caches.match(event.request);
    })
  );
});

// MESSAGE: Handle any manual clear-cache requests
self.addEventListener('message', function(event) {
  if (event.data && (event.data.type === 'CLEAR_CACHE' || event.data.type === 'KILL')) {
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) { return caches.delete(key); }));
    }).then(function() {
      self.registration.unregister();
    });
  }
});
