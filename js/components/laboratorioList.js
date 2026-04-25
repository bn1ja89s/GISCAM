import { escapeHtml, formatDateTime } from "../core/helpers.js";
import { renderSyncBadge } from "../ui/statusBadge.js";

export function renderLaboratorioList(laboratorios) {
  if (!laboratorios.length) {
    return '<div class="empty-state">No hay registros de laboratorio para el proyecto activo.</div>';
  }

  return `
    <div class="list">
      ${laboratorios
        .map(
          (laboratorio) => `
            <article class="list-item stack">
              <div class="section-head">
                <div>
                  <h3 class="title-sm">${escapeHtml(laboratorio.laboratorio || "SIN LAB")}</h3>
                  <p class="muted">Muestra: ${escapeHtml(laboratorio.muestra_id || "-")}</p>
                </div>
                ${renderSyncBadge(laboratorio.estado_sync)}
              </div>
              <div class="list-item__meta">
                <span>Fecha: ${escapeHtml(laboratorio.fecha_recepcion || "-")}</span>
                <span>Contraccion: ${escapeHtml(String(laboratorio.contraccion ?? "-"))}</span>
                <span>Absorcion: ${escapeHtml(String(laboratorio.absorcion ?? "-"))}</span>
                <span>Actualizado: ${escapeHtml(formatDateTime(laboratorio.fecha_modificacion))}</span>
              </div>
              <div class="inline-row">
                <button class="ghost-button" type="button" data-action="edit-laboratorio" data-uuid="${laboratorio.uuid}">Editar</button>
                <button class="ghost-button" type="button" data-action="remove-laboratorio" data-uuid="${laboratorio.uuid}">Eliminar</button>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}