import { appConfig } from "../config.js";
import { createUuid, nowIso, todayValue, toNumber } from "../core/helpers.js";
import { validateLaboratorio } from "../core/validators.js";
import { deleteLaboratorioByLocalId, getLaboratorioByUuid, listLaboratorios, saveLaboratorio } from "../db/laboratorioRepository.js";
import { removeSyncItemsByEntity } from "../db/syncRepository.js";
import { showToast } from "../ui/notifications.js";
import { enqueueChange } from "./syncService.js";

const SURVEY123_RESULTS_URL = "https://services7.arcgis.com/wkSH3B0op2WjGe48/arcgis/rest/services/survey123_efe1ec48975d45e7ac53271de6dd58fc_results/FeatureServer/0";

export function obtenerLaboratoriosLocales() {
  return listLaboratorios();
}

async function guardarLaboratorioLocal(laboratorio) {
  const existing = await getLaboratorioByUuid(laboratorio.uuid);
  return saveLaboratorio(existing ? { ...existing, ...laboratorio, id_local: existing.id_local } : laboratorio);
}

function toDateInputValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function toIsoValue(value) {
  if (!value) {
    return nowIso();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? nowIso() : date.toISOString();
}

function pickAttribute(attributes, names, fallback = "") {
  for (const name of names) {
    if (attributes[name] !== undefined && attributes[name] !== null && attributes[name] !== "") {
      return attributes[name];
    }
  }

  const lowerMap = new Map(Object.entries(attributes).map(([key, value]) => [key.toLowerCase(), value]));
  for (const name of names) {
    const value = lowerMap.get(String(name).toLowerCase());
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return fallback;
}

function resolveAssayFromSurvey123(attributes, assays = []) {
  const assayId = String(pickAttribute(attributes, ["assay_id", "assay", "Assay", "ASSAY", "assayid", "assayId"])).trim();
  const muestraId = String(pickAttribute(attributes, ["muestra_id", "muestra", "Muestra_ID", "Muestra ID", "sample_id", "sampleId"])).trim();

  return assays.find((assay) => {
    const candidates = [
      assay.uuid,
      assay.global_id_remoto,
      assay.remote_object_id,
      assay.muestra_id,
      assay.hole_id,
    ].map((value) => String(value || "").trim()).filter(Boolean);

    return candidates.includes(assayId) || (muestraId && assay.muestra_id === muestraId);
  }) || null;
}

function mapSurvey123Feature(feature, assays = []) {
  const attributes = feature.attributes || {};
  const objectId = attributes.objectid ?? attributes.OBJECTID;
  if (objectId === undefined || objectId === null) {
    return null;
  }

  const linkedAssay = resolveAssayFromSurvey123(attributes, assays);
  const createdAt = toIsoValue(attributes.CreationDate);
  const surveyAssayId = String(pickAttribute(attributes, ["assay_id", "assay", "Assay", "ASSAY", "assayid", "assayId"])).trim();
  const muestraId = String(pickAttribute(attributes, ["muestra_id", "muestra", "Muestra_ID", "Muestra ID", "sample_id", "sampleId"], linkedAssay?.muestra_id || "")).trim();

  return {
    uuid: `survey123_${objectId}`,
    global_id_remoto: attributes.globalid || attributes.GlobalID || "",
    remote_object_id: String(objectId || ""),
    survey123_objectid: objectId,
    assay_uuid: linkedAssay?.uuid || "",
    survey123_assay_id: surveyAssayId,
    assay_global_id_remoto: linkedAssay?.global_id_remoto || "",
    muestra_id: muestraId,
    fecha_recepcion: toDateInputValue(pickAttribute(attributes, ["fecha_recepcion", "fechaRecepcion", "Fecha recepción", "Fecha recepcion"])),
    laboratorio: String(pickAttribute(attributes, ["laboratorio", "Laboratorio"])).trim(),
    contraccion: pickAttribute(attributes, ["contraccion", "contracción", "Contracción", "Contraccion"], ""),
    absorcion: pickAttribute(attributes, ["absorcion", "absorción", "Absorción", "Absorcion"], ""),
    color_q: String(pickAttribute(attributes, ["color_q", "colorQ", "Color Q", "Color_Q"])).trim(),
    observaciones: String(pickAttribute(attributes, ["observaciones", "Observaciones"])).trim(),
    fuente: "survey123",
    estado_sync: appConfig.status.synced,
    fecha_creacion: createdAt,
    fecha_modificacion: createdAt,
  };
}

export async function obtenerLaboratoriosDeArcGIS(assays = []) {
  if (!navigator.onLine) {
    return obtenerLaboratoriosLocales();
  }

  try {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      returnGeometry: "false",
      orderByFields: "CreationDate DESC",
      f: "json",
    });

    const response = await fetch(`${SURVEY123_RESULTS_URL}/query?${params}`);
    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error?.message || `Survey123 respondio ${response.status}`);
    }

    const registros = (data.features || [])
      .map((feature) => mapSurvey123Feature(feature, assays))
      .filter(Boolean);

    for (const registro of registros) {
      await guardarLaboratorioLocal(registro);
    }

    return registros;
  } catch (error) {
    console.error("Error Survey123:", error);
    showToast("Mostrando datos locales", "warning");
    return obtenerLaboratoriosLocales();
  }
}

