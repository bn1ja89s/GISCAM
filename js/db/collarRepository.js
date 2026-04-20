import { addRecord, deleteRecord, getAllRecords, getRecordByIndex, getRecordsByIndex, putRecord } from "./indexeddb.js";
import { sortByDate } from "../core/helpers.js";

const STORE = "collars";

export async function listCollars() {
  return sortByDate(await getAllRecords(STORE));
}

export function listCollarsByProject(projectUuid) {
  return getRecordsByIndex(STORE, "proyecto_uuid", projectUuid);
}

export function getCollarByUuid(uuid) {
  return getRecordByIndex(STORE, "uuid", uuid);
}

export async function saveCollar(collar) {
  if (collar.id_local) {
    await putRecord(STORE, collar);
    return collar;
  }

  const idLocal = await addRecord(STORE, collar);
  return { ...collar, id_local: idLocal };
}

export function deleteCollarByLocalId(idLocal) {
  return deleteRecord(STORE, idLocal);
}

export async function getCollarByRemoteIds(globalId, objectId) {
  const items = await listCollars();
  return (
    items.find(
      (item) =>
        (globalId && item.global_id_remoto === globalId) ||
        (objectId && String(item.remote_object_id || "") === String(objectId)),
    ) || null
  );
}