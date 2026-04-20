import { escapeHtml } from "../core/helpers.js";
import { renderCollarForm } from "../components/collarForm.js";
import { renderMapToolbar } from "../components/mapToolbar.js";
import { renderSyncBadge } from "../ui/statusBadge.js";
import { renderIcon } from "../ui/icons.js";

function formatMeters(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)} m` : "-";
}

function formatCoordinate(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(6) : "-";
}

function getCaptureSourceLabel(draftCollar) {
  if (!draftCollar) {
    return "Sin captura";
  }

  if (draftCollar.capture_source === "gps") {
    return "Por GPS";
  }

  if (draftCollar.capture_source === "manual") {
    return "Manual";
  }

  return "Por mapa";
}

function getElevationStatusLabel(draftCollar) {
  if (!draftCollar) {
    return "Sin elevacion";
  }

  return draftCollar.elevation_status === "resolved" || draftCollar.elevacion != null
    ? "Elevacion resuelta"
    : "Elevacion pendiente";
}

function getElevationSourceLabel(draftCollar) {
  if (!draftCollar) {
    return "-";
  }

  if (draftCollar.elevation_status !== "resolved" && draftCollar.elevacion == null) {
    return draftCollar.elevation_source === "project-dem" ? "DEM del proyecto" : "DEM global";
  }

  if (draftCollar.elevation_source === "project-dem") {
    return "DEM del proyecto";
  }

  if (draftCollar.elevation_source === "global-dem") {
    return "DEM global";
  }

  if (draftCollar.elevation_source === "gps-device") {
    return "GPS";
  }

  return "-";
}

export function renderDraftCollarSummary({ draftCollar, captureMode, dismissed = false }) {
  if (!draftCollar && dismissed) {
    return "";
  }

  if (!draftCollar) {
    return `
      <div class="map-hint-card stack">
        <div class="map-info-card__head">
          <p class="eyebrow">Captura por mapa</p>
          <span class="chip chip--soft">Guia</span>
        </div>
        <strong>Listo para crear un collar</strong>
        <p class="muted">${captureMode === "gps"
          ? "Puedes volver a modo mapa cuando quieras capturar manualmente sobre la vista."
          : "Activa captura y toca el mapa para crear tu primer punto."}</p>
        <div class="inline-row inline-row--end">
          <button class="button button--compact" type="button" data-action="dismiss-draft-hint">Aceptar</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="map-info-card__head">
      <p class="eyebrow">Borrador actual</p>
      <span class="chip chip--soft">${escapeHtml(getCaptureSourceLabel(draftCollar))}</span>
    </div>
    <strong>${draftCollar ? escapeHtml(draftCollar.hole_id || "Nuevo collar") : "Sin punto seleccionado"}</strong>
    <p class="muted">${draftCollar
      ? `${formatCoordinate(draftCollar.latitude)}, ${formatCoordinate(draftCollar.longitude)}`
      : (captureMode === "gps" ? "Activa GPS para fijar el punto del dispositivo." : "Activa captura y toca el mapa para crear el collar.")}</p>
    <div class="list-item__meta">
      <span>${escapeHtml(getElevationStatusLabel(draftCollar))}</span>
      ${draftCollar ? `<span>Z: ${escapeHtml(formatMeters(draftCollar.elevacion))}</span>` : ""}
      ${draftCollar ? `<span>Fuente z: ${escapeHtml(getElevationSourceLabel(draftCollar))}</span>` : ""}
    </div>
    <div class="inline-row ${draftCollar ? "" : "hidden"}">
      <a class="button button--compact" href="#/collars">Abrir formulario</a>
      <button class="ghost-button ghost-button--compact" type="button" data-action="clear-draft-collar">Limpiar</button>
    </div>
  `;
}

export function renderCurrentLocationSummary({ captureMode, gpsCapture, currentLocation, hasActiveProject = false }) {
  const canFixPoint = captureMode === "gps"
    && Boolean(currentLocation)
    && hasActiveProject
    && gpsCapture?.navigationMode !== "fixed";

  return `
    <div class="map-info-card__head">
      <p class="eyebrow">GPS</p>
      <span class="chip chip--soft">${captureMode === "gps" ? "Modo GPS" : "Referencia"}</span>
    </div>
    <strong>${currentLocation ? `${formatCoordinate(currentLocation.latitude)}, ${formatCoordinate(currentLocation.longitude)}` : "Sin fijacion reciente"}</strong>
    <p class="muted">${currentLocation
      ? `Precision actual ${formatMeters(currentLocation.gps_accuracy_meters)}`
      : (captureMode === "gps" ? "Esperando lectura GPS." : "Activa el GPS para obtener una referencia.")}</p>
    <div class="list-item__meta">
      ${gpsCapture?.navigationMode === "free" && captureMode === "gps" ? "<span>Navegacion libre</span>" : ""}
      ${gpsCapture?.navigationMode === "fixed" ? "<span>Punto fijado</span>" : ""}
      ${gpsCapture?.bestAccuracy ? `<span>Mejor lectura ${escapeHtml(formatMeters(gpsCapture.bestAccuracy))}</span>` : ""}
    </div>
    ${captureMode === "gps" ? `
      <div class="map-gps-actions">
        <button class="button button--compact" type="button" data-action="gps-fix-point" ${canFixPoint ? "" : "disabled"}>Fijar punto</button>
      </div>
    ` : ""}
  `;
}

export function renderMapStatusLabel({ captureMode, captureEnabled, gpsCapture, mapAvailable = true, mapEngine = "arcgis", online = true }) {
  if (captureMode === "gps") {
    return gpsCapture?.navigationMode === "fixed" ? "Punto GPS fijado" : "GPS en navegacion";
  }

  if (!mapAvailable) {
    return "Mapa no disponible";
  }

  if (mapEngine === "offline") {
    return captureEnabled ? "Captura offline activa" : "Mapa offline listo";
  }

  if (!online) {
    return captureEnabled ? "Mapa cacheado activo" : "Mapa cacheado listo";
  }

  return captureEnabled ? "Captura por mapa activa" : "Captura por mapa inactiva";
}

export function renderMapSearchBar({ mapEngine = "arcgis" }) {
  if (mapEngine === "offline") {
    return `
      <div class="map-searchbar is-disabled" aria-hidden="true">
        <span class="map-searchbar__icon">${renderIcon("search")}</span>
        <span class="map-searchbar__placeholder">Buscar direccion o lugar</span>
      </div>
    `;
  }

  return `
    <div class="map-searchbar">
      <span class="map-searchbar__icon">${renderIcon("search")}</span>
      <div id="map-search-slot" class="map-search-slot" aria-label="Buscar direccion o lugar"></div>
    </div>
  `;
}

export function renderMapProjectBanner({ activeProject, activeProjectCollars, mapEngine = "arcgis", online = true, mapFallbackMessage = "" }) {
  const engineLabel = mapEngine === "offline" ? "Mapa local" : (online ? "ArcGIS" : "ArcGIS cacheado");
  return `
    <div class="map-project-banner">
      <p class="eyebrow">${escapeHtml(engineLabel)}</p>
      <strong>${escapeHtml(activeProject?.cod_exploracion || "Modo consulta")}</strong>
      <p class="muted">${escapeHtml(activeProject?.concesion_area || "Selecciona un proyecto para comenzar la captura operativa.")}</p>
      <div class="list-item__meta">
        <span>Collars visibles ${escapeHtml(String(activeProjectCollars.length))}</span>
        <span>SR ${escapeHtml(activeProject?.sr_proyecto || "-")}</span>
      </div>
      ${mapFallbackMessage ? `<p class="muted">${escapeHtml(mapFallbackMessage)}</p>` : ""}
    </div>
  `;
}

function renderLayerToggle(key, label, description, checked) {
  return `
    <button class="layer-toggle ${checked ? "is-active" : ""}" type="button" data-action="toggle-map-overlay" data-overlay="${key}" aria-pressed="${checked ? "true" : "false"}">
      <span>
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(description)}</small>
      </span>
      <span class="layer-toggle__switch"><span></span></span>
    </button>
  `;
}

export function renderMapLayersPanel({ layersPanelOpen = false, mapOverlays }) {
  if (!layersPanelOpen) {
    return "";
  }

  return `
    <aside class="map-side-sheet map-side-sheet--layers" aria-label="Capas y overlays">
      <div class="map-side-sheet__header">
        <div>
          <p class="eyebrow">Capas</p>
          <h3 class="title-md">Overlays del mapa</h3>
        </div>
        <button class="icon-button icon-button--ghost" type="button" data-action="toggle-layers-panel" aria-label="Cerrar panel de capas">
          ${renderIcon("close")}
        </button>
      </div>
      <div class="map-side-sheet__body stack">
        ${renderLayerToggle("collars", "Collars registrados", "Muestra u oculta los collars del proyecto activo.", Boolean(mapOverlays?.collars))}
        ${renderLayerToggle("labels", "Etiquetas", "Activa los nombres HOLE_ID sobre el mapa.", Boolean(mapOverlays?.labels))}
        ${renderLayerToggle("cadastralGrid", "Cuadricula catastral", "Superpone una reticula visual de trabajo.", Boolean(mapOverlays?.cadastralGrid))}
        ${renderLayerToggle("basemap", "Basemap", "Permite atenuar o resaltar el fondo base.", Boolean(mapOverlays?.basemap))}
        <button class="button button--block" type="button" data-action="open-import-modal">
          ${renderIcon("upload")}
          <span>Importar datos</span>
        </button>
      </div>
    </aside>
  `;
}

export function renderImportDataModal({ importModalOpen = false }) {
  if (!importModalOpen) {
    return "";
  }

  return `
    <div class="map-modal" role="dialog" aria-modal="true" aria-label="Importar datos geoespaciales">
      <button class="map-modal__backdrop" type="button" data-action="close-import-modal" aria-label="Cerrar modal"></button>
      <div class="map-modal__sheet card stack">
        <div class="section-head">
          <div>
            <p class="eyebrow">Importar datos</p>
            <h3 class="title-md">Capas externas</h3>
          </div>
          <button class="icon-button icon-button--ghost" type="button" data-action="close-import-modal" aria-label="Cerrar modal de importacion">
            ${renderIcon("close")}
          </button>
        </div>
        <div class="file-dropzone stack">
          <span class="file-dropzone__icon">${renderIcon("upload")}</span>
          <strong>Arrastra archivos .GPX, .KML, .GeoJSON o selecciona</strong>
          <p class="muted">Este modal deja lista la interfaz para futuras capas externas sin interferir con la captura actual.</p>
          <input id="map-import-file-input" class="hidden" type="file" accept=".gpx,.kml,.geojson,.json" multiple>
          <div class="inline-row inline-row--end">
            <button class="ghost-button" type="button" data-action="close-import-modal">Cancelar</button>
            <button class="button" type="button" data-action="select-import-files">Seleccionar archivos</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderSelectedCollarPanel({ selectedMapCollar }) {
  if (!selectedMapCollar) {
    return "";
  }

  return `
    <aside class="map-side-sheet map-side-sheet--detail" aria-label="Detalle de collar registrado">
      <div class="map-side-sheet__header">
        <div>
          <p class="eyebrow">Collar registrado</p>
          <h3 class="title-md">${escapeHtml(selectedMapCollar.hole_id || "Collar")}</h3>
        </div>
        <button class="icon-button icon-button--ghost" type="button" data-action="clear-selected-map-collar" aria-label="Cerrar detalle de collar">
          ${renderIcon("close")}
        </button>
      </div>
      <div class="map-side-sheet__body stack">
        <div class="inline-row inline-row--between">
          ${renderSyncBadge(selectedMapCollar.estado_sync)}
          <span class="chip chip--soft">${escapeHtml(selectedMapCollar.tipo || "-")}</span>
        </div>
        <div class="list-item__meta list-item__meta--stack">
          <span>Latitud ${escapeHtml(formatCoordinate(selectedMapCollar.latitude))}</span>
          <span>Longitud ${escapeHtml(formatCoordinate(selectedMapCollar.longitude))}</span>
          <span>Elevacion ${escapeHtml(formatMeters(selectedMapCollar.elevacion))}</span>
          <span>Fecha ${escapeHtml(selectedMapCollar.fecha || "-")}</span>
        </div>
        <div class="inline-row inline-row--wrap">
          <button class="ghost-button" type="button" data-action="edit-collar" data-uuid="${escapeHtml(selectedMapCollar.uuid)}">${renderIcon("edit")}<span>Editar</span></button>
          <button class="ghost-button" type="button" data-action="focus-collar" data-uuid="${escapeHtml(selectedMapCollar.uuid)}">${renderIcon("focus")}<span>Enfocar mapa</span></button>
          <button class="ghost-button ghost-button--danger" type="button" data-action="remove-collar" data-uuid="${escapeHtml(selectedMapCollar.uuid)}">${renderIcon("trash")}<span>Eliminar</span></button>
        </div>
      </div>
    </aside>
  `;
}

