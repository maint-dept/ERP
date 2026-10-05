// Al-Muslim Group ERP - Service Worker v4.22.24
// KILL SWITCH: Clears ALL caches, unregisters immediately, and leaves all fetches to native browser network stack.

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) { return caches.delete(key); }));
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) { return caches.delete(key); }));
    }).then(function() {
      return self.clients.claim();
    }).then(function() {
      return self.registration.unregister();
    })
  );
});

// NO FETCH INTERCEPTION: Requests go directly to network

