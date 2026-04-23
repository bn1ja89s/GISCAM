const APP_CACHE_NAME = "pwa-exploracion-app-v24";
const ARCGIS_CACHE_NAME = "pwa-exploracion-arcgis-v24";
const TILE_CACHE_NAME = "map-tiles-v1";
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
  "./js/services/syncService.js",
  "./js/services/storageService.js",
  "./js/ui/icons.js",
  "./js/ui/notifications.js",
  "./js/ui/statusBadge.js",
  "./js/core/network.js",
  "./js/core/helpers.js",
  "./js/core/dom.js",
  "./js/core/state.js",
  "./js/core/validators.js",
  "./js/core/csv.js",
  "./js/db/indexeddb.js",
  "./js/db/collarRepository.js",
  "./js/db/proyectoRepository.js",
  "./js/db/surveyRepository.js",
  "./js/db/assayRepository.js",
  "./js/db/laboratorioRepository.js",
  "./js/db/syncRepository.js",
  "./docs/assay_template.csv",
  "./docs/survey_template.csv",
  "./assets/icons/icon-192.svg",
  "./assets/icons/icon-512.svg",
  "./js/vendor/proj4.js",
];

function isCacheableResponse(response) {
  return Boolean(response) && (response.ok || response.type === "opaque");
}

function isArcGISRequest(url) {
  return url.hostname.endsWith(".arcgis.com") || url.hostname.endsWith(".arcgisonline.com");
}

function isMapTileRequest(url) {
  return (
    (url.hostname.endsWith(".arcgis.com") || url.hostname.endsWith(".arcgisonline.com")) &&
    url.pathname.includes("/tile/")
  );
}

async function putInCache(cacheName, request, response) {
  if (!isCacheableResponse(response)) {
    return response;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
}

async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    return await putInCache(cacheName, request, networkResponse);
  } catch {
    return new Response("", { status: 504, statusText: "Gateway Timeout" });
  }
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

    return new Response("", { status: 504, statusText: "Gateway Timeout" });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await caches.match(request);
  const networkResponsePromise = fetch(request)
    .then((response) => putInCache(cacheName, request, response))
    .catch(() => cachedResponse);

  return cachedResponse || networkResponsePromise;
}

async function tileStrategy(request) {
  const cache = await caches.open(TILE_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    return cached || new Response("", { status: 504, statusText: "Gateway Timeout" });
  }
}

async function syncPendingCollars() {
  const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of allClients) {
    client.postMessage({ type: "BACKGROUND_SYNC", tag: "sync-collars" });
  }
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
          .filter((key) => key.startsWith(CACHE_PREFIX) && ![APP_CACHE_NAME, ARCGIS_CACHE_NAME, TILE_CACHE_NAME].includes(key))
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

  // Map tiles → Cache First con guardado automatico
  if (isMapTileRequest(requestUrl)) {
    event.respondWith(tileStrategy(event.request));
    return;
  }

  // Assets del origen local → Network First con fallback a cache
  if (requestUrl.origin === self.location.origin) {
    event.respondWith(networkFirst(event.request, APP_CACHE_NAME));
    return;
  }

  // Resto de peticiones ArcGIS (JS, CSS, assets) → Stale-While-Revalidate
  if (isArcGISRequest(requestUrl)) {
    event.respondWith(staleWhileRevalidate(event.request, ARCGIS_CACHE_NAME));
    return;
  }

  // Cualquier otra peticion de red → Network First con fallback
  event.respondWith(networkFirst(event.request, APP_CACHE_NAME));
});

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-collars") {
    event.waitUntil(syncPendingCollars());
  }
});