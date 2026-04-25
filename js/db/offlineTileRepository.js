import { clearStore, deleteRecord, getAllRecords, putRecord } from "./indexeddb.js";

const STORE_NAME = "offline_tile_manifests";

export async function listOfflineTileManifests() {
  const manifests = await getAllRecords(STORE_NAME);
  return manifests.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
}

export async function getLatestOfflineTileManifest() {
  const manifests = await listOfflineTileManifests();
  return manifests[0] || null;
}

export function saveOfflineTileManifest(manifest) {
  return putRecord(STORE_NAME, manifest);
}

export function deleteOfflineTileManifest(id) {
  return deleteRecord(STORE_NAME, id);
}

export function clearOfflineTileManifests() {
  return clearStore(STORE_NAME);
}
