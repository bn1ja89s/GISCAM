const APP_CACHE_NAME = "pwa-exploracion-app-v26";
const ARCGIS_CACHE_NAME = "pwa-exploracion-arcgis-v26";
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
  "./js/db/guardadoRepository.js",
  "./js/services/mapService.js",
  "./js/services/elevationService.js",
  "./js/services/offlineMapService.js",
  "./js/services/offlineTileService.js",
  "./js/services/syncService.js",
  "./js/services/storageService.js",
  "./js/services/assayService.js",
  "./js/services/backupService.js",
  "./js/services/collarService.js",
  "./js/services/csvImportService.js",
  "./js/services/guardadoService.js",
  "./js/services/laboratorioService.js",
  "./js/services/mapDrawingService.js",
  "./js/services/proyectoService.js",
  "./js/services/surveyService.js",
  "./js/ui/icons.js",
  "./js/ui/loaders.js",
  "./js/ui/modal.js",
  "./js/ui/notifications.js",
  "./js/ui/statusBadge.js",
  "./js/components/sidebar.js",
  "./js/components/topbar.js",
  "./js/components/mapToolbar.js",
  "./js/components/projectForm.js",
  "./js/components/projectList.js",
  "./js/components/collarForm.js",
  "./js/components/collarList.js",
  "./js/components/surveyForm.js",
  "./js/components/surveyList.js",
  "./js/components/assayForm.js",
  "./js/components/assayList.js",
  "./js/components/laboratorioForm.js",
  "./js/components/laboratorioList.js",
  "./js/pages/dashboardPage.js",
  "./js/pages/proyectoPage.js",
  "./js/pages/collarPage.js",
  "./js/pages/surveyPage.js",
  "./js/pages/assayPage.js",
  "./js/pages/laboratorioPage.js",
  "./js/pages/mapaPage.js",
  "./js/pages/syncPage.js",
  "./js/pages/guardadoPage.js",
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
  return isArcGISRequest(url) && /\/tile\/\d+\/\d+\/\d+/i.test(url.pathname);
}

function isStaticAssetRequest(url) {
  return /\.(?:css|js|mjs|json|webmanifest|svg|png|jpg|jpeg|webp|gif|ico|woff2?|ttf|otf)$/i.test(url.pathname);
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

    if (request.mode === "navigate") {
      const appShell = await caches.match("./index.html");
      if (appShell) {
        return appShell;
      }
    }

    return new Response("", { status: 504, statusText: "Gateway Timeout" });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await caches.match(request);
  const networkResponsePromise = fetch(request)
    .then((response) => putInCache(cacheName, request, response))
    .catch(() => cachedResponse || new Response("", { status: 504, statusText: "Gateway Timeout" }));

  return cachedResponse || networkResponsePromise;
}

async function tileStrategy(request) {
  const cache = await caches.open(TILE_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    console.debug("[SW] tile cache hit", request.url);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") {
      cache.put(request, response.clone()).catch(() => {});
    }

    return response;
  } catch {
    console.debug("[SW] tile unavailable offline", request.url);
    return new Response("", { status: 504, statusText: "Gateway Timeout" });
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
    caches.open(APP_CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => console.info("[SW] app shell precached", APP_CACHE_NAME)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && ![APP_CACHE_NAME, ARCGIS_CACHE_NAME, TILE_CACHE_NAME].includes(key))
          .map((key) => caches.delete(key)),
      ))
      .then(() => console.info("[SW] activated", APP_CACHE_NAME)),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, APP_CACHE_NAME));
    return;
  }

  if (isMapTileRequest(requestUrl)) {
    event.respondWith(tileStrategy(event.request));
    return;
  }

  if (requestUrl.origin === self.location.origin) {
    event.respondWith(
      isStaticAssetRequest(requestUrl)
        ? staleWhileRevalidate(event.request, APP_CACHE_NAME)
        : networkFirst(event.request, APP_CACHE_NAME),
    );
    return;
  }

  if (isArcGISRequest(requestUrl)) {
    event.respondWith(staleWhileRevalidate(event.request, ARCGIS_CACHE_NAME));
    return;
  }

  event.respondWith(networkFirst(event.request, APP_CACHE_NAME));
});

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-collars") {
    event.waitUntil(syncPendingCollars());
  }
});
