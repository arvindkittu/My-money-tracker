const CACHE_NAME = "my-money-v26";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Never cache Supabase API responses.
  // Always allow the request to reach the live server.
  if (url.hostname.endsWith(".supabase.co")) {
    return;
  }

  // Handle only the application's normal cache strategy below.
  const isAppRequest = url.origin === self.location.origin;

  if (!isAppRequest) return;

  // Always try to get fresh application HTML.
  if (
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html")
  ) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then(cache =>
              cache.put(event.request, copy)
            );
          }

          return response;
        })
        .catch(() =>
          caches.match(event.request)
            .then(cached =>
              cached || caches.match("./index.html")
            )
        )
    );

    return;
  }

  // Always try to get fresh application JavaScript.
  if (url.pathname.endsWith("/app.js")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then(cache =>
              cache.put(event.request, copy)
            );
          }

          return response;
        })
        .catch(() => caches.match(event.request))
    );

    return;
  }

  // Cache-first strategy for other application assets.
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached ||
      fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache =>
            cache.put(event.request, copy)
          );
        }

        return response;
      })
    )
  );
});
