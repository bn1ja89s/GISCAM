import { appConfig } from "./config.js";
import { qs, formToObject, setHTML } from "./core/dom.js";
import { clone, enrichPointForProject, formatDateTime, toNullableNumber } from "./core/helpers.js";
import { createStore } from "./core/state.js";
import { getOnlineStatus, watchNetworkStatus } from "./core/network.js";
import { initDB } from "./db/indexeddb.js";
import { listAssays } from "./db/assayRepository.js";
import { getCollarByUuid, listCollars } from "./db/collarRepository.js";
import { listLaboratorios } from "./db/laboratorioRepository.js";
import { getProjectByUuid, listProjects } from "./db/proyectoRepository.js";
import { listSurveys } from "./db/surveyRepository.js";
import { listSyncQueue } from "./db/syncRepository.js";
import { createProject, deleteOrDeactivateProject, resolveActiveProjectUuid, selectActiveProject, updateProject } from "./services/proyectoService.js";
import { createCollar, deleteCollar, updateCollar } from "./services/collarService.js";
import { adjustMapZoom, focusCollar, getCaptureEnabled, initMap, renderCollars, resetMapNorth, resolvePointElevation, setCaptureEnabled, setCurrentLocationPoint, setDraftPoint, startGpsNavigation, stopGpsNavigation } from "./services/mapService.js";
import { exportBackup, importBackup } from "./services/backupService.js";
import { resolveDraftCollarElevation, resolvePendingCollarElevations } from "./services/elevationService.js";
import { adjustOfflineMapZoom, focusOfflineCollar, initOfflineMap, renderOfflineCollars, resetOfflineMapNorth, setOfflineCaptureEnabled, setOfflineCurrentLocationPoint, setOfflineDraftPoint } from "./services/offlineMapService.js";
import { bootstrapArcGISData, syncAll } from "./services/syncService.js";
import { initRouter, navigate } from "./router.js";
import { renderDashboardPage } from "./pages/dashboardPage.js";
import { renderProyectoPage } from "./pages/proyectoPage.js";
import { renderCollarPage } from "./pages/collarPage.js";
import { renderSurveyPage } from "./pages/surveyPage.js";
import { renderAssayPage } from "./pages/assayPage.js";
import { renderLaboratorioPage } from "./pages/laboratorioPage.js";
import { renderCurrentLocationSummary, renderDraftCollarSummary, renderImportDataModal, renderMapCaptureSheet, renderMapaPage, renderMapLayersPanel, renderMapProjectBanner, renderMapSearchBar, renderMapStatusLabel, renderSelectedCollarPanel } from "./pages/mapaPage.js";
import { renderSyncPage } from "./pages/syncPage.js";
import { renderMapToolbar } from "./components/mapToolbar.js";
import { renderMobileDrawer, renderMobileNav, renderSidebar } from "./components/sidebar.js";
import { renderTopbar } from "./components/topbar.js";
import { showNotification } from "./ui/notifications.js";
import { getStoredArcGISMapCache, getStoredCaptureMode, getStoredDraftCollar, getStoredDraftHintDismissed, setStoredArcGISMapCache, setStoredCaptureMode, setStoredDraftCollar, setStoredDraftHintDismissed } from "./services/storageService.js";
import { createSurvey, deleteSurvey, updateSurvey } from "./services/surveyService.js";
import { createAssay, deleteAssay, updateAssay } from "./services/assayService.js";
import { importAssaysFromCsv, importSurveysFromCsv } from "./services/csvImportService.js";
import { createLaboratorio, deleteLaboratorio, updateLaboratorio } from "./services/laboratorioService.js";

function createGpsCaptureState(overrides = {}) {
  return {
    navigationMode: "free",
    inProgress: false,
    targetSamples: appConfig.map.gpsSampleCount,
    meanAccuracy: null,
    bestAccuracy: null,
    samplesCollected: 0,
    message: "GPS listo para navegacion libre.",
    ...overrides,
  };
}

function createDefaultMapOverlays() {
  return {
    collars: true,
    labels: true,
    cadastralGrid: false,
    basemap: true,
  };
}

const store = createStore({
  route: "dashboard",
  online: getOnlineStatus(),
  projects: [],
  collars: [],
  surveys: [],
  assays: [],
  laboratorios: [],
  syncQueue: [],
  activeProjectUuid: "",
  draftCollar: null,
  currentLocation: null,
  captureMode: getStoredCaptureMode(),
  gpsCapture: createGpsCaptureState(),
  editingProjectUuid: "",
  editingCollarUuid: "",
  editingSurveyUuid: "",
  editingAssayUuid: "",
  editingLaboratorioUuid: "",
  pendingFocusCollarUuid: "",
  sidebarOpen: false,
  mobileDrawerOpen: false,
  isSyncing: false,
  syncMessage: "",
  deferredPrompt: null,
  mapReady: true,
  mapEngine: "arcgis",
  mapFallbackMessage: "",
  mapDraftHintDismissed: getStoredDraftHintDismissed(),
  layersPanelOpen: false,
  importModalOpen: false,
  selectedMapCollarUuid: "",
  mapOverlays: createDefaultMapOverlays(),
});

function getDerivedState() {
  const state = store.getState();
  const activeProject = state.projects.find((project) => project.uuid === state.activeProjectUuid) || null;
  const activeProjectCollars = activeProject
    ? state.collars.filter((collar) => collar.proyecto_uuid === activeProject.uuid)
    : [];
  const activeProjectCollarIds = new Set(activeProjectCollars.map((collar) => collar.uuid));
  const activeProjectSurveys = state.surveys.filter((survey) => activeProjectCollarIds.has(survey.collar_uuid));
  const activeProjectAssays = state.assays.filter((assay) => activeProjectCollarIds.has(assay.collar_uuid));
  const activeProjectAssayIds = new Set(activeProjectAssays.map((assay) => assay.uuid));
  const activeProjectLaboratorios = state.laboratorios.filter((laboratorio) => activeProjectAssayIds.has(laboratorio.assay_uuid));
  const pendingQueue = state.syncQueue.filter((item) => item.status !== appConfig.status.synced);
  const editingProject = state.projects.find((project) => project.uuid === state.editingProjectUuid) || null;
  const editingCollar = state.collars.find((collar) => collar.uuid === state.editingCollarUuid) || null;
  const editingSurvey = state.surveys.find((survey) => survey.uuid === state.editingSurveyUuid) || null;
  const editingAssay = state.assays.find((assay) => assay.uuid === state.editingAssayUuid) || null;
  const editingLaboratorio = state.laboratorios.find((laboratorio) => laboratorio.uuid === state.editingLaboratorioUuid) || null;
  const selectedMapCollar = state.collars.find((collar) => collar.uuid === state.selectedMapCollarUuid) || null;

  return {
    ...state,
    activeProject,
    activeProjectCollars,
    activeProjectSurveys,
    activeProjectAssays,
    activeProjectLaboratorios,
    pendingQueue,
    editingProject,
    editingCollar,
    editingSurvey,
    editingAssay,
    editingLaboratorio,
    selectedMapCollar,
  };
}

