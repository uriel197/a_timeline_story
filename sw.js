// sw.js
const CACHE_NAME = "legacy-archive-v2";

const STATIC_ASSETS = [
  "/index.html",
  "/manifest.json",
  "/styles/dashboard.css",
  "/src/canvas-components/styles/canvas.css",
  "/src/main.js",
];

self.addEventListener("install", (event) => {
  console.log("[SW] Installing:", CACHE_NAME);

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Caching static files");
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((err) => console.error("[SW] Caching failed:", err)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }),
      );
    }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      try {
        const response = await fetch(event.request);

        if (response.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone());
        }

        return response;
      } catch (err) {
        if (event.request.mode === "navigate") {
          return caches.match("/index.html");
        }
        return new Response("Offline", { status: 503 });
      }
    })(),
  );
});
