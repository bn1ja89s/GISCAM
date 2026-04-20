import { renderIcon } from "../ui/icons.js";

function renderToolButton({ action, icon, label, active = false, disabled = false, extraAttributes = "" }) {
  return `
    <button
      class="map-tool-button ${active ? "is-active" : ""}"
      type="button"
      data-action="${action}"
      ${disabled ? "disabled" : ""}
      ${extraAttributes}
      aria-label="${label}"
      title="${label}"
    >
      ${renderIcon(icon)}
    </button>
  `;
}

export function renderMapToolbar({
  captureEnabled,
  hasActiveProject,
  captureMode,
  gpsCapture,
  hasCurrentLocation,
  mapAvailable = true,
  layersPanelOpen = false,
}) {
  const canMapCapture = mapAvailable && hasActiveProject;
  const canFixGpsPoint = captureMode === "gps" && hasCurrentLocation && hasActiveProject && gpsCapture?.navigationMode !== "fixed";

  return `
    <div class="map-tool-panel" role="toolbar" aria-label="Herramientas del mapa">
      ${renderToolButton({
        action: "activate-map-navigation",
        icon: "hand",
        label: "Navegacion libre",
        active: captureMode === "map" && !captureEnabled,
      })}
      ${renderToolButton({
        action: "activate-map-capture",
        icon: "collar",
        label: "Captura activa",
        active: captureMode === "map" && captureEnabled,
        disabled: !canMapCapture,
      })}
      ${renderToolButton({
        action: "activate-gps-mode",
        icon: "gps",
        label: "Navegacion GPS",
        active: captureMode === "gps",
      })}
      ${renderToolButton({ action: "toggle-layers-panel", icon: "layers", label: "Capas", active: layersPanelOpen })}
      ${renderToolButton({
        action: "gps-fix-point",
        icon: "capture",
        label: "Fijar punto GPS",
        disabled: !canFixGpsPoint,
      })}
    </div>
  `;
}