function renderShell() {
  const app = qs("#app");
  if (!app) {
    return;
  }

  setHTML(
    app,
    `
      <aside id="sidebar" class="sidebar"></aside>
      <div class="app-content">
        <header id="topbar" class="topbar"></header>
        <main id="page-root" class="main-content"></main>
      </div>
      <div id="mobile-nav-root" class="mobile-nav-root"></div>
      <button id="mobile-drawer-backdrop" class="mobile-drawer-backdrop" type="button" data-action="close-mobile-drawer" aria-label="Cerrar menu movil"></button>
      <div id="mobile-drawer-root" class="mobile-drawer-root"></div>
    `,
  );
}

function refreshChrome() {
  const state = getDerivedState();
  const sidebar = qs("#sidebar");
  const topbar = qs("#topbar");
  const mobileNavRoot = qs("#mobile-nav-root");
  const mobileDrawerRoot = qs("#mobile-drawer-root");
  const mobileDrawerBackdrop = qs("#mobile-drawer-backdrop");

  if (sidebar) {
    setHTML(sidebar, renderSidebar(state));
  }

  if (topbar) {
    setHTML(
      topbar,
      renderTopbar({
        appName: appConfig.appName,
        online: state.online,
        activeProject: state.activeProject,
        pendingCount: state.pendingQueue.length,
        canInstall: Boolean(state.deferredPrompt),
        isSyncing: state.isSyncing,
      }),
    );
  }

  if (mobileNavRoot) {
    setHTML(mobileNavRoot, renderMobileNav(state));
  }

  if (mobileDrawerRoot) {
    mobileDrawerRoot.classList.toggle("is-open", state.mobileDrawerOpen);
    setHTML(mobileDrawerRoot, renderMobileDrawer(state));
  }

  if (mobileDrawerBackdrop) {
    mobileDrawerBackdrop.classList.toggle("is-open", state.mobileDrawerOpen);
  }
}

function renderCurrentPage() {
  const state = getDerivedState();
  const pageRoot = qs("#page-root");
  if (!pageRoot) {
    return;
  }

  const pageContext = clone({
    ...state,
    appName: appConfig.appName,
  });

  const pageTemplates = {
    dashboard: renderDashboardPage(pageContext),
    proyectos: renderProyectoPage(pageContext),
    collars: renderCollarPage(pageContext),
    survey: renderSurveyPage(pageContext),
    assay: renderAssayPage(pageContext),
    laboratorio: renderLaboratorioPage(pageContext),
    mapa: renderMapaPage({
      ...pageContext,
      captureEnabled: getCaptureEnabled(),
    }),
    sync: renderSyncPage(pageContext),
  };

  pageRoot.classList.toggle("main-content--map", state.route === "mapa");
  setHTML(pageRoot, pageTemplates[state.route] || pageTemplates.dashboard);

  if (state.route === "mapa") {
    mountMapPage();
  }
}

async function loadAppData() {
  const [projects, collars, surveys, assays, laboratorios, syncQueue] = await Promise.all([
    listProjects(),
    listCollars(),
    listSurveys(),
    listAssays(),
    listLaboratorios(),
    listSyncQueue(),
  ]);
  const activeProjectUuid = await resolveActiveProjectUuid();
  store.setState({
    projects,
    collars,
    surveys,
    assays,
    laboratorios,
    syncQueue,
    activeProjectUuid,
  });
}

async function rerenderAll() {
  await loadAppData();
  refreshChrome();
  renderCurrentPage();
}

function setSidebarOpen(isOpen) {
  store.setState({ sidebarOpen: isOpen, mobileDrawerOpen: isOpen });
  refreshChrome();
}

function buildHoleIdPrefix(project) {
  const source = String(project?.cod_exploracion || project?.concesion_area || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const parts = source.match(/[A-Z0-9]+/g) || [];

  if (!parts.length) {
    return "PR";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).padEnd(2, parts[0][0] || "P");
  }

  return `${parts[0][0] || "P"}${parts[1][0] || "R"}`;
}

function extractHoleIdSequence(holeId, prefix) {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(holeId || "").toUpperCase().match(new RegExp(`^${escapedPrefix}-(\\d+)$`));
  return match ? Number(match[1]) || 0 : 0;
}

function getNextDraftHoleId(state) {
  const prefix = buildHoleIdPrefix(state.activeProject);
  const previousDraft = state.draftCollar?.proyecto_uuid === state.activeProject?.uuid ? state.draftCollar : null;

  if (previousDraft?.hole_id?.trim()) {
    return previousDraft.hole_id.trim().toUpperCase();
  }

  const maxSequence = state.activeProjectCollars.reduce((currentMax, collar) => {
    return Math.max(currentMax, extractHoleIdSequence(collar.hole_id, prefix));
  }, 0);

  return `${prefix}-${String(maxSequence + 1).padStart(3, "0")}`;
}

function getElevationStateLabel(record) {
  if (!record) {
    return "sin dato";
  }

  return record.elevation_status === "resolved" || record.elevacion != null
    ? "resuelta"
    : "pendiente";
}

function buildSyncErrorPreview(syncQueue) {
  const errorItems = syncQueue.filter((item) => item.status === appConfig.status.error);
  if (!errorItems.length) {
    return "";
  }

  const item = errorItems[0];
  const identifier = item?.payload?.hole_id || item?.payload?.cod_exploracion || item?.entity_uuid || "sin identificador";
  const errorMessage = item?.last_error || "Sin detalle remoto.";
  return ` Primer error: ${item.entity_type} ${identifier}. ${errorMessage}`;
}

function buildMapFallbackMessage(error, online) {
  if (!online) {
    return "No fue posible reutilizar el mapa ArcGIS cacheado. Se activara el mapa offline local para seguir capturando puntos por mapa.";
  }

  if (/webgl/i.test(String(error?.message || ""))) {
    return "El dispositivo no pudo iniciar ArcGIS. Se activara el mapa offline local para seguir capturando puntos.";
  }

  return error?.message || "No fue posible cargar ArcGIS. Se activara el mapa offline local para seguir capturando puntos.";
}

function getArcGISCacheMeta() {
  const cacheMeta = getStoredArcGISMapCache();
  return cacheMeta?.warmedAt ? cacheMeta : null;
}

function hasArcGISCache() {
  return Boolean(getArcGISCacheMeta());
}

function rememberArcGISCache() {
  const currentMap = appConfig.maps[0] || {};
  setStoredArcGISMapCache({
    warmedAt: new Date().toISOString(),
    mapId: currentMap.id || "",
    mapTitle: currentMap.title || "",
  });
}

function buildArcGISCacheMessage() {
  const cacheMeta = getArcGISCacheMeta();
  if (!cacheMeta?.warmedAt) {
    return "Sin conexion. Se intentara reutilizar el ultimo mapa ArcGIS cacheado disponible.";
  }

  return `Sin conexion. Usando el ultimo mapa ArcGIS cacheado del ${formatDateTime(cacheMeta.warmedAt)}. Las zonas no visitadas pueden no estar disponibles.`;
}

function buildOfflineMapBootstrapMessage() {
  if (hasArcGISCache()) {
    return `${buildArcGISCacheMessage()} No fue posible reabrirlo y se activo el mapa offline local.`;
  }

  return "Sin conexion y aun no existe un mapa ArcGIS cacheado en este dispositivo. Abre el mapa una vez online para dejar una copia temporal y, mientras tanto, se activara el mapa offline local.";
}

