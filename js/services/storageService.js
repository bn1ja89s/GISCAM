import { appConfig } from "../config.js";

const ALLOWED_CAPTURE_MODES = new Set(["map", "gps"]);

export function getStoredActiveProjectUuid() {
  return localStorage.getItem(appConfig.storageKeys.activeProjectUuid) || "";
}

export function setStoredActiveProjectUuid(uuid) {
  if (!uuid) {
    localStorage.removeItem(appConfig.storageKeys.activeProjectUuid);
    return;
  }

  localStorage.setItem(appConfig.storageKeys.activeProjectUuid, uuid);
}

export function getStoredDraftCollar() {
  try {
    const raw = localStorage.getItem(appConfig.storageKeys.draftCollar);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredDraftCollar(draftCollar) {
  if (!draftCollar) {
    localStorage.removeItem(appConfig.storageKeys.draftCollar);
    return;
  }

  localStorage.setItem(appConfig.storageKeys.draftCollar, JSON.stringify(draftCollar));
}

export function getStoredCaptureMode() {
  const mode = localStorage.getItem(appConfig.storageKeys.captureMode) || "map";
  return ALLOWED_CAPTURE_MODES.has(mode) ? mode : "map";
}

export function setStoredCaptureMode(mode) {
  const normalizedMode = ALLOWED_CAPTURE_MODES.has(mode) ? mode : "map";
  localStorage.setItem(appConfig.storageKeys.captureMode, normalizedMode);
}

export function getStoredArcGISMapCache() {
  try {
    const raw = localStorage.getItem(appConfig.storageKeys.arcgisMapCache);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredArcGISMapCache(cacheMeta) {
  if (!cacheMeta || !cacheMeta.warmedAt) {
    localStorage.removeItem(appConfig.storageKeys.arcgisMapCache);
    return;
  }

  localStorage.setItem(appConfig.storageKeys.arcgisMapCache, JSON.stringify({
    warmedAt: cacheMeta.warmedAt,
    mapId: cacheMeta.mapId || "",
    mapTitle: cacheMeta.mapTitle || "",
  }));
}

export function getStoredDraftHintDismissed() {
  return localStorage.getItem(appConfig.storageKeys.draftHintDismissed) === "1";
}

export function setStoredDraftHintDismissed(dismissed) {
  if (!dismissed) {
    localStorage.removeItem(appConfig.storageKeys.draftHintDismissed);
    return;
  }

  localStorage.setItem(appConfig.storageKeys.draftHintDismissed, "1");
}