import { addRecord, deleteRecord, getAllRecords, putRecord } from "./indexeddb.js";
import { nowIso, sortByDate } from "../core/helpers.js";

const STORE = "sync_queue";

export async function listSyncQueue() {
  return sortByDate(await getAllRecords(STORE), "updated_at");
}

export async function enqueueSync(item) {
  const now = nowIso();
  const queueRecord = {
    status: "pendiente",
    attempts: 0,
    last_error: "",
    created_at: now,
    updated_at: now,
    ...item,
  };
  const id = await addRecord(STORE, queueRecord);
  return { ...queueRecord, id };
}

export async function updateSyncItem(item) {
  const record = {
    ...item,
    updated_at: nowIso(),
  };
  await putRecord(STORE, record);
  return record;
}

export async function removeSyncItem(id) {
  return deleteRecord(STORE, id);
}

export async function removeSyncItemsByEntity(entityType, entityUuid) {
  const items = await listSyncQueue();
  const matches = items.filter((item) => item.entity_type === entityType && item.entity_uuid === entityUuid);
  await Promise.all(matches.map((item) => deleteRecord(STORE, item.id)));
  return matches.length;
}