function isOfflineMapActive(state = getDerivedState()) {
  return state.mapEngine === "offline";
}

function setMapCaptureEnabled(enabled) {
  setCaptureEnabled(enabled);
  setOfflineCaptureEnabled(enabled);
}

function getVisibleMapCollars(state = getDerivedState()) {
  return state.mapOverlays?.collars ? state.activeProjectCollars : [];
}

function renderActiveMapCollars(collars, options = {}) {
  const mapOptions = {
    showLabels: Boolean(options.showLabels),
    selectedUuid: options.selectedUuid || "",
  };

  if (isOfflineMapActive()) {
    renderOfflineCollars(collars, mapOptions);
    return;
  }

  renderCollars(collars, mapOptions);
}

function setActiveDraftPoint(point) {
  if (isOfflineMapActive()) {
    setOfflineDraftPoint(point);
    return;
  }

  setDraftPoint(point);
}

function setActiveCurrentLocationPoint(point) {
  if (isOfflineMapActive()) {
    setOfflineCurrentLocationPoint(point);
    return;
  }

  setCurrentLocationPoint(point);
}

async function focusActiveCollar(collar) {
  if (isOfflineMapActive()) {
    await focusOfflineCollar(collar);
    return;
  }

  await focusCollar(collar);
}

async function reconcileDraftElevationIfNeeded(online = store.getState().online) {
  const state = getDerivedState();
  const draftCollar = state.draftCollar;

  if (!draftCollar) {
    return false;
  }

  const draftProject = state.projects.find((project) => project.uuid === draftCollar.proyecto_uuid)
    || (state.activeProject?.uuid === draftCollar.proyecto_uuid ? state.activeProject : null);

  if (!draftProject) {
    return false;
  }

  const nextDraft = await resolveDraftCollarElevation(draftCollar, draftProject, { online });
  if (!nextDraft) {
    return false;
  }

  const changed = (
    nextDraft.elevacion !== draftCollar.elevacion ||
    nextDraft.elevation_status !== draftCollar.elevation_status ||
    nextDraft.elevation_source !== draftCollar.elevation_source ||
    nextDraft.geometry?.z !== draftCollar.geometry?.z
  );

  if (!changed) {
    return false;
  }

  setStoredDraftCollar(nextDraft);
  store.setState({ draftCollar: nextDraft });

  if (store.getState().route === "mapa") {
    setActiveDraftPoint(nextDraft);
    refreshMapDraftSummary();
  }

  return true;
}

async function persistDraftCollar(pointData, captureSource) {
  const state = getDerivedState();

  if (!state.activeProject) {
    showNotification("Debes seleccionar un proyecto activo antes de capturar un collar.", "error", 4200);
    return null;
  }

  const resolvedPoint = await resolvePointElevation(pointData, {
    project: state.activeProject,
    online: state.online,
    preferExistingElevation: false,
  });
  const pointWithElevation = resolvedPoint || pointData;
  const enrichedPoint = state.activeProject ? enrichPointForProject(pointWithElevation, state.activeProject.sr_proyecto) : pointWithElevation;
  const previousDraft = state.draftCollar?.proyecto_uuid === state.activeProject.uuid ? state.draftCollar : null;
  const draftCollar = {
    ...enrichedPoint,
    proyecto_uuid: state.activeProject.uuid,
    capture_source: captureSource,
    fecha: previousDraft?.fecha || new Date().toISOString().slice(0, 10),
    localizacion: previousDraft?.localizacion || "",
    hole_id: previousDraft?.hole_id || getNextDraftHoleId(state),
    tipo: previousDraft?.tipo || "RC",
    prof_total: previousDraft?.prof_total ?? 0,
    elevation_status: enrichedPoint?.elevation_status || (enrichedPoint?.elevacion != null ? "resolved" : "pending"),
    elevation_source: enrichedPoint?.elevation_source || "",
    elevation_resolved_at: enrichedPoint?.elevation_resolved_at || "",
  };

  setStoredDraftCollar(draftCollar);
  store.setState({ draftCollar });
  return draftCollar;
}

function refreshMapDraftSummary() {
  const state = getDerivedState();
  if (state.route !== "mapa") {
    return;
  }

  const draftSummary = qs("#map-draft-summary");
  if (!draftSummary) {
    return;
  }

  setHTML(
    draftSummary,
    renderDraftCollarSummary({
      draftCollar: state.draftCollar,
      captureMode: state.captureMode,
      dismissed: state.mapDraftHintDismissed,
    }),
  );

  draftSummary.classList.toggle("hidden", !state.draftCollar && state.mapDraftHintDismissed);

  refreshMapCaptureSheet();
}

function refreshMapToolbarSection() {
  const state = getDerivedState();
  if (state.route !== "mapa") {
    return;
  }

  const toolbarRoot = qs("#map-toolbar-root");
  if (!toolbarRoot) {
    return;
  }

  setHTML(toolbarRoot, renderMapToolbar({
    captureEnabled: getCaptureEnabled(),
    hasActiveProject: Boolean(state.activeProject),
    captureMode: state.captureMode,
    gpsCapture: state.gpsCapture,
    hasCurrentLocation: Boolean(state.currentLocation),
    mapAvailable: state.mapReady,
    layersPanelOpen: state.layersPanelOpen,
  }));
}

function refreshMapCurrentLocationSummary() {
  const state = getDerivedState();
  if (state.route !== "mapa") {
    return;
  }

  const currentLocationSummary = qs("#map-current-location-summary");
  if (!currentLocationSummary) {
    return;
  }

  currentLocationSummary.classList.toggle("is-gps-active", state.captureMode === "gps");

  setHTML(currentLocationSummary, renderCurrentLocationSummary({
    captureMode: state.captureMode,
    gpsCapture: state.gpsCapture,
    currentLocation: state.currentLocation,
    hasActiveProject: Boolean(state.activeProject),
  }));
}

function refreshMapStatusChip() {
  const state = getDerivedState();
  if (state.route !== "mapa") {
    return;
  }

  const statusChip = qs("#map-status-chip");
  if (!statusChip) {
    return;
  }

  setHTML(statusChip, renderMapStatusLabel({
    captureMode: state.captureMode,
    captureEnabled: getCaptureEnabled(),
    gpsCapture: state.gpsCapture,
    mapAvailable: state.mapReady,
    mapEngine: state.mapEngine,
    online: state.online,
  }));
}

function refreshMapProjectBanner() {
  const state = getDerivedState();
  if (state.route !== "mapa") {
    return;
  }

  const bannerRoot = qs("#map-project-banner");
  if (!bannerRoot) {
    return;
  }

  setHTML(bannerRoot, renderMapProjectBanner({
    activeProject: state.activeProject,
    activeProjectCollars: getVisibleMapCollars(state),
    mapEngine: state.mapEngine,
    online: state.online,
    mapFallbackMessage: state.mapFallbackMessage,
  }));
}

function refreshMapSearchBar(force = false) {
  const state = getDerivedState();
  if (state.route !== "mapa") {
    return;
  }

  const searchRoot = qs("#map-search-root");
  if (!searchRoot) {
    return;
  }

  if (!force && state.mapEngine === "arcgis") {
    return;
  }

  setHTML(searchRoot, renderMapSearchBar({ mapEngine: state.mapEngine }));
}