function buildLaboratorio(data, assay) {
  return {
    assay_uuid: assay.uuid,
    assay_global_id_remoto: assay.global_id_remoto || "",
    muestra_id: data.muestra_id?.trim() || assay.muestra_id || "",
    fecha_recepcion: data.fecha_recepcion || todayValue(),
    laboratorio: data.laboratorio?.trim() || "",
    contraccion: toNumber(data.contraccion),
    absorcion: toNumber(data.absorcion),
    color_q: data.color_q?.trim() || "",
    observaciones: data.observaciones?.trim() || "",
  };
}

export async function createLaboratorio(data, assays) {
  const assay = assays.find((item) => item.uuid === data.assay_uuid);
  if (!assay) {
    throw new Error("Debes seleccionar un assay valido para el laboratorio.");
  }

  const now = nowIso();
  const laboratorio = {
    uuid: createUuid(),
    global_id_remoto: "",
    remote_object_id: "",
    ...buildLaboratorio(data, assay),
    estado_sync: appConfig.status.pending,
    fecha_creacion: now,
    fecha_modificacion: now,
  };

  const errors = validateLaboratorio(laboratorio);
  if (errors.length) {
    throw new Error(errors.join(" "));
  }

  const saved = await saveLaboratorio(laboratorio);
  await enqueueChange("laboratorio", saved.uuid, "create", saved);
  return saved;
}

export async function updateLaboratorio(uuid, data, assays) {
  const existing = await getLaboratorioByUuid(uuid);
  if (!existing) {
    throw new Error("No se encontro el registro de laboratorio a editar.");
  }

  const assay = assays.find((item) => item.uuid === data.assay_uuid);
  if (!assay) {
    throw new Error("Debes seleccionar un assay valido para el laboratorio.");
  }

  const nextLaboratorio = {
    ...existing,
    ...buildLaboratorio(data, assay),
    estado_sync: appConfig.status.pending,
    fecha_modificacion: nowIso(),
  };

  const errors = validateLaboratorio(nextLaboratorio);
  if (errors.length) {
    throw new Error(errors.join(" "));
  }

  await saveLaboratorio(nextLaboratorio);
  await enqueueChange("laboratorio", nextLaboratorio.uuid, "update", nextLaboratorio);
  return nextLaboratorio;
}

export async function deleteLaboratorio(uuid) {
  const existing = await getLaboratorioByUuid(uuid);
  if (!existing) {
    throw new Error("No se encontro el registro de laboratorio a eliminar.");
  }

  await removeSyncItemsByEntity("laboratorio", existing.uuid);
  if (existing.global_id_remoto || existing.remote_object_id) {
    await enqueueChange("laboratorio", existing.uuid, "delete", existing);
  }

  await deleteLaboratorioByLocalId(existing.id_local);
  return existing;
}
