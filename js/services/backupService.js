import { appConfig } from "../config.js";
import { nowIso } from "../core/helpers.js";
import { bulkPutRecords, clearStore, getAllRecords } from "../db/indexeddb.js";
import { getStoredActiveProjectUuid, getStoredDraftCollar, setStoredActiveProjectUuid, setStoredDraftCollar } from "./storageService.js";

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportBackup() {
  const [projects, collars, syncQueue, surveys, assays, laboratorios] = await Promise.all([
    getAllRecords("proyectos"),
    getAllRecords("collars"),
    getAllRecords("sync_queue"),
    getAllRecords("surveys"),
    getAllRecords("assays"),
    getAllRecords("laboratorios"),
  ]);

  const backup = {
    app: appConfig.appName,
    schema: 1,
    exported_at: nowIso(),
    active_project_uuid: getStoredActiveProjectUuid(),
    draft_collar: getStoredDraftCollar(),
    data: {
      proyectos: projects,
      collars,
      sync_queue: syncQueue,
      surveys,
      assays,
      laboratorios,
    },
  };

  const stamp = backup.exported_at.replaceAll(":", "-").replaceAll(".", "-");
  downloadTextFile(`exploracion-backup-${stamp}.json`, JSON.stringify(backup, null, 2));
  return backup;
}

export async function importBackup(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);

  if (!parsed?.data?.proyectos || !parsed?.data?.collars || !parsed?.data?.sync_queue) {
    throw new Error("El archivo de respaldo no tiene el formato esperado.");
  }

  await clearStore("laboratorios");
  await clearStore("assays");
  await clearStore("surveys");
  await clearStore("sync_queue");
  await clearStore("collars");
  await clearStore("proyectos");

  await bulkPutRecords("proyectos", parsed.data.proyectos);
  await bulkPutRecords("collars", parsed.data.collars);
  await bulkPutRecords("sync_queue", parsed.data.sync_queue);
  await bulkPutRecords("surveys", parsed.data.surveys || []);
  await bulkPutRecords("assays", parsed.data.assays || []);
  await bulkPutRecords("laboratorios", parsed.data.laboratorios || []);

  setStoredActiveProjectUuid(parsed.active_project_uuid || "");
  setStoredDraftCollar(parsed.draft_collar || null);

  return {
    projects: parsed.data.proyectos.length,
    collars: parsed.data.collars.length,
    syncQueue: parsed.data.sync_queue.length,
    surveys: (parsed.data.surveys || []).length,
    assays: (parsed.data.assays || []).length,
    laboratorios: (parsed.data.laboratorios || []).length,
  };
}