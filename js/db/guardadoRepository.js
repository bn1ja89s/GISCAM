import { getAllRecords, putRecord, deleteRecord, clearStore } from "./indexeddb.js";

const STORE = "guardado";

export async function listGuardado() {
  const items = await getAllRecords(STORE);
  return items.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

export function saveGuardado(item) {
  return putRecord(STORE, item);
}

export function deleteGuardadoById(id) {
  return deleteRecord(STORE, id);
}

export function clearAllGuardado() {
  return clearStore(STORE);
}
