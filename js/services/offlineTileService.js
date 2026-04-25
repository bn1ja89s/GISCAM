import { appConfig } from "../config.js";
import { clearOfflineTileManifests, getLatestOfflineTileManifest, listOfflineTileManifests, saveOfflineTileManifest } from "../db/offlineTileRepository.js";

export const TILE_CACHE_NAME = "map-tiles-v2";

const WEB_MERCATOR_MAX_LATITUDE = 85.05112878;
const DEFAULT_MIN_ZOOM = 10;
const DEFAULT_MAX_ZOOM = 16;
const DEFAULT_TILE_LAYER_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer";
const DEFAULT_MAX_TILES = 25000;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createLocalUuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `tile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function roundNumber(value, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

function getTileLayerUrl() {
  return String(appConfig.map?.offlineTileLayerUrl || DEFAULT_TILE_LAYER_URL).replace(/\/+$/, "");
}

export function buildOfflineTileUrl(z, x, y, tileLayerUrl = getTileLayerUrl()) {
  return `${String(tileLayerUrl).replace(/\/+$/, "")}/tile/${z}/${y}/${x}`;
}

function normalizeBounds(bounds) {
  const xmin = clamp(Number(bounds?.xmin), -180, 180);
  const xmax = clamp(Number(bounds?.xmax), -180, 180);
  const ymin = clamp(Number(bounds?.ymin), -WEB_MERCATOR_MAX_LATITUDE, WEB_MERCATOR_MAX_LATITUDE);
  const ymax = clamp(Number(bounds?.ymax), -WEB_MERCATOR_MAX_LATITUDE, WEB_MERCATOR_MAX_LATITUDE);

  if (![xmin, xmax, ymin, ymax].every(Number.isFinite)) {
    throw new Error("No se pudo determinar el area visible del mapa.");
  }

  return {
    xmin: roundNumber(Math.min(xmin, xmax), 6),
    ymin: roundNumber(Math.min(ymin, ymax), 6),
    xmax: roundNumber(Math.max(xmin, xmax), 6),
    ymax: roundNumber(Math.max(ymin, ymax), 6),
  };
}

function longitudeToTileX(longitude, zoom) {
  const tiles = 2 ** zoom;
  return clamp(Math.floor(((longitude + 180) / 360) * tiles), 0, tiles - 1);
}

function latitudeToTileY(latitude, zoom) {
  const clampedLatitude = clamp(latitude, -WEB_MERCATOR_MAX_LATITUDE, WEB_MERCATOR_MAX_LATITUDE);
  const radians = clampedLatitude * Math.PI / 180;
  const tiles = 2 ** zoom;
  return clamp(Math.floor(((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * tiles), 0, tiles - 1);
}

export function tileXToLongitude(x, zoom) {
  return (x / (2 ** zoom)) * 360 - 180;
}

export function tileYToLatitude(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / (2 ** zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function getTileBounds(z, x, y) {
  return {
    xmin: tileXToLongitude(x, z),
    xmax: tileXToLongitude(x + 1, z),
    ymax: tileYToLatitude(y, z),
    ymin: tileYToLatitude(y + 1, z),
  };
}

function getTileKey(tile) {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

export function createTileLookup(manifest) {
  return new Set((manifest?.tiles || []).map(getTileKey));
}

export function hasTileInManifest(manifest, z, x, y) {
  return createTileLookup(manifest).has(`${z}/${x}/${y}`);
}

export function buildTilePlan(bounds, options = {}) {
  const normalizedBounds = normalizeBounds(bounds);
  const minZoom = Number(options.minZoom ?? appConfig.map?.offlineTileMinZoom ?? DEFAULT_MIN_ZOOM);
  const maxZoom = Number(options.maxZoom ?? appConfig.map?.offlineTileMaxZoom ?? DEFAULT_MAX_ZOOM);
  const maxTiles = Number(appConfig.map?.offlineTileMaxTiles || DEFAULT_MAX_TILES);
  const tileLayerUrl = String(options.tileLayerUrl || getTileLayerUrl()).replace(/\/+$/, "");
  const tiles = [];

  for (let z = minZoom; z <= maxZoom; z += 1) {
    const minX = longitudeToTileX(normalizedBounds.xmin, z);
    const maxX = longitudeToTileX(normalizedBounds.xmax, z);
    const minY = latitudeToTileY(normalizedBounds.ymax, z);
    const maxY = latitudeToTileY(normalizedBounds.ymin, z);

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        tiles.push({
          z,
          x,
          y,
          url: buildOfflineTileUrl(z, x, y, tileLayerUrl),
        });
      }
    }
  }

  if (tiles.length > maxTiles) {
    throw new Error(`La zona visible requiere ${tiles.length} tiles. Reduce el area o el rango de zoom (limite ${maxTiles}).`);
  }

  return {
    id: createLocalUuid(),
    created_at: new Date().toISOString(),
    tile_layer_url: tileLayerUrl,
    min_zoom: minZoom,
    max_zoom: maxZoom,
    bounds: normalizedBounds,
    project_uuid: options.projectUuid || "",
    project_name: options.projectName || "",
    tiles,
  };
}

async function getResponseSize(response) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 0) {
    return contentLength;
  }

  try {
    const blob = await response.clone().blob();
    return blob.size || 0;
  } catch {
    return 0;
  }
}

export async function downloadTilePlan(plan, { onProgress } = {}) {
  const cache = await caches.open(TILE_CACHE_NAME);
  const total = plan.tiles.length;
  const savedTiles = [];
  let downloaded = 0;
  let skipped = 0;
  let errors = 0;
  let totalBytes = 0;

  for (const tile of plan.tiles) {
    let size = 0;
    let status = "downloaded";

    try {
      const cached = await cache.match(tile.url);
      if (cached) {
        skipped += 1;
        status = "cached";
        size = await getResponseSize(cached);
      } else {
        const response = await fetch(tile.url, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        size = await getResponseSize(response);
        await cache.put(tile.url, response.clone());
        downloaded += 1;
      }

      totalBytes += size;
      savedTiles.push({
        ...tile,
        key: getTileKey(tile),
        cached_at: new Date().toISOString(),
        size,
        status,
      });
    } catch (error) {
      errors += 1;
      savedTiles.push({
        ...tile,
        key: getTileKey(tile),
        cached_at: new Date().toISOString(),
        size: 0,
        status: "error",
        error: error?.message || "No se pudo descargar el tile.",
      });
    }

    onProgress?.({
      total,
      completed: downloaded + skipped + errors,
      downloaded,
      skipped,
      errors,
      totalBytes,
    });
  }

  const manifest = {
    ...plan,
    completed_at: new Date().toISOString(),
    tile_count: savedTiles.filter((tile) => tile.status !== "error").length,
    error_count: errors,
    total_bytes: totalBytes,
    tiles: savedTiles.filter((tile) => tile.status !== "error"),
  };

  await saveOfflineTileManifest(manifest);

  return {
    manifest,
    downloaded,
    skipped,
    errors,
    totalBytes,
    total,
  };
}

export async function getOfflineTileSummary() {
  const manifests = await listOfflineTileManifests();
  const tileKeys = new Set();
  let totalBytes = 0;

  for (const manifest of manifests) {
    totalBytes += Number(manifest.total_bytes || 0);
    for (const tile of manifest.tiles || []) {
      tileKeys.add(tile.key || getTileKey(tile));
    }
  }

  let storage = null;
  if (navigator.storage?.estimate) {
    storage = await navigator.storage.estimate().catch(() => null);
  }

  return {
    manifests,
    latestManifest: manifests[0] || null,
    tileCount: tileKeys.size,
    totalBytes,
    storage,
  };
}

export async function hasOfflineTiles() {
  const summary = await getOfflineTileSummary();
  return summary.tileCount > 0;
}

export async function clearOfflineTiles() {
  await Promise.all([
    caches.delete(TILE_CACHE_NAME),
    caches.delete("map-tiles-v1"),
    clearOfflineTileManifests(),
  ]);
}

export { getLatestOfflineTileManifest };
