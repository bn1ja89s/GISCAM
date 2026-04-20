import { appConfig } from "../config.js";
import { qs, setHTML } from "../core/dom.js";
import { roundNumber } from "../core/helpers.js";

const MAP_WIDTH = 960;
const MAP_HEIGHT = 640;
const MAP_PADDING = 52;
const MIN_SPAN = 0.01;

const offlineMapState = {
  container: null,
  onCapture: null,
  onSelectCollar: null,
  captureEnabled: false,
  collars: [],
  draftPoint: null,
  currentLocation: null,
  extent: null,
  userAdjustedExtent: false,
  pointerLabel: "",
  listenersBound: false,
  showLabels: true,
  selectedCollarUuid: "",
};

function getDefaultExtent() {
  const configuredExtent = appConfig.map?.offlineExtent;
  if (
    Number.isFinite(configuredExtent?.xmin) &&
    Number.isFinite(configuredExtent?.ymin) &&
    Number.isFinite(configuredExtent?.xmax) &&
    Number.isFinite(configuredExtent?.ymax)
  ) {
    return normalizeExtent(configuredExtent);
  }

  return normalizeExtent({
    xmin: -81.5,
    ymin: -5.5,
    xmax: -74.5,
    ymax: 1.8,
  });
}

function normalizeExtent(extent) {
  const xmin = Number(extent?.xmin);
  const ymin = Number(extent?.ymin);
  const xmax = Number(extent?.xmax);
  const ymax = Number(extent?.ymax);

  if (![xmin, ymin, xmax, ymax].every(Number.isFinite)) {
    return getDefaultExtent();
  }

  const centerX = (xmin + xmax) / 2;
  const centerY = (ymin + ymax) / 2;
  const width = Math.max(Math.abs(xmax - xmin), MIN_SPAN);
  const height = Math.max(Math.abs(ymax - ymin), MIN_SPAN);

  return {
    xmin: roundNumber(centerX - width / 2, 6),
    ymin: roundNumber(centerY - height / 2, 6),
    xmax: roundNumber(centerX + width / 2, 6),
    ymax: roundNumber(centerY + height / 2, 6),
  };
}

function getPointCoordinates(point) {
  const longitude = Number(point?.longitude ?? point?.geometry?.x ?? point?.x);
  const latitude = Number(point?.latitude ?? point?.geometry?.y ?? point?.y);

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  return {
    longitude: roundNumber(longitude, 6),
    latitude: roundNumber(latitude, 6),
  };
}

function collectMapPoints() {
  return [
    ...offlineMapState.collars,
    offlineMapState.draftPoint,
    offlineMapState.currentLocation,
  ].map(getPointCoordinates).filter(Boolean);
}

function buildExtentFromPoints(points) {
  if (!points.length) {
    return getDefaultExtent();
  }

  let xmin = points[0].longitude;
  let ymin = points[0].latitude;
  let xmax = points[0].longitude;
  let ymax = points[0].latitude;

  for (const point of points) {
    xmin = Math.min(xmin, point.longitude);
    ymin = Math.min(ymin, point.latitude);
    xmax = Math.max(xmax, point.longitude);
    ymax = Math.max(ymax, point.latitude);
  }

  const width = Math.max(xmax - xmin, MIN_SPAN);
  const height = Math.max(ymax - ymin, MIN_SPAN);
  const paddingX = Math.max(width * 0.25, MIN_SPAN * 2);
  const paddingY = Math.max(height * 0.25, MIN_SPAN * 2);

  return normalizeExtent({
    xmin: xmin - paddingX,
    ymin: ymin - paddingY,
    xmax: xmax + paddingX,
    ymax: ymax + paddingY,
  });
}

function maybeFitExtent(force = false) {
  if (offlineMapState.userAdjustedExtent && !force) {
    return;
  }

  offlineMapState.extent = buildExtentFromPoints(collectMapPoints());
}

