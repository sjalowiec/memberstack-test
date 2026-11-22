import {
  isProjectChartType,
  loadProjectChart,
  projectChartTitle,
  renderProjectChartView,
  type ProjectChartType,
} from "./projectSizingChart";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function focusable(dialog: ParentNode): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") return false;
    if (el.closest("[hidden]")) return false;
    return true;
  });
}

function trapFocus(event: KeyboardEvent, dialog: HTMLElement): void {
  if (event.key !== "Tab") return;
  const items = focusable(dialog);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const inside = active != null && dialog.contains(active);
  if (event.shiftKey && (!inside || active === first)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!inside || active === last)) {
    event.preventDefault();
    first.focus();
  }
}

function toolUnit(): "in" | "cm" {
  const stored = localStorage.getItem("kbm-units");
  if (stored === "cm" || stored === "in") return stored;
  const active = document.querySelector(".units-toggle .unit-btn.active");
  return active?.getAttribute("data-unit") === "cm" ? "cm" : "in";
}

export function initProjectSizingChartModal(root: ParentNode = document): void {
  const dialog = root.querySelector<HTMLDialogElement>("[data-sizing-chart-modal]");
  const body = dialog?.querySelector<HTMLElement>("[data-sizing-chart-body]");
  if (!dialog || !body || typeof dialog.showModal !== "function") return;
  if (dialog.dataset.sizingChartBound === "true") return;
  dialog.dataset.sizingChartBound = "true";

  let opener: HTMLElement | null = null;
  let chartType: ProjectChartType = "scarves";
  let isMetric = false;
  let previousOverflow = "";

  const unitButtons = () =>
    Array.from(dialog.querySelectorAll<HTMLButtonElement>("[data-sizing-chart-unit]"));

  const syncUnitButtons = (): void => {
    unitButtons().forEach((button) => {
      const selected = (button.dataset.sizingChartUnit === "cm") === isMetric;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  };

  const showMessage = (message: string): void => {
    body.innerHTML = `<h2 id="sizing-chart-modal-title">${projectChartTitle(chartType)}</h2><p class="sizing-chart-modal__status">${message}</p>`;
  };

  const render = async (): Promise<void> => {
    syncUnitButtons();
    showMessage("Loading sizes…");
    try {
      const rows = await loadProjectChart(chartType);
      body.innerHTML = renderProjectChartView(chartType, rows, isMetric);
    } catch {
      showMessage("These sizes could not be loaded. Please try again.");
    }
  };

  const close = (): void => {
    if (dialog.open) dialog.close();
  };

  const openFrom = (trigger: HTMLElement, type: ProjectChartType): void => {
    if (dialog.open) return;
    opener = trigger;
    chartType = type;
    isMetric = toolUnit() === "cm";
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-sizing-chart-close]")?.focus();
    void render();
  };

  dialog.addEventListener("close", () => {
    document.body.style.overflow = previousOverflow;
    const restore = opener;
    opener = null;
    if (restore && document.contains(restore)) restore.focus();
  });

  dialog.addEventListener("cancel", () => {
    /* Native Escape closes the dialog; the close listener returns focus. */
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  dialog.querySelectorAll("[data-sizing-chart-close]").forEach((el) => {
    el.addEventListener("click", () => close());
  });

  dialog.addEventListener("keydown", (event) => {
    if (!dialog.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    trapFocus(event, dialog);
  });

  unitButtons().forEach((button) => {
    button.addEventListener("click", () => {
      isMetric = button.dataset.sizingChartUnit === "cm";
      void render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-sizing-chart-open]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const type = button.dataset.sizingChartOpen ?? "";
      if (!isProjectChartType(type)) return;
      openFrom(button, type);
    });
  });
}
