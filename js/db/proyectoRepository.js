import { addRecord, deleteRecord, getAllRecords, getRecordByIndex, putRecord } from "./indexeddb.js";
import { sortByDate } from "../core/helpers.js";

const STORE = "proyectos";

export async function listProjects() {
  return sortByDate(await getAllRecords(STORE));
}

export function getProjectByUuid(uuid) {
  return getRecordByIndex(STORE, "uuid", uuid);
}

export async function saveProject(project) {
  if (project.id_local) {
    await putRecord(STORE, project);
    return project;
  }

  const idLocal = await addRecord(STORE, project);
  return { ...project, id_local: idLocal };
}

export function deleteProjectByLocalId(idLocal) {
  return deleteRecord(STORE, idLocal);
}

export async function getProjectByRemoteIds(globalId, objectId) {
  const items = await listProjects();
  return (
    items.find(
      (item) =>
        (globalId && item.global_id_remoto === globalId) ||
        (objectId && String(item.remote_object_id || "") === String(objectId)),
    ) || null
  );
}