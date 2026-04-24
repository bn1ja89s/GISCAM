import { escapeHtml } from "../core/helpers.js";

export function renderProjectForm(project) {
  const currentSr = project?.sr_proyecto || "WGS84_UTM_17S";
  const currentDemSourceType = project?.dem_source_type || "global";

  return `
    <form id="project-form" class="stack" autocomplete="off">
      <input type="hidden" name="uuid" value="${escapeHtml(project?.uuid || "")}">
      <div class="grid-fields">
        <label class="field">
          <span>Concesion / area</span>
          <select class="select" name="concesion_area" required onchange="(function(el){var m={'CHILCAY 05':{cod:'CH05',cat:'791195'},'CAPRICHO':{cod:'CAP',cat:'4490.1'}};var d=m[el.value];if(d){var f=el.form;f.elements.cod_exploracion.value=d.cod;f.elements.cod_catastral.value=d.cat;}})(this)">
            <option value="" ${!['CHILCAY 05','CAPRICHO'].includes(project?.concesion_area||'') ? 'selected' : ''}>— Seleccionar área —</option>
            <option value="CHILCAY 05" ${project?.concesion_area === 'CHILCAY 05' ? 'selected' : ''}>CHILCAY 05</option>
            <option value="CAPRICHO" ${project?.concesion_area === 'CAPRICHO' ? 'selected' : ''}>CAPRICHO</option>
          </select>
        </label>
        <label class="field">
          <span>Codigo exploracion</span>
          <input class="input" id="campo-codigo-exploracion" name="cod_exploracion" value="${escapeHtml(project?.cod_exploracion || "")}" required>
        </label>
      </div>
      <div class="grid-fields">
        <label class="field">
          <span>Codigo catastral</span>
          <input class="input" id="campo-codigo-catastral" name="cod_catastral" value="${escapeHtml(project?.cod_catastral || "")}">
        </label>
        <label class="field">
          <span>Tecnico</span>
          <input class="input" name="tecnico" value="${escapeHtml(project?.tecnico || "")}" required>
        </label>
      </div>
      <div class="grid-fields">
        <label class="field">
          <span>Localizacion</span>
          <input class="input" name="localizacion" value="${escapeHtml(project?.localizacion || "")}">
        </label>
        <label class="field">
          <span>SR proyecto</span>
          <select class="select" name="sr_proyecto" required>
            <option value="WGS84_UTM_17S" ${currentSr === "WGS84_UTM_17S" ? "selected" : ""}>UTM WGS84 zona 17S</option>
            <option value="UTM_WGS84_17N" ${currentSr === "UTM_WGS84_17N" ? "selected" : ""}>UTM WGS84 zona 17N</option>
            <option value="WGS84_UTM_18S" ${currentSr === "WGS84_UTM_18S" ? "selected" : ""}>UTM WGS84 zona 18S</option>
            <option value="UTM_WGS84_18N" ${currentSr === "UTM_WGS84_18N" ? "selected" : ""}>UTM WGS84 zona 18N</option>
          </select>
        </label>
      </div>
      <div class="grid-fields">
        <label class="field">
          <span>Fuente DEM</span>
          <select class="select" name="dem_source_type">
            <option value="global" ${currentDemSourceType === "global" ? "selected" : ""}>DEM global</option>
            <option value="project" ${currentDemSourceType === "project" ? "selected" : ""}>DEM especifico del proyecto</option>
          </select>
        </label>
        <label class="field">
          <span>URL DEM del proyecto</span>
          <input class="input" name="dem_service_url" value="${escapeHtml(project?.dem_service_url || "")}" placeholder="https://.../ImageServer">
        </label>
      </div>
      <p class="muted">Si seleccionas un DEM especifico del proyecto, registra la URL publica del servicio ArcGIS Elevation/ImageServer. Si no, se usara el DEM global cuando el equipo vuelva a estar online.</p>
      <label class="inline-row">
        <input type="checkbox" name="set_active" ${project?.activo ? "checked" : ""}>
        <span>Dejar como proyecto activo</span>
      </label>
      <div class="inline-row">
        <button class="button" type="submit">${project ? "Actualizar proyecto" : "Crear proyecto"}</button>
        <button class="ghost-button" type="button" data-action="reset-project-form" onclick="window.__appHandleAction && window.__appHandleAction('reset-project-form', this); return false;">${project ? "Cancelar edicion" : "Limpiar"}</button>
      </div>
    </form>
  `;
}