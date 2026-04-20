const APP_CACHE_NAME = "pwa-exploracion-app-v23";
const ARCGIS_CACHE_NAME = "pwa-exploracion-arcgis-v23";
const CACHE_PREFIX = "pwa-exploracion-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/reset.css",
  "./css/variables.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/app.css",
  "./js/app.js",
  "./js/router.js",
  "./js/config.js",
  "./js/services/mapService.js",
  "./js/services/elevationService.js",
  "./js/services/offlineMapService.js",
  "./js/ui/icons.js",
  "./docs/assay_template.csv",
  "./docs/survey_template.csv",
  "./assets/icons/icon-192.svg",
  "./assets/icons/icon-512.svg",
];

function isCacheableResponse(response) {
  return Boolean(response) && (response.ok || response.type === "opaque");
}

function isArcGISRequest(url) {
  return url.hostname.endsWith(".arcgis.com") || url.hostname.endsWith(".arcgisonline.com");
}

async function putInCache(cacheName, request, response) {
  if (!isCacheableResponse(response)) {
    return response;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    return await putInCache(cacheName, request, networkResponse);
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    throw new Error("No hay respuesta disponible en cache.");
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await caches.match(request);
  const networkResponsePromise = fetch(request)
    .then((response) => putInCache(cacheName, request, response))
    .catch(() => cachedResponse);

  return cachedResponse || networkResponsePromise;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && ![APP_CACHE_NAME, ARCGIS_CACHE_NAME].includes(key))
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (event.request.method !== "GET") {
    return;
  }

  if (requestUrl.origin === self.location.origin) {
    event.respondWith(networkFirst(event.request, APP_CACHE_NAME));
    return;
  }

  if (isArcGISRequest(requestUrl)) {
    event.respondWith(staleWhileRevalidate(event.request, ARCGIS_CACHE_NAME));
  }
});