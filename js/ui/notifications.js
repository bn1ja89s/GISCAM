import { escapeHtml } from "../core/helpers.js";
import { qs } from "../core/dom.js";

export function showNotification(message, type = "info", timeout = 3200) {
  const root = qs("#toast-root");
  if (!root) {
    return;
  }

  const maxVisibleToasts = window.matchMedia("(max-width: 767px)").matches ? 2 : 4;
  while (root.children.length >= maxVisibleToasts) {
    root.firstElementChild?.remove();
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <div class="toast__head">
      <strong class="toast__title">${escapeHtml(type.toUpperCase())}</strong>
      <button class="toast__dismiss" type="button" data-toast-dismiss aria-label="Cerrar aviso">&times;</button>
    </div>
    <p class="muted toast__message">${escapeHtml(message)}</p>
  `;
  root.appendChild(toast);

  const removeToast = () => {
    toast.remove();
  };

  const timeoutId = window.setTimeout(removeToast, timeout);
  toast.querySelector("[data-toast-dismiss]")?.addEventListener("click", () => {
    window.clearTimeout(timeoutId);
    removeToast();
  });
}