function projectToScreen(point) {
  const coordinates = getPointCoordinates(point);
  if (!coordinates || !offlineMapState.extent) {
    return null;
  }

  const usableWidth = MAP_WIDTH - MAP_PADDING * 2;
  const usableHeight = MAP_HEIGHT - MAP_PADDING * 2;
  const xRatio = (coordinates.longitude - offlineMapState.extent.xmin) / (offlineMapState.extent.xmax - offlineMapState.extent.xmin);
  const yRatio = (offlineMapState.extent.ymax - coordinates.latitude) / (offlineMapState.extent.ymax - offlineMapState.extent.ymin);

  return {
    x: roundNumber(MAP_PADDING + xRatio * usableWidth, 2),
    y: roundNumber(MAP_PADDING + yRatio * usableHeight, 2),
    longitude: coordinates.longitude,
    latitude: coordinates.latitude,
  };
}

function screenToMap(clientX, clientY, surface) {
  if (!offlineMapState.extent || !surface) {
    return null;
  }

  const rect = surface.getBoundingClientRect();
  const scaleX = MAP_WIDTH / rect.width;
  const scaleY = MAP_HEIGHT / rect.height;
  const rawX = (clientX - rect.left) * scaleX;
  const rawY = (clientY - rect.top) * scaleY;
  const clampedX = Math.min(Math.max(rawX, MAP_PADDING), MAP_WIDTH - MAP_PADDING);
  const clampedY = Math.min(Math.max(rawY, MAP_PADDING), MAP_HEIGHT - MAP_PADDING);
  const usableWidth = MAP_WIDTH - MAP_PADDING * 2;
  const usableHeight = MAP_HEIGHT - MAP_PADDING * 2;
  const longitude = offlineMapState.extent.xmin + ((clampedX - MAP_PADDING) / usableWidth) * (offlineMapState.extent.xmax - offlineMapState.extent.xmin);
  const latitude = offlineMapState.extent.ymax - ((clampedY - MAP_PADDING) / usableHeight) * (offlineMapState.extent.ymax - offlineMapState.extent.ymin);

  return {
    longitude: roundNumber(longitude, 6),
    latitude: roundNumber(latitude, 6),
  };
}

function getGridStep(span) {
  const candidates = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
  for (const candidate of candidates) {
    if (span / candidate <= 8) {
      return candidate;
    }
  }

  return candidates.at(-1);
}