function refreshMapLayersPanel() {
  const state = getDerivedState();
  if (state.route !== "mapa") {
    return;
  }

  const layersRoot = qs("#map-layers-panel-root");
  if (!layersRoot) {
    return;
  }

  setHTML(layersRoot, renderMapLayersPanel({
    layersPanelOpen: state.layersPanelOpen,
    mapOverlays: state.mapOverlays,
  }));
}

function refreshMapImportModal() {
  const state = getDerivedState();
  if (state.route !== "mapa") {
    return;
  }

  const modalRoot = qs("#map-import-modal-root");
  if (!modalRoot) {
    return;
  }

  setHTML(modalRoot, renderImportDataModal({ importModalOpen: state.importModalOpen }));
}

function refreshMapCaptureSheet() {
  const state = getDerivedState();
  if (state.route !== "mapa") {
    return;
  }

  const sheetRoot = qs("#map-capture-sheet-root");
  if (!sheetRoot) {
    return;
  }

  setHTML(sheetRoot, renderMapCaptureSheet({
    activeProject: state.activeProject,
    draftCollar: state.draftCollar,
    captureMode: state.captureMode,
  }));
}

function refreshSelectedMapCollarPanel() {
  const state = getDerivedState();
  if (state.route !== "mapa") {
    return;
  }

  const panelRoot = qs("#map-selected-collar-root");
  if (!panelRoot) {
    return;
  }

  setHTML(panelRoot, renderSelectedCollarPanel({
    selectedMapCollar: state.selectedMapCollar,
  }));
}

function refreshMapOverlayVisuals() {
  const state = getDerivedState();
  if (state.route !== "mapa") {
    return;
  }

  const cadastralGrid = qs("#map-cadastral-grid");
  if (cadastralGrid) {
    cadastralGrid.classList.toggle("is-active", Boolean(state.mapOverlays?.cadastralGrid));
  }

  const mapViewShell = qs("#map-view-shell");
  if (mapViewShell) {
    mapViewShell.classList.toggle("is-basemap-muted", !state.mapOverlays?.basemap);
  }
}

function refreshMapPanels() {
  refreshMapProjectBanner();
  refreshMapLayersPanel();
  refreshMapImportModal();
  refreshSelectedMapCollarPanel();
  refreshMapCaptureSheet();
  refreshMapOverlayVisuals();
}

async function handleOfflinePointSubmit(form) {
  const data = formToObject(form);
  const latitude = toNullableNumber(data.latitude);
  const longitude = toNullableNumber(data.longitude);
  const elevacion = toNullableNumber(data.elevacion);

  if (latitude == null || latitude < -90 || latitude > 90) {
    throw new Error("La latitud manual debe estar entre -90 y 90.");
  }

  if (longitude == null || longitude < -180 || longitude > 180) {
    throw new Error("La longitud manual debe estar entre -180 y 180.");
  }

  const draftCollar = await persistDraftCollar({
    latitude,
    longitude,
    elevacion,
    spatialReference: { wkid: 4326 },
  }, "manual");

  if (!draftCollar) {
    return;
  }

  if (store.getState().mapReady) {
    setActiveDraftPoint(draftCollar);
  }

  refreshMapDraftSummary();
  showNotification(
    draftCollar.elevation_status === "pending"
      ? "Punto manual guardado. La elevacion queda pendiente hasta recuperar conexion."
      : "Punto manual guardado localmente como borrador.",
    "success",
    4200,
  );
}

function refreshMapGpsUi() {
  refreshMapToolbarSection();
  refreshMapCurrentLocationSummary();
  refreshMapStatusChip();
}

function handleGpsLocationUpdate(point) {
  const state = getDerivedState();
  if (state.captureMode !== "gps") {
    return;
  }

  store.setState({
    currentLocation: point,
    gpsCapture: {
      ...state.gpsCapture,
      navigationMode: "free",
      meanAccuracy: point.gps_accuracy_meters,
      bestAccuracy: point.gps_accuracy_meters,
      samplesCollected: 1,
      message: point.gps_accuracy_meters
        ? `GPS en navegacion libre. Precision actual: ${point.gps_accuracy_meters} m.`
        : "GPS en navegacion libre.",
    },
  });
  setActiveCurrentLocationPoint(point);
  refreshMapGpsUi();
}

function handleGpsNavigationError(error) {
  setActiveCurrentLocationPoint(null);
  store.setState({
    currentLocation: null,
    gpsCapture: createGpsCaptureState({
      navigationMode: "free",
      message: error.message || "No fue posible obtener la ubicacion GPS del dispositivo.",
    }),
  });
  refreshMapGpsUi();
  showNotification(error.message || "No fue posible obtener la ubicacion GPS del dispositivo.", "error", 5200);
}

async function activateGpsFreeNavigation() {
  await startGpsNavigation({
    onLocation: handleGpsLocationUpdate,
    onError: handleGpsNavigationError,
    centerOnFirstFix: true,
  });
}

function activateMapInteractionMode({ captureEnabled = false } = {}) {
  const state = getDerivedState();

  setStoredCaptureMode("map");
  stopGpsNavigation({ clearGraphic: true });
  setMapCaptureEnabled(captureEnabled);
  store.setState({
    captureMode: "map",
    gpsCapture: createGpsCaptureState({
      navigationMode: "free",
      meanAccuracy: state.currentLocation?.gps_accuracy_meters ?? null,
      bestAccuracy: state.currentLocation?.gps_accuracy_meters ?? null,
      samplesCollected: state.currentLocation ? 1 : 0,
      message: state.currentLocation
        ? "Seleccion en mapa lista. Ultima ubicacion GPS disponible para referencia."
        : "Seleccion en mapa lista para usarse.",
    }),
  });
}

function refreshMapInteractionUi() {
  if (store.getState().route === "mapa") {
    refreshMapToolbarSection();
    refreshMapDraftSummary();
    refreshMapCurrentLocationSummary();
    refreshMapStatusChip();
    return;
  }

  renderCurrentPage();
}

function handleMapCollarSelection(collar) {
  const nextUuid = collar?.uuid || "";
  store.setState({ selectedMapCollarUuid: nextUuid });
  refreshSelectedMapCollarPanel();
  renderActiveMapCollars(getVisibleMapCollars(), {
    showLabels: Boolean(getDerivedState().mapOverlays?.labels),
    selectedUuid: nextUuid,
  });
}

function handleMapCapture(pointData) {
  const state = getDerivedState();
  if (state.captureMode !== "map") {
    return;
  }

  void persistDraftCollar(pointData, "map")
    .then((draftCollar) => {
      if (!draftCollar) {
        return;
      }

      store.setState({ selectedMapCollarUuid: "" });
      setActiveDraftPoint(draftCollar);
      refreshMapDraftSummary();
      refreshSelectedMapCollarPanel();
      showNotification(
        draftCollar.elevation_status === "pending"
          ? "Punto capturado. La elevacion queda pendiente hasta recuperar conexion."
          : "Punto capturado en el mapa y guardado localmente como borrador.",
        "success",
      );
    })
    .catch((error) => {
      showNotification(error.message || "No fue posible capturar el punto del mapa.", "error", 5200);
    });
}

