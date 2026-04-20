import { escapeHtml, todayValue } from "../core/helpers.js";

export function renderLaboratorioForm({ activeProject, activeProjectAssays, editingLaboratorio }) {
  if (!activeProject) {
    return '<div class="notice">Debes tener un proyecto activo antes de registrar laboratorio.</div>';
  }

  if (!activeProjectAssays.length) {
    return '<div class="notice">Primero registra al menos un assay para poder asociar laboratorio.</div>';
  }

  const laboratorio = editingLaboratorio || {};
  const selectedAssayUuid = laboratorio.assay_uuid || activeProjectAssays[0]?.uuid || "";
  const selectedAssay = activeProjectAssays.find((item) => item.uuid === selectedAssayUuid) || activeProjectAssays[0];

  return `
    <form id="laboratorio-form" class="stack" autocomplete="off">
      <input type="hidden" name="uuid" value="${escapeHtml(laboratorio.uuid || "")}">
      <div class="grid-fields">
        <label class="field">
          <span>Assay</span>
          <select class="select" name="assay_uuid" required>
            ${activeProjectAssays
              .map(
                (assay) => `<option value="${escapeHtml(assay.uuid)}" ${assay.uuid === selectedAssayUuid ? "selected" : ""}>${escapeHtml(assay.muestra_id || assay.hole_id || assay.uuid)}</option>`,
              )
              .join("")}
          </select>
        </label>
        <label class="field">
          <span>Muestra ID</span>
          <input class="input" name="muestra_id" value="${escapeHtml(laboratorio.muestra_id || selectedAssay?.muestra_id || "")}">
        </label>
      </div>
      <div class="grid-fields grid-fields--3">
        <label class="field"><span>Fecha recepcion</span><input class="input" name="fecha_recepcion" type="date" value="${escapeHtml(laboratorio.fecha_recepcion || todayValue())}"></label>
        <label class="field"><span>Laboratorio</span><input class="input" name="laboratorio" value="${escapeHtml(laboratorio.laboratorio || "")}" required></label>
        <label class="field"><span>Color Q</span><input class="input" name="color_q" value="${escapeHtml(laboratorio.color_q || "")}"></label>
      </div>
      <div class="grid-fields">
        <label class="field"><span>Contraccion</span><input class="input" name="contraccion" type="number" step="0.01" value="${escapeHtml(String(laboratorio.contraccion ?? ""))}"></label>
        <label class="field"><span>Absorcion</span><input class="input" name="absorcion" type="number" step="0.01" value="${escapeHtml(String(laboratorio.absorcion ?? ""))}"></label>
      </div>
      <label class="field">
        <span>Observaciones</span>
        <textarea class="textarea" name="observaciones">${escapeHtml(laboratorio.observaciones || "")}</textarea>
      </label>
      <div class="inline-row">
        <button class="button" type="submit">${editingLaboratorio ? "Actualizar laboratorio" : "Guardar laboratorio"}</button>
        <button class="ghost-button" type="button" data-action="reset-laboratorio-form">${editingLaboratorio ? "Cancelar edicion" : "Limpiar"}</button>
      </div>
    </form>
  `;
}