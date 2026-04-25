import { addRecord, deleteRecord, getAllRecords, getRecordByIndex, getRecordsByIndex, putRecord } from "./indexeddb.js";
import { sortByDate } from "../core/helpers.js";

const STORE = "assays";

export async function listAssays() {
  return sortByDate(await getAllRecords(STORE));
}

export function getAssayByUuid(uuid) {
  return getRecordByIndex(STORE, "uuid", uuid);
}

export function listAssaysByCollar(collarUuid) {
  return getRecordsByIndex(STORE, "collar_uuid", collarUuid);
}

export async function saveAssay(assay) {
  if (assay.id_local) {
    await putRecord(STORE, assay);
    return assay;
  }

  const idLocal = await addRecord(STORE, assay);
  return { ...assay, id_local: idLocal };
}

export function deleteAssayByLocalId(idLocal) {
  return deleteRecord(STORE, idLocal);
}