const CACHE_NAME = "schulbib-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Install Event
self.addEventListener("install", (event) => {
  (event as any).waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event
self.addEventListener("activate", (event) => {
  (event as any).waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Fetch Event (Stale-while-revalidate or Network-first)
self.addEventListener("fetch", (event) => {
  const req = (event as any).request;
  
  // Only cache GET requests
  if (req.method !== "GET") return;

  (event as any).respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache
        fetch(req)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
            }
          })
          .catch(() => {
            // Ignore background fetch errors
          });
        return cachedResponse;
      }

      return fetch(req).catch(() => {
        // Offline fallback
        return caches.match("/");
      });
    })
  );
});
