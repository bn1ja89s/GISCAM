import { escapeHtml } from "../core/helpers.js";

export function renderSurveyForm({ activeProject, activeProjectCollars, editingSurvey }) {
  if (!activeProject) {
    return '<div class="notice">Debes tener un proyecto activo antes de registrar survey.</div>';
  }

  if (!activeProjectCollars.length) {
    return '<div class="notice">Primero registra al menos un collar para poder asociar survey.</div>';
  }

  const survey = editingSurvey || {};
  const selectedCollarUuid = survey.collar_uuid || activeProjectCollars[0]?.uuid || "";
  const selectedCollar = activeProjectCollars.find((item) => item.uuid === selectedCollarUuid) || activeProjectCollars[0];

  return `
    <form id="survey-form" class="stack" autocomplete="off">
      <input type="hidden" name="uuid" value="${escapeHtml(survey.uuid || "")}">
      <div class="panel-tile stack">
        <p class="eyebrow">Importar CSV</p>
        <p class="muted">Columnas requeridas: Collar, Profundidad, DIP, Azimut, Instrumento.</p>
        <input id="survey-csv-input" class="hidden" type="file" accept=".csv,text/csv">
        <div class="inline-row">
          <button class="ghost-button" type="button" data-action="import-survey-csv">Cargar CSV</button>
          <a class="ghost-button" href="./docs/survey_template.csv" download="survey_template.csv">Descargar plantilla</a>
        </div>
      </div>
      <div class="grid-fields">
        <label class="field">
          <span>Collar</span>
          <select class="select" name="collar_uuid" required>
            ${activeProjectCollars
              .map(
                (collar) => `<option value="${escapeHtml(collar.uuid)}" ${collar.uuid === selectedCollarUuid ? "selected" : ""}>${escapeHtml(collar.hole_id)} · ${escapeHtml(collar.tipo || "-")}</option>`,
              )
              .join("")}
          </select>
        </label>
        <label class="field">
          <span>Hole ID</span>
          <input class="input" value="${escapeHtml(selectedCollar?.hole_id || "")}" readonly>
        </label>
      </div>
      <div class="grid-fields grid-fields--3">
        <label class="field">
          <span>Profundidad</span>
          <input class="input" name="profundidad" type="number" step="0.01" value="${escapeHtml(String(survey.profundidad ?? ""))}" required>
        </label>
        <label class="field">
          <span>DIP</span>
          <input class="input" name="dip" type="number" step="0.01" value="${escapeHtml(String(survey.dip ?? ""))}">
        </label>
        <label class="field">
          <span>Azimut</span>
          <input class="input" name="azimut" type="number" step="0.01" value="${escapeHtml(String(survey.azimut ?? ""))}">
        </label>
      </div>
      <label class="field">
        <span>Instrumento</span>
        <input class="input" name="instrumento" value="${escapeHtml(survey.instrumento || "")}" placeholder="Brunton, gyro, etc.">
      </label>
      <div class="inline-row">
        <button class="button" type="submit">${editingSurvey ? "Actualizar survey" : "Guardar survey"}</button>
        <button class="ghost-button" type="button" data-action="reset-survey-form">${editingSurvey ? "Cancelar edicion" : "Limpiar"}</button>
      </div>
    </form>
  `;
}