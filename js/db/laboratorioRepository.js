import { addRecord, deleteRecord, getAllRecords, getRecordByIndex, getRecordsByIndex, putRecord } from "./indexeddb.js";
import { sortByDate } from "../core/helpers.js";

const STORE = "laboratorios";

export async function listLaboratorios() {
  return sortByDate(await getAllRecords(STORE));
}

export function getLaboratorioByUuid(uuid) {
  return getRecordByIndex(STORE, "uuid", uuid);
}

export function listLaboratoriosByAssay(assayUuid) {
  return getRecordsByIndex(STORE, "assay_uuid", assayUuid);
}

export async function saveLaboratorio(laboratorio) {
  if (laboratorio.id_local) {
    await putRecord(STORE, laboratorio);
    return laboratorio;
  }

  const idLocal = await addRecord(STORE, laboratorio);
  return { ...laboratorio, id_local: idLocal };
}

export function deleteLaboratorioByLocalId(idLocal) {
  return deleteRecord(STORE, idLocal);
}