function escapeAttribute(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderGrid() {
  if (!offlineMapState.extent) {
    return "";
  }

  const longitudeStep = getGridStep(offlineMapState.extent.xmax - offlineMapState.extent.xmin);
  const latitudeStep = getGridStep(offlineMapState.extent.ymax - offlineMapState.extent.ymin);
  const elements = [];

  for (let longitude = Math.ceil(offlineMapState.extent.xmin / longitudeStep) * longitudeStep; longitude <= offlineMapState.extent.xmax; longitude += longitudeStep) {
    const linePoint = projectToScreen({ longitude, latitude: offlineMapState.extent.ymin });
    if (!linePoint) {
      continue;
    }

    elements.push(`<line x1="${linePoint.x}" y1="${MAP_PADDING}" x2="${linePoint.x}" y2="${MAP_HEIGHT - MAP_PADDING}" class="offline-map-grid-line" />`);
    elements.push(`<text x="${linePoint.x}" y="${MAP_HEIGHT - 16}" text-anchor="middle" class="offline-map-grid-label">${roundNumber(longitude, 3)}</text>`);
  }

  for (let latitude = Math.ceil(offlineMapState.extent.ymin / latitudeStep) * latitudeStep; latitude <= offlineMapState.extent.ymax; latitude += latitudeStep) {
    const linePoint = projectToScreen({ longitude: offlineMapState.extent.xmin, latitude });
    if (!linePoint) {
      continue;
    }

    elements.push(`<line x1="${MAP_PADDING}" y1="${linePoint.y}" x2="${MAP_WIDTH - MAP_PADDING}" y2="${linePoint.y}" class="offline-map-grid-line" />`);
    elements.push(`<text x="14" y="${linePoint.y + 4}" class="offline-map-grid-label">${roundNumber(latitude, 3)}</text>`);
  }

  return elements.join("");
}

function renderCollarMarkers() {
  return offlineMapState.collars.map((collar) => {
    const point = projectToScreen(collar);
    if (!point) {
      return "";
    }

    const markerClass = collar.estado_sync === appConfig.status.error
      ? "offline-map-marker offline-map-marker--error"
      : collar.estado_sync === appConfig.status.synced
        ? "offline-map-marker offline-map-marker--synced"
        : "offline-map-marker offline-map-marker--pending";
    const isSelected = offlineMapState.selectedCollarUuid === collar.uuid;

    return `
      <g class="offline-map-marker-group" transform="translate(${point.x} ${point.y})">
        <title>${escapeAttribute(collar.hole_id || "Collar")}</title>
        ${isSelected ? '<circle r="10" class="offline-map-marker-ring" />' : ""}
        <circle r="6" class="${markerClass}" />
        ${offlineMapState.showLabels && collar.hole_id ? `<text x="10" y="-10" class="offline-map-marker-label">${escapeAttribute(collar.hole_id)}</text>` : ""}
      </g>
    `;
  }).join("");
}

function renderDraftMarker() {
  const point = projectToScreen(offlineMapState.draftPoint);
  if (!point) {
    return "";
  }

  return `
    <g transform="translate(${point.x} ${point.y})">
      <path d="M 0 -10 L 10 0 L 0 10 L -10 0 Z" class="offline-map-draft" />
    </g>
  `;
}

function renderCurrentLocationMarker() {
  const point = projectToScreen(offlineMapState.currentLocation);
  if (!point) {
    return "";
  }

  return `
    <g transform="translate(${point.x} ${point.y})">
      <circle r="12" class="offline-map-current-ring" />
      <circle r="4.5" class="offline-map-current-dot" />
    </g>
  `;
}

function buildPointFromCoordinates(coordinates) {
  return {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    geometry: {
      x: coordinates.longitude,
      y: coordinates.latitude,
      spatialReference: { wkid: 4326 },
    },
  };
}

function getExtentLabel() {
  if (!offlineMapState.extent) {
    return "-";
  }

  const width = roundNumber(offlineMapState.extent.xmax - offlineMapState.extent.xmin, 3);
  const height = roundNumber(offlineMapState.extent.ymax - offlineMapState.extent.ymin, 3);
  return `${width}° x ${height}°`;
}

function renderOfflineMap() {
  if (!offlineMapState.container) {
    return;
  }

  if (!offlineMapState.extent) {
    maybeFitExtent(true);
  }

  setHTML(offlineMapState.container, `
    <div class="offline-map-shell">
      <svg class="offline-map-surface ${offlineMapState.captureEnabled ? "is-capture-active" : ""}" data-offline-map-surface viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" aria-label="Mapa offline de captura">
        <rect x="0" y="0" width="${MAP_WIDTH}" height="${MAP_HEIGHT}" class="offline-map-background" />
        <rect x="${MAP_PADDING}" y="${MAP_PADDING}" width="${MAP_WIDTH - MAP_PADDING * 2}" height="${MAP_HEIGHT - MAP_PADDING * 2}" class="offline-map-frame" />
        ${renderGrid()}
        ${renderCollarMarkers()}
        ${renderCurrentLocationMarker()}
        ${renderDraftMarker()}
      </svg>
    </div>
  `);
}

function findCollarAtPointer(clientX, clientY, surface) {
  const rect = surface.getBoundingClientRect();
  const scaleX = MAP_WIDTH / rect.width;
  const scaleY = MAP_HEIGHT / rect.height;
  const pointerX = (clientX - rect.left) * scaleX;
  const pointerY = (clientY - rect.top) * scaleY;

  return offlineMapState.collars.find((collar) => {
    const point = projectToScreen(collar);
    if (!point) {
      return false;
    }

    const distance = Math.hypot(point.x - pointerX, point.y - pointerY);
    return distance <= 14;
  }) || null;
}

function updatePointerLabel(event) {
  const surface = event.target.closest("[data-offline-map-surface]");
  if (!surface) {
    return;
  }

  const coordinates = screenToMap(event.clientX, event.clientY, surface);
  if (!coordinates) {
    return;
  }

  offlineMapState.pointerLabel = `Lat: ${coordinates.latitude} | Lon: ${coordinates.longitude}`;
  const pointerNode = qs(".offline-map-banner .list-item__meta", offlineMapState.container);
  if (pointerNode) {
    const spans = pointerNode.querySelectorAll("span");
    if (spans[1]) {
      spans[1].textContent = offlineMapState.pointerLabel;
    }
  }
}

function centerExtentOn(point) {
  const coordinates = getPointCoordinates(point);
  if (!coordinates || !offlineMapState.extent) {
    return;
  }

  const width = offlineMapState.extent.xmax - offlineMapState.extent.xmin;
  const height = offlineMapState.extent.ymax - offlineMapState.extent.ymin;
  offlineMapState.extent = normalizeExtent({
    xmin: coordinates.longitude - width / 2,
    ymin: coordinates.latitude - height / 2,
    xmax: coordinates.longitude + width / 2,
    ymax: coordinates.latitude + height / 2,
  });
}

function zoomExtent(factor) {
  if (!offlineMapState.extent) {
    return;
  }

  const centerX = (offlineMapState.extent.xmin + offlineMapState.extent.xmax) / 2;
  const centerY = (offlineMapState.extent.ymin + offlineMapState.extent.ymax) / 2;
  const width = Math.max((offlineMapState.extent.xmax - offlineMapState.extent.xmin) * factor, MIN_SPAN);
  const height = Math.max((offlineMapState.extent.ymax - offlineMapState.extent.ymin) * factor, MIN_SPAN);
  offlineMapState.extent = normalizeExtent({
    xmin: centerX - width / 2,
    ymin: centerY - height / 2,
    xmax: centerX + width / 2,
    ymax: centerY + height / 2,
  });
}

function panExtent(direction) {
  if (!offlineMapState.extent) {
    return;
  }

  const width = offlineMapState.extent.xmax - offlineMapState.extent.xmin;
  const height = offlineMapState.extent.ymax - offlineMapState.extent.ymin;
  const shiftX = width * 0.2;
  const shiftY = height * 0.2;

  const offsets = {
    left: { x: -shiftX, y: 0 },
    right: { x: shiftX, y: 0 },
    up: { x: 0, y: shiftY },
    down: { x: 0, y: -shiftY },
  };

  const offset = offsets[direction];
  if (!offset) {
    return;
  }

  offlineMapState.extent = normalizeExtent({
    xmin: offlineMapState.extent.xmin + offset.x,
    ymin: offlineMapState.extent.ymin + offset.y,
    xmax: offlineMapState.extent.xmax + offset.x,
    ymax: offlineMapState.extent.ymax + offset.y,
  });
}

function handleMapAction(action) {
  switch (action) {
    case "zoom-in":
      offlineMapState.userAdjustedExtent = true;
      zoomExtent(0.6);
      break;
    case "zoom-out":
      offlineMapState.userAdjustedExtent = true;
      zoomExtent(1.6);
      break;
    case "pan-left":
      offlineMapState.userAdjustedExtent = true;
      panExtent("left");
      break;
    case "pan-right":
      offlineMapState.userAdjustedExtent = true;
      panExtent("right");
      break;
    case "pan-up":
      offlineMapState.userAdjustedExtent = true;
      panExtent("up");
      break;
    case "pan-down":
      offlineMapState.userAdjustedExtent = true;
      panExtent("down");
      break;
    case "center-current":
      offlineMapState.userAdjustedExtent = true;
      centerExtentOn(offlineMapState.currentLocation);
      break;
    case "reset":
      offlineMapState.userAdjustedExtent = false;
      maybeFitExtent(true);
      break;
    default:
      return;
  }

  renderOfflineMap();
}

function handleContainerClick(event) {
  const actionButton = event.target.closest("[data-offline-map-action]");
  if (actionButton) {
    event.preventDefault();
    handleMapAction(actionButton.dataset.offlineMapAction || "");
    return;
  }

  const surface = event.target.closest("[data-offline-map-surface]");
  if (!surface) {
    return;
  }

  const selectedCollar = findCollarAtPointer(event.clientX, event.clientY, surface);
  if (selectedCollar && !offlineMapState.captureEnabled) {
    offlineMapState.selectedCollarUuid = selectedCollar.uuid || "";
    renderOfflineMap();
    offlineMapState.onSelectCollar?.(selectedCollar);
    return;
  }

  if (!offlineMapState.captureEnabled || typeof offlineMapState.onCapture !== "function") {
    offlineMapState.selectedCollarUuid = "";
    renderOfflineMap();
    offlineMapState.onSelectCollar?.(null);
    return;
  }

  const coordinates = screenToMap(event.clientX, event.clientY, surface);
  if (!coordinates) {
    return;
  }

  const point = buildPointFromCoordinates(coordinates);
  offlineMapState.selectedCollarUuid = "";
  offlineMapState.draftPoint = point;
  renderOfflineMap();
  offlineMapState.onSelectCollar?.(null);
  offlineMapState.onCapture(point);
}

function handleContainerWheel(event) {
  const surface = event.target.closest("[data-offline-map-surface]");
  if (!surface) {
    return;
  }

  event.preventDefault();
  offlineMapState.userAdjustedExtent = true;
  zoomExtent(event.deltaY < 0 ? 0.8 : 1.25);
  renderOfflineMap();
}

function bindContainerEvents() {
  if (!offlineMapState.container || offlineMapState.listenersBound) {
    return;
  }

  offlineMapState.container.addEventListener("click", handleContainerClick);
  offlineMapState.container.addEventListener("mousemove", updatePointerLabel);
  offlineMapState.container.addEventListener("wheel", handleContainerWheel, { passive: false });
  offlineMapState.listenersBound = true;
}

export async function initOfflineMap(container, { onCapture, onSelectCollar } = {}) {
  if (!container) {
    throw new Error("No existe contenedor disponible para renderizar el mapa offline.");
  }

  if (offlineMapState.container !== container) {
    offlineMapState.listenersBound = false;
    offlineMapState.container = container;
  }

  offlineMapState.onCapture = onCapture || null;
  offlineMapState.onSelectCollar = onSelectCollar || null;
  if (!offlineMapState.extent) {
    maybeFitExtent(true);
  }

  bindContainerEvents();
  renderOfflineMap();
  return container;
}

export function renderOfflineCollars(collars, options = {}) {
  offlineMapState.collars = Array.isArray(collars) ? collars : [];
  offlineMapState.showLabels = options.showLabels !== false;
  offlineMapState.selectedCollarUuid = options.selectedUuid || "";
  maybeFitExtent();
  renderOfflineMap();
}

export function setOfflineDraftPoint(point) {
  offlineMapState.draftPoint = point || null;
  renderOfflineMap();
}

export function setOfflineCurrentLocationPoint(point) {
  offlineMapState.currentLocation = point || null;
  if (!offlineMapState.userAdjustedExtent && !offlineMapState.collars.length && !offlineMapState.draftPoint) {
    maybeFitExtent(true);
  }
  renderOfflineMap();
}

export function setOfflineCaptureEnabled(enabled) {
  offlineMapState.captureEnabled = Boolean(enabled);
  renderOfflineMap();
}

export async function focusOfflineCollar(collar) {
  if (!collar) {
    return;
  }

  offlineMapState.selectedCollarUuid = collar.uuid || "";
  offlineMapState.userAdjustedExtent = true;
  centerExtentOn(collar);
  zoomExtent(0.35);
  renderOfflineMap();
}

export function resetOfflineMapView() {
  offlineMapState.userAdjustedExtent = false;
  maybeFitExtent(true);
  renderOfflineMap();
}

export function adjustOfflineMapZoom(direction) {
  offlineMapState.userAdjustedExtent = true;
  zoomExtent(direction > 0 ? 0.8 : 1.25);
  renderOfflineMap();
}

export function resetOfflineMapNorth() {
  renderOfflineMap();
}