export function renderMapCaptureSheet({ activeProject, draftCollar, captureMode }) {
  if (!draftCollar) {
    return "";
  }

  return `
    <aside class="map-capture-sheet" aria-label="Nuevo collar">
      ${renderCollarForm({
        activeProject,
        draftCollar,
        editingCollar: null,
        captureMode,
        variant: "map-sheet",
      })}
    </aside>
  `;
}

export function renderMapaPage({
  activeProject,
  draftCollar,
  captureEnabled,
  activeProjectCollars,
  captureMode,
  gpsCapture,
  currentLocation,
  mapReady = true,
  online = true,
  mapEngine = "arcgis",
  mapFallbackMessage = "",
  selectedMapCollar = null,
  layersPanelOpen = false,
  importModalOpen = false,
  mapDraftHintDismissed = false,
  mapOverlays = { collars: true, labels: true, cadastralGrid: false, basemap: true },
}) {
  return `
    <section class="map-workspace">
      <article class="map-frame map-frame--workspace">
        <div id="map-project-banner" class="map-floating-top map-floating-top--left">
          ${renderMapProjectBanner({ activeProject, activeProjectCollars, mapEngine, online, mapFallbackMessage })}
        </div>

        <div id="map-search-root" class="map-floating-top map-floating-top--center">
          ${renderMapSearchBar({ mapEngine })}
        </div>

        <div id="map-toolbar-root" class="map-floating-tools">
          ${renderMapToolbar({
            captureEnabled,
            hasActiveProject: Boolean(activeProject),
            captureMode,
            gpsCapture,
            hasCurrentLocation: Boolean(currentLocation),
            mapAvailable: mapReady,
            online,
            mapEngine,
            layersPanelOpen,
          })}
        </div>

        <div id="map-view-shell" class="map-view-shell ${mapOverlays?.basemap ? "" : "is-basemap-muted"}">
          <div id="map-cadastral-grid" class="map-cadastral-grid ${mapOverlays?.cadastralGrid ? "is-active" : ""}"></div>
          <div id="map-view" class="map-view" aria-label="Mapa de captura"></div>
        </div>

        <div class="map-floating-bottom map-floating-bottom--left">
          <div id="map-draft-summary" class="map-info-card panel-tile stack ${!draftCollar && mapDraftHintDismissed ? "hidden" : ""}">
            ${renderDraftCollarSummary({ draftCollar, captureMode, dismissed: mapDraftHintDismissed })}
          </div>
          <div id="map-current-location-summary" class="map-info-card map-info-card--gps panel-tile stack ${captureMode === "gps" ? "is-gps-active" : ""}">
            ${renderCurrentLocationSummary({ captureMode, gpsCapture, currentLocation, hasActiveProject: Boolean(activeProject) })}
          </div>
        </div>

        <div class="map-floating-bottom map-floating-bottom--right">
          <div id="map-status-chip" class="map-status chip chip--map-status">${renderMapStatusLabel({ captureMode, captureEnabled, gpsCapture, mapAvailable: mapReady, mapEngine, online })}</div>
        </div>

        <button class="map-fab" type="button" data-action="activate-map-capture" ${activeProject && mapReady ? "" : "disabled"} aria-label="Activar captura sobre el mapa">
          ${renderIcon("collar")}
        </button>

        <div id="map-selected-collar-root" class="map-side-panel-host map-side-panel-host--detail">
          ${renderSelectedCollarPanel({ selectedMapCollar })}
        </div>
        <div id="map-layers-panel-root" class="map-side-panel-host map-side-panel-host--layers">
          ${renderMapLayersPanel({ layersPanelOpen, mapOverlays })}
        </div>
        <div id="map-capture-sheet-root" class="map-sheet-host">
          ${renderMapCaptureSheet({ activeProject, draftCollar, captureMode })}
        </div>
        <div id="map-import-modal-root">${renderImportDataModal({ importModalOpen })}</div>
      </article>
    </section>
  `;
}