async function mountMapPage() {
  const state = getDerivedState();
  const container = qs("#map-view");
  const canTryCachedArcGIS = !state.online && hasArcGISCache();

  if (!container) {
    return;
  }

  let mapLoaded = false;

  if (state.online || canTryCachedArcGIS) {
    try {
      refreshMapSearchBar(true);
      await initMap(container, { onCapture: handleMapCapture, onSelectCollar: handleMapCollarSelection });
      mapLoaded = true;
      if (state.online) {
        rememberArcGISCache();
      }

      store.setState({
        mapReady: true,
        mapEngine: "arcgis",
        mapFallbackMessage: state.online ? "" : buildArcGISCacheMessage(),
      });
      refreshMapSearchBar();
    } catch (error) {
      const fallbackMessage = buildMapFallbackMessage(error, state.online);
      refreshMapSearchBar(true);
      await initOfflineMap(container, { onCapture: handleMapCapture, onSelectCollar: handleMapCollarSelection });
      mapLoaded = true;
      store.setState({ mapReady: true, mapEngine: "offline", mapFallbackMessage: state.online ? fallbackMessage : buildOfflineMapBootstrapMessage() });
      refreshMapSearchBar(true);
      showNotification(fallbackMessage, "error", 5200);
    }
  } else {
    refreshMapSearchBar(true);
    await initOfflineMap(container, { onCapture: handleMapCapture, onSelectCollar: handleMapCollarSelection });
    mapLoaded = true;
    store.setState({ mapReady: true, mapEngine: "offline", mapFallbackMessage: buildOfflineMapBootstrapMessage() });
    refreshMapSearchBar(true);
  }

  refreshMapToolbarSection();
  refreshMapStatusChip();
  refreshMapPanels();
  renderActiveMapCollars(getVisibleMapCollars(), {
    showLabels: Boolean(store.getState().mapOverlays?.labels),
    selectedUuid: store.getState().selectedMapCollarUuid,
  });

  if (state.captureMode === "gps" && state.gpsCapture.navigationMode === "fixed") {
    setActiveCurrentLocationPoint(null);
  } else if (state.currentLocation) {
    setActiveCurrentLocationPoint(state.currentLocation);
  } else {
    setActiveCurrentLocationPoint(null);
  }

  if (state.draftCollar) {
    setActiveDraftPoint(state.draftCollar);
  } else {
    setActiveDraftPoint(null);
  }

  if (state.pendingFocusCollarUuid) {
    const collar = await getCollarByUuid(state.pendingFocusCollarUuid);
    await focusActiveCollar(collar);
    store.setState({ pendingFocusCollarUuid: "" });
  }

  if (state.captureMode === "gps" && state.gpsCapture.navigationMode === "free") {
    try {
      await activateGpsFreeNavigation();
    } catch (error) {
      handleGpsNavigationError(error);
    }
  } else {
    stopGpsNavigation({ clearGraphic: mapLoaded && !isOfflineMapActive(store.getState()) });
  }
}

async function handleRouteChange(route) {
  const state = getDerivedState();
  if (state.route === "mapa" && route !== "mapa") {
    stopGpsNavigation({ clearGraphic: true });
  }

  store.setState({ route, sidebarOpen: false, mobileDrawerOpen: false, layersPanelOpen: false, importModalOpen: false });
  refreshChrome();
  renderCurrentPage();
}

async function handleProjectSubmit(form) {
  const data = formToObject(form);

  if (data.uuid) {
    await updateProject(data.uuid, data);
    showNotification("Proyecto actualizado localmente.", "success");
  } else {
    await createProject(data);
    showNotification("Proyecto creado correctamente.", "success");
  }

  store.setState({ editingProjectUuid: "" });
  await rerenderAll();

  if (store.getState().online && appConfig.sync.enabled) {
    await runSync("auto-save");
  }
}

async function handleCollarSubmit(form) {
  const state = getDerivedState();
  const data = formToObject(form);
  const capturedPoint = state.editingCollar ? state.editingCollar : state.draftCollar;

  if (!state.activeProject) {
    throw new Error("Debes seleccionar un proyecto activo antes de guardar collars.");
  }

  if (data.uuid) {
    await updateCollar(data.uuid, data, state.activeProject, capturedPoint);
    showNotification("Collar actualizado localmente.", "success");
  } else {
    await createCollar(data, state.activeProject, capturedPoint);
    showNotification("Collar registrado y agregado a la cola de sync.", "success");
  }

  store.setState({
    editingCollarUuid: "",
    draftCollar: null,
    selectedMapCollarUuid: "",
  });
  setStoredDraftCollar(null);
  await rerenderAll();

  if (store.getState().online && appConfig.sync.enabled) {
    await runSync("auto-save");
  }
}

async function handleSurveySubmit(form) {
  const state = getDerivedState();
  const data = formToObject(form);

  if (data.uuid) {
    await updateSurvey(data.uuid, data, state.activeProjectCollars);
    showNotification("Survey actualizado localmente.", "success");
  } else {
    await createSurvey(data, state.activeProjectCollars);
    showNotification("Survey registrado correctamente.", "success");
  }

  store.setState({ editingSurveyUuid: "" });
  await rerenderAll();

  if (store.getState().online && appConfig.sync.enabled) {
    await runSync("auto-save");
  }
}

async function handleAssaySubmit(form) {
  const state = getDerivedState();
  const data = formToObject(form);

  if (data.uuid) {
    await updateAssay(data.uuid, data, state.activeProjectCollars);
    showNotification("Assay actualizado localmente.", "success");
  } else {
    await createAssay(data, state.activeProjectCollars);
    showNotification("Assay registrado correctamente.", "success");
  }

  store.setState({ editingAssayUuid: "" });
  await rerenderAll();

  if (store.getState().online && appConfig.sync.enabled) {
    await runSync("auto-save");
  }
}

async function handleSurveyCsvImport(file) {
  const state = getDerivedState();

  if (!state.activeProject) {
    throw new Error("Debes seleccionar un proyecto activo antes de importar survey desde CSV.");
  }

  const importedCount = await importSurveysFromCsv(await file.text(), state.activeProjectCollars);
  store.setState({ editingSurveyUuid: "" });
  await rerenderAll();

  if (store.getState().online && appConfig.sync.enabled) {
    await runSync("auto-save");
  }

  showNotification(`${importedCount} survey importados desde CSV.`, "success", 5200);
}

async function handleAssayCsvImport(file) {
  const state = getDerivedState();

  if (!state.activeProject) {
    throw new Error("Debes seleccionar un proyecto activo antes de importar assay desde CSV.");
  }

  const importedCount = await importAssaysFromCsv(await file.text(), state.activeProjectCollars);
  store.setState({ editingAssayUuid: "" });
  await rerenderAll();

  if (store.getState().online && appConfig.sync.enabled) {
    await runSync("auto-save");
  }

  showNotification(`${importedCount} assay importados desde CSV.`, "success", 5200);
}

async function handleLaboratorioSubmit(form) {
  const state = getDerivedState();
  const data = formToObject(form);

  if (data.uuid) {
    await updateLaboratorio(data.uuid, data, state.activeProjectAssays);
    showNotification("Laboratorio actualizado localmente.", "success");
  } else {
    await createLaboratorio(data, state.activeProjectAssays);
    showNotification("Laboratorio registrado correctamente.", "success");
  }

  store.setState({ editingLaboratorioUuid: "" });
  await rerenderAll();

  if (store.getState().online && appConfig.sync.enabled) {
    await runSync("auto-save");
  }
}

