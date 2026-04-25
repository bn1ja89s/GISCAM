import { appConfig } from "../config.js";
import { nowIso } from "../core/helpers.js";

export const TILE_CACHE_NAME = "map-tiles-v1";

const EMPTY_TILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="rgba(245,248,245,0.92)"/><path d="M0 0H256V256H0Z" fill="none"/><path d="M0 128H256M128 0V256" stroke="rgba(45,90,39,0.12)" stroke-width="1"/></svg>`;
const EMPTY_TILE_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(EMPTY_TILE_SVG)}`;

function getManifestKey() {
  return appConfig.storageKeys.offlineTileManifest || "exploracion-offline-tile-manifest-v1";
}

function createEmptyManifest() {
  return {
    version: 1,
    updatedAt: "",
    layerUrl: "",
    urlTemplate: "",
    tileInfo: null,
    spatialReference: null,
    fullExtent: null,
    downloads: [],
    tiles: {},
  };
}

function normalizeUrl(url) {
  return String(url || "").split("?")[0].replace(/\/+$/, "");
}

function tileKey({ z, x, y }) {
  return `${Number(z)}/${Number(x)}/${Number(y)}`;
}

export function getTransparentTileUrl() {
  return EMPTY_TILE_URL;
}

export function parseTileUrl(url) {
  const match = String(url || "").match(/\/tile\/(\d+)\/(\d+)\/(\d+)(?:\D|$)/i);
  if (!match) {
    return null;
  }

  return {
    z: Number(match[1]),
    y: Number(match[2]),
    x: Number(match[3]),
  };
}

export function readOfflineTileManifest() {
  try {
    const raw = localStorage.getItem(getManifestKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.version ? parsed : createEmptyManifest();
  } catch {
    return createEmptyManifest();
  }
}

export function writeOfflineTileManifest(manifest) {
  const nextManifest = {
    ...createEmptyManifest(),
    ...manifest,
    updatedAt: nowIso(),
    tiles: manifest?.tiles || {},
    downloads: Array.isArray(manifest?.downloads) ? manifest.downloads : [],
  };
  localStorage.setItem(getManifestKey(), JSON.stringify(nextManifest));
  return nextManifest;
}

export function clearOfflineTileManifest() {
  localStorage.removeItem(getManifestKey());
}

export function getOfflineTileSummary() {
  const manifest = readOfflineTileManifest();
  const tileCount = Object.keys(manifest.tiles || {}).length;
  const byteSize = Object.values(manifest.tiles || {}).reduce((total, tile) => total + (Number(tile.size) || 0), 0);
  const latestDownload = manifest.downloads?.at?.(-1) || null;

  return {
    manifest,
    tileCount,
    byteSize,
    latestDownload,
    hasTiles: tileCount > 0,
  };
}

export function hasOfflineTiles() {
  return getOfflineTileSummary().hasTiles;
}

export async function getStorageEstimate() {
  if (!navigator.storage?.estimate) {
    return { usage: 0, quota: 0 };
  }

  return navigator.storage.estimate();
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1073741824) {
    return `${(value / 1073741824).toFixed(2)} GB`;
  }
  if (value >= 1048576) {
    return `${(value / 1048576).toFixed(1)} MB`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${Math.max(0, Math.round(value))} B`;
}

export function buildTileUrl(layerUrl, z, y, x) {
  return `${normalizeUrl(layerUrl)}/tile/${z}/${y}/${x}`;
}

export async function findCachedTileUrl(level, row, col) {
  const manifest = readOfflineTileManifest();
  const record = manifest.tiles?.[tileKey({ z: level, x: col, y: row })];
  const candidateUrl = record?.url || (manifest.layerUrl ? buildTileUrl(manifest.layerUrl, level, row, col) : "");

  if (!candidateUrl) {
    return "";
  }

  const cache = await caches.open(TILE_CACHE_NAME);
  const cached = await cache.match(candidateUrl);
  return cached ? candidateUrl : "";
}

export async function clearOfflineTiles() {
  clearOfflineTileManifest();
  await caches.delete(TILE_CACHE_NAME);
}

export async function downloadTilePackage(tilePackage, { projectName = "", onProgress } = {}) {
  const records = Array.isArray(tilePackage?.tiles) ? tilePackage.tiles : [];
  if (!records.length) {
    throw new Error("No hay tiles para descargar en la zona visible.");
  }

  const manifest = readOfflineTileManifest();
  const cache = await caches.open(TILE_CACHE_NAME);
  const startedAt = nowIso();
  const bounds = tilePackage.bounds || null;
  const zoomMin = Number(tilePackage.zoomMin);
  const zoomMax = Number(tilePackage.zoomMax);

  let completed = 0;
  let downloaded = 0;
  let skipped = 0;
  let errors = 0;
  let bytes = 0;

  manifest.layerUrl = normalizeUrl(tilePackage.layerUrl || manifest.layerUrl);
  manifest.urlTemplate = tilePackage.urlTemplate || `${manifest.layerUrl}/tile/{z}/{y}/{x}`;
  manifest.tileInfo = tilePackage.tileInfo || manifest.tileInfo;
  manifest.spatialReference = tilePackage.spatialReference || manifest.spatialReference;
  manifest.fullExtent = tilePackage.fullExtent || manifest.fullExtent;

  for (const tile of records) {
    const key = tileKey(tile);
    const url = tile.url;

    try {
      const cached = await cache.match(url);
      if (cached) {
        skipped++;
        manifest.tiles[key] = {
          ...manifest.tiles[key],
          ...tile,
          url,
          cachedAt: manifest.tiles[key]?.cachedAt || nowIso(),
        };
      } else {
        const response = await fetch(url, { mode: "no-cors", cache: "reload" });
        if (!response || (!response.ok && response.type !== "opaque")) {
          throw new Error(`Tile no disponible: ${url}`);
        }

        await cache.put(url, response.clone());
        downloaded++;
        const size = Number(response.headers?.get?.("content-length")) || 0;
        bytes += size;
        manifest.tiles[key] = {
          ...tile,
          url,
          cachedAt: nowIso(),
          size,
        };
      }
    } catch {
      errors++;
    }

    completed++;
    onProgress?.({
      completed,
      total: records.length,
      downloaded,
      skipped,
      errors,
      bytes,
    });
  }

  manifest.downloads.push({
    id: `download-${Date.now()}`,
    projectName,
    startedAt,
    finishedAt: nowIso(),
    bounds,
    zoomMin: Number.isFinite(zoomMin) ? zoomMin : null,
    zoomMax: Number.isFinite(zoomMax) ? zoomMax : null,
    total: records.length,
    downloaded,
    skipped,
    errors,
    bytes,
    layerUrl: manifest.layerUrl,
  });

  writeOfflineTileManifest(manifest);

  return {
    total: records.length,
    downloaded,
    skipped,
    errors,
    bytes,
    manifest,
  };
}