async function runSync(trigger = "manual") {
  const messages = {
    auto: "Auto sync al recuperar conexion.",
    "auto-save": "Sincronizacion automatica despues del guardado.",
    manual: "Sincronizacion manual en progreso.",
  };
  store.setState({ isSyncing: true, syncMessage: messages[trigger] || messages.manual });
  refreshChrome();
  renderCurrentPage();

  try {
    let elevationSummary = {
      attempted: 0,
      resolved: 0,
      pending: 0,
      errors: 0,
      skipped: 0,
    };

    if (store.getState().online && appConfig.elevation.enabled && appConfig.elevation.autoResolveOnReconnect) {
      await reconcileDraftElevationIfNeeded(true);
      elevationSummary = await resolvePendingCollarElevations({ online: true });
    }

    const summary = await syncAll();
    const nextSyncQueue = await listSyncQueue();
    const elevationMessage = elevationSummary.attempted
      ? ` Elevaciones resueltas: ${elevationSummary.resolved}. Pendientes: ${elevationSummary.pending}. Errores elevacion: ${elevationSummary.errors}.`
      : "";
    const errorPreview = buildSyncErrorPreview(nextSyncQueue);
    store.setState({ syncMessage: `${summary.message} Sincronizados: ${summary.synced}. Errores: ${summary.errors}. Omitidos: ${summary.skipped}.${elevationMessage}${errorPreview}`, syncQueue: nextSyncQueue });
    showNotification(store.getState().syncMessage, summary.errors || elevationSummary.errors ? "error" : "success", 4800);
  } finally {
    store.setState({ isSyncing: false });
    await rerenderAll();
  }
}

function confirmNative(title, description) {
  return window.confirm([title, description].filter(Boolean).join("\n\n"));
}

async function handleAction(action, source) {
  const state = getDerivedState();
  const uuid = source.dataset.uuid || "";

  switch (action) {
    case "toggle-sidebar":
      setSidebarOpen(!state.mobileDrawerOpen);
      break;
    case "toggle-mobile-drawer":
      store.setState({ mobileDrawerOpen: !state.mobileDrawerOpen });
      refreshChrome();
      break;
    case "close-mobile-drawer":
      store.setState({ mobileDrawerOpen: false });
      refreshChrome();
      break;
    case "select-project":
      await selectActiveProject(uuid);
      if (state.captureMode === "map") {
        setMapCaptureEnabled(false);
      }
      store.setState({ editingProjectUuid: "", editingCollarUuid: "", editingSurveyUuid: "", editingAssayUuid: "", editingLaboratorioUuid: "" });
      await rerenderAll();
      showNotification("Proyecto activo actualizado.", "success");
      break;
    case "edit-project":
      store.setState({ editingProjectUuid: uuid });
      renderCurrentPage();
      break;
    case "reset-project-form":
      store.setState({ editingProjectUuid: "" });
      renderCurrentPage();
      break;
    case "remove-project": {
      const confirmed = confirmNative(
        "Eliminar proyecto",
        "Se eliminara el proyecto en cascada junto con sus collars, surveys, assays y laboratorios vinculados.",
      );

      if (!confirmed) {
        return;
      }

      const result = await deleteOrDeactivateProject(uuid);
      await rerenderAll();
      if (store.getState().online && appConfig.sync.enabled) {
        await runSync("auto-save");
      }
      showNotification("Proyecto eliminado correctamente.", "success");
      break;
    }
    case "go-to-map":
      navigate("mapa");
      break;
    case "dismiss-draft-hint":
      store.setState({ mapDraftHintDismissed: true });
      setStoredDraftHintDismissed(true);
      refreshMapDraftSummary();
      break;
    case "clear-draft-collar":
      store.setState({ draftCollar: null, editingCollarUuid: "", pendingFocusCollarUuid: "", gpsCapture: createGpsCaptureState(), selectedMapCollarUuid: "" });
      setStoredDraftCollar(null);
      setActiveDraftPoint(null);
      if (store.getState().route === "mapa") {
        refreshMapDraftSummary();
        refreshMapGpsUi();
        refreshSelectedMapCollarPanel();
      } else {
        renderCurrentPage();
      }
      break;
    case "edit-collar":
      store.setState({ editingCollarUuid: uuid });
      if (store.getState().route === "collars") {
        renderCurrentPage();
      } else {
        navigate("collars");
      }
      break;
    case "reset-collar-form":
      store.setState({ editingCollarUuid: "", pendingFocusCollarUuid: "" });
      renderCurrentPage();
      break;
    case "edit-survey":
      store.setState({ editingSurveyUuid: uuid });
      if (store.getState().route === "survey") {
        renderCurrentPage();
      } else {
        navigate("survey");
      }
      break;
    case "reset-survey-form":
      store.setState({ editingSurveyUuid: "" });
      renderCurrentPage();
      break;
    case "import-survey-csv":
      qs("#survey-csv-input")?.click();
      break;
    case "remove-survey": {
      const confirmed = confirmNative(
        "Eliminar survey",
        "Se eliminara localmente y, si ya existe en ArcGIS, se enviara la eliminacion remota.",
      );

      if (!confirmed) {
        return;
      }

      await deleteSurvey(uuid);
      store.setState({ editingSurveyUuid: "" });
      await rerenderAll();
      if (store.getState().online && appConfig.sync.enabled) {
        await runSync("auto-save");
      }
      showNotification("Survey eliminado correctamente.", "success");
      break;
    }
    case "edit-assay":
      store.setState({ editingAssayUuid: uuid });
      if (store.getState().route === "assay") {
        renderCurrentPage();
      } else {
        navigate("assay");
      }
      break;
    case "reset-assay-form":
      store.setState({ editingAssayUuid: "" });
      renderCurrentPage();
      break;
    case "import-assay-csv":
      qs("#assay-csv-input")?.click();
      break;
    case "remove-assay": {
      const confirmed = confirmNative(
        "Eliminar assay",
        "Se eliminara localmente y, si ya existe en ArcGIS, se enviara la eliminacion remota.",
      );

      if (!confirmed) {
        return;
      }

      await deleteAssay(uuid);
      store.setState({ editingAssayUuid: "" });
      await rerenderAll();
      if (store.getState().online && appConfig.sync.enabled) {
        await runSync("auto-save");
      }
      showNotification("Assay eliminado correctamente.", "success");
      break;
    }
    case "edit-laboratorio":
      store.setState({ editingLaboratorioUuid: uuid });
      if (store.getState().route === "laboratorio") {
        renderCurrentPage();
      } else {
        navigate("laboratorio");
      }
      break;
    case "reset-laboratorio-form":
      store.setState({ editingLaboratorioUuid: "" });
      renderCurrentPage();
      break;
    case "remove-laboratorio": {
      const confirmed = confirmNative(
        "Eliminar laboratorio",
        "Se eliminara localmente y, si ya existe en ArcGIS, se enviara la eliminacion remota.",
      );

      if (!confirmed) {
        return;
      }

      await deleteLaboratorio(uuid);
      store.setState({ editingLaboratorioUuid: "" });
      await rerenderAll();
      if (store.getState().online && appConfig.sync.enabled) {
        await runSync("auto-save");
      }
      showNotification("Registro de laboratorio eliminado correctamente.", "success");
      break;
    }
    case "remove-collar": {
      const confirmed = confirmNative(
        "Eliminar collar",
        "Se eliminara localmente y, si ya existe en ArcGIS, tambien se enviara la eliminacion remota.",
      );

      if (!confirmed) {
        return;
      }

      await deleteCollar(uuid);
      store.setState({ editingCollarUuid: "", draftCollar: null, pendingFocusCollarUuid: "", selectedMapCollarUuid: "" });
      setStoredDraftCollar(null);
      await rerenderAll();
      if (store.getState().online && appConfig.sync.enabled) {
        await runSync("auto-save");
      }
      showNotification("Collar eliminado correctamente.", "success");
      break;
    }
    case "focus-collar": {
      store.setState({ pendingFocusCollarUuid: uuid });

      if (store.getState().route !== "mapa") {
        navigate("mapa");
      } else {
        const collar = await getCollarByUuid(uuid);
        await focusActiveCollar(collar);
        store.setState({ pendingFocusCollarUuid: "" });
        handleMapCollarSelection(collar);
      }
      break;
    }
    case "set-capture-mode": {
      const nextMode = source.dataset.mode === "gps" ? "gps" : "map";
      if (nextMode === "map") {
        activateMapInteractionMode({ captureEnabled: false });
      } else {
        setStoredCaptureMode(nextMode);
        setMapCaptureEnabled(false);
        store.setState({
          captureMode: nextMode,
          gpsCapture: createGpsCaptureState({
            navigationMode: "free",
            meanAccuracy: state.currentLocation?.gps_accuracy_meters ?? null,
            bestAccuracy: state.currentLocation?.gps_accuracy_meters ?? null,
            message: "GPS en navegacion libre.",
          }),
        });
      }

      refreshMapInteractionUi();
      showNotification(nextMode === "gps" ? "Modo GPS activado." : "Modo mapa activado.", "success");
      break;
    }
    case "activate-map-navigation":
      activateMapInteractionMode({ captureEnabled: false });
      refreshMapInteractionUi();
      break;
    case "activate-map-capture":
      if (!state.activeProject) {
        throw new Error("Debes seleccionar un proyecto activo antes de activar la captura sobre el mapa.");
      }

      if (!state.mapReady) {
        throw new Error("El mapa base no esta disponible. Usa GPS o coordenadas manuales mientras no haya mapa.");
      }

      activateMapInteractionMode({ captureEnabled: true });
      refreshMapInteractionUi();
      break;
    case "activate-gps-mode":
      if (state.captureMode !== "gps") {
        setStoredCaptureMode("gps");
        store.setState({
          captureMode: "gps",
          gpsCapture: createGpsCaptureState({
            navigationMode: "free",
            meanAccuracy: state.currentLocation?.gps_accuracy_meters ?? null,
            bestAccuracy: state.currentLocation?.gps_accuracy_meters ?? null,
            message: "GPS en navegacion libre.",
          }),
        });
      }
      refreshMapToolbarSection();
      await activateGpsFreeNavigation();
      refreshMapGpsUi();
      break;
    case "toggle-capture":
      if (state.captureMode !== "map") {
        return;
      }

      if (!state.mapReady) {
        throw new Error("El mapa base no esta disponible. Usa GPS o coordenadas manuales mientras no haya mapa.");
      }

      setMapCaptureEnabled(!getCaptureEnabled());
      refreshMapToolbarSection();
      refreshMapStatusChip();
      break;
    case "map-zoom-in":
      if (isOfflineMapActive()) {
        adjustOfflineMapZoom(1);
      } else {
        await adjustMapZoom(1);
      }
      break;
    case "map-zoom-out":
      if (isOfflineMapActive()) {
        adjustOfflineMapZoom(-1);
      } else {
        await adjustMapZoom(-1);
      }
      break;
    case "map-reset-north":
      if (isOfflineMapActive()) {
        resetOfflineMapNorth();
      } else {
        await resetMapNorth();
      }
      break;
    case "toggle-map-perspective":
      showNotification(
        state.mapEngine === "arcgis"
          ? "La escena 3D no esta habilitada en este WebMap. Se mantiene la vista 2D operativa."
          : "La vista 3D no esta disponible en el mapa offline local.",
        "success",
        3600,
      );
      break;
    case "toggle-layers-panel":
      store.setState({ layersPanelOpen: !state.layersPanelOpen, importModalOpen: false });
      refreshMapToolbarSection();
      refreshMapLayersPanel();
      break;
    case "toggle-map-overlay": {
      const overlayKey = source.dataset.overlay || "";
      if (!Object.hasOwn(state.mapOverlays, overlayKey)) {
        return;
      }

      const nextOverlays = {
        ...state.mapOverlays,
        [overlayKey]: !state.mapOverlays[overlayKey],
      };

      store.setState({
        mapOverlays: nextOverlays,
        selectedMapCollarUuid: overlayKey === "collars" && !nextOverlays.collars ? "" : state.selectedMapCollarUuid,
      });
      refreshMapLayersPanel();
      refreshMapOverlayVisuals();
      refreshMapProjectBanner();
      refreshSelectedMapCollarPanel();
      renderActiveMapCollars(getVisibleMapCollars(getDerivedState()), {
        showLabels: Boolean(nextOverlays.labels),
        selectedUuid: getDerivedState().selectedMapCollarUuid,
      });
      break;
    }
    case "open-import-modal":
      store.setState({ importModalOpen: true, layersPanelOpen: false });
      refreshMapToolbarSection();
      refreshMapLayersPanel();
      refreshMapImportModal();
      break;
    case "close-import-modal":
      store.setState({ importModalOpen: false });
      refreshMapImportModal();
      break;
    case "select-import-files":
      qs("#map-import-file-input")?.click();
      break;
    case "clear-selected-map-collar":
      handleMapCollarSelection(null);
      break;
    case "gps-free-navigation":
      if (state.captureMode !== "gps") {
        return;
      }

      store.setState({
        gpsCapture: createGpsCaptureState({
          navigationMode: "free",
          meanAccuracy: state.currentLocation?.gps_accuracy_meters ?? null,
          bestAccuracy: state.currentLocation?.gps_accuracy_meters ?? null,
          message: "GPS en navegacion libre.",
        }),
      });
      await activateGpsFreeNavigation();
      refreshMapGpsUi();
      break;
    case "gps-fix-point": {
      if (state.captureMode !== "gps") {
        return;
      }

      if (!state.activeProject) {
        throw new Error("Debes seleccionar un proyecto activo antes de fijar un collar por GPS.");
      }

      if (!state.currentLocation) {
        throw new Error("Espera a que el GPS obtenga una ubicacion valida antes de fijar el punto.");
      }

      stopGpsNavigation({ clearGraphic: true });
      const draftCollar = await persistDraftCollar(state.currentLocation, "gps");
      if (!draftCollar) {
        return;
      }

      store.setState({
        gpsCapture: createGpsCaptureState({
          navigationMode: "fixed",
          meanAccuracy: state.currentLocation.gps_accuracy_meters,
          bestAccuracy: state.currentLocation.gps_accuracy_meters,
          samplesCollected: 1,
          message: "Punto GPS fijado y listo para guardarse.",
        }),
      });
      setActiveDraftPoint(draftCollar);
      refreshMapDraftSummary();
      refreshMapGpsUi();
      showNotification(
        draftCollar.elevation_status === "pending"
          ? `Punto GPS fijado. Precision actual: ${state.currentLocation.gps_accuracy_meters || "-"} m. La elevacion se resolvera al volver online.`
          : `Punto GPS fijado. Precision actual: ${state.currentLocation.gps_accuracy_meters || "-"} m. Elevacion ${getElevationStateLabel(draftCollar)}.`,
        "success",
        5200,
      );
      break;
    }
    case "sync-now":
      await runSync("manual");
      break;
    case "retry-map-load":
      if (!store.getState().online) {
        throw new Error("No puedes recargar el mapa mientras el dispositivo sigue offline.");
      }

      store.setState({ mapReady: true, mapFallbackMessage: "" });
      refreshMapToolbarSection();
      refreshMapStatusChip();
      await mountMapPage();
      break;
    case "download-arcgis": {
      const summary = await bootstrapArcGISData();
      await rerenderAll();
      showNotification(summary.message, summary.skipped ? "error" : "success", 5200);
      break;
    }
    case "export-backup":
      await exportBackup();
      showNotification("Respaldo JSON exportado correctamente.", "success");
      break;
    case "import-backup": {
      const input = qs("#backup-file-input");
      input?.click();
      break;
    }
    case "install-app": {
      const promptEvent = store.getState().deferredPrompt;
      if (!promptEvent) {
        return;
      }

      promptEvent.prompt();
      await promptEvent.userChoice;
      store.setState({ deferredPrompt: null });
      refreshChrome();
      break;
    }
    default:
      break;
  }
}

window.__appHandleAction = (action, source) => {
  return handleAction(action, source).catch((error) => {
    showNotification(error.message || "No fue posible ejecutar la accion solicitada.", "error", 5200);
  });
};

function bindEvents() {
  document.addEventListener("click", async (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) {
      return;
    }

    try {
      await handleAction(actionTarget.dataset.action, actionTarget);
    } catch (error) {
      showNotification(error.message || "No fue posible ejecutar la accion solicitada.", "error", 5200);
    }
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    event.preventDefault();

    try {
      if (form.id === "project-form") {
        await handleProjectSubmit(form);
      }

      if (form.id === "collar-form") {
        await handleCollarSubmit(form);
      }

      if (form.id === "survey-form") {
        await handleSurveySubmit(form);
      }

      if (form.id === "assay-form") {
        await handleAssaySubmit(form);
      }

      if (form.id === "laboratorio-form") {
        await handleLaboratorioSubmit(form);
      }

      if (form.id === "offline-point-form") {
        await handleOfflinePointSubmit(form);
      }
    } catch (error) {
      showNotification(error.message || "No fue posible completar la operacion.", "error", 4500);
    }
  });

  document.addEventListener("change", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const fileInputIds = new Set(["backup-file-input", "survey-csv-input", "assay-csv-input", "map-import-file-input"]);
    if (target.type !== "file" || !fileInputIds.has(target.id)) {
      return;
    }

    const fileCount = target.files?.length || 0;
    const file = target.files?.[0];
    target.value = "";

    if (!file) {
      return;
    }

    try {
      if (target.id === "backup-file-input") {
        const summary = await importBackup(file);
        store.setState({
          draftCollar: getStoredDraftCollar(),
          editingCollarUuid: "",
          editingProjectUuid: "",
          editingSurveyUuid: "",
          editingAssayUuid: "",
          editingLaboratorioUuid: "",
        });
        await rerenderAll();
        showNotification(
          `Respaldo importado. Proyectos: ${summary.projects}, collars: ${summary.collars}, survey: ${summary.surveys}, assay: ${summary.assays}, laboratorio: ${summary.laboratorios}.`,
          "success",
          5200,
        );
        return;
      }

      if (target.id === "survey-csv-input") {
        await handleSurveyCsvImport(file);
        return;
      }

      if (target.id === "assay-csv-input") {
        await handleAssayCsvImport(file);
        return;
      }

      if (target.id === "map-import-file-input") {
        store.setState({ importModalOpen: false });
        refreshMapImportModal();
        showNotification(`UI lista para importar ${fileCount || 1} archivo(s). La ingestion GPX/KML/GeoJSON no se conecto porque pediste no tocar la logica funcional.`, "success", 5200);
      }
    } catch (error) {
      showNotification(error.message || "No fue posible procesar el archivo seleccionado.", "error", 5200);
    }
  });
}

function registerInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    store.setState({ deferredPrompt: event });
    refreshChrome();
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (error) {
      showNotification(`No se pudo registrar el service worker: ${error.message}`, "error", 5200);
    }
  });
}

async function bootstrap() {
  document.title = appConfig.appName;
  await initDB();
  store.setState({ draftCollar: getStoredDraftCollar(), captureMode: getStoredCaptureMode() });
  renderShell();
  bindEvents();
  registerInstallPrompt();
  registerServiceWorker();

  if (store.getState().online && appConfig.sync.provider === "arcgis-feature-service") {
    try {
      const summary = await bootstrapArcGISData();
      if (!summary.skipped) {
        showNotification(summary.message, "success", 4200);
      }
    } catch (error) {
      showNotification(error.message || "No fue posible descargar datos de ArcGIS al iniciar.", "error", 5200);
    }
  }

  await rerenderAll();

  if (store.getState().online && appConfig.elevation.enabled) {
    const draftUpdated = await reconcileDraftElevationIfNeeded(true);
    if (draftUpdated) {
      await rerenderAll();
    }
  }

  initRouter(handleRouteChange);
  watchNetworkStatus(async (online) => {
    const previousState = store.getState();
    store.setState({ online });
    refreshChrome();

    if (previousState.route === "mapa") {
      if (!online && previousState.mapEngine === "arcgis" && previousState.mapReady) {
        store.setState({ mapFallbackMessage: buildArcGISCacheMessage() });
        refreshMapToolbarSection();
        refreshMapStatusChip();
        refreshMapProjectBanner();
        showNotification("Sigues usando el mapa ArcGIS cacheado. Las zonas no visitadas pueden no estar disponibles offline.", "success", 4200);
      } else if (online && previousState.mapEngine === "arcgis" && previousState.mapReady) {
        rememberArcGISCache();
        store.setState({ mapFallbackMessage: "" });
        refreshMapToolbarSection();
        refreshMapStatusChip();
        refreshMapProjectBanner();
      } else {
        renderCurrentPage();
      }
    }

    if (online && appConfig.elevation.enabled && !appConfig.sync.autoSyncOnReconnect) {
      const draftUpdated = await reconcileDraftElevationIfNeeded(true);
      if (draftUpdated) {
        renderCurrentPage();
      }
    }

    if (online && appConfig.sync.autoSyncOnReconnect) {
      await runSync("auto");
    }
  });

  showNotification(`Datos locales cargados. Ultima revision: ${formatDateTime(new Date().toISOString())}`, "success", 2800);
}

bootstrap();