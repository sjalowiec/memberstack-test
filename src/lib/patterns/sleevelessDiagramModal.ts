/**
 * Helpers for sleeveless diagram enlarge modal (shaping notation print gate),
 * plus the shared enlarge modal / zoom binding reused by sweater and Socks diagrams.
 */

export type SleevelessDiagramViewMode = "sts-rows" | "shaping-notation";

const SHAPING_NOTATION_ARIA_RE = /shaping\s+notation/i;

function isDiagramHostElement(node: unknown): node is HTMLElement {
  return (
    node !== null &&
    typeof node === "object" &&
    "hasAttribute" in node &&
    typeof (node as HTMLElement).hasAttribute === "function"
  );
}

/** Diagram host inside a `[data-sleeveless-diagram-trigger]` enlarge control. */
export function getDiagramHostFromTrigger(triggerEl: HTMLElement): HTMLElement | null {
  const host = triggerEl.querySelector("[data-sleeveless-diagram]");
  return isDiagramHostElement(host) ? host : null;
}

function readModeAttribute(
  host: HTMLElement,
  attr: "data-sleeveless-back-diagram-mode" | "data-sleeveless-front-diagram-mode",
): SleevelessDiagramViewMode {
  const raw = host.getAttribute(attr) ?? "";
  return raw === "shaping-notation" ? "shaping-notation" : "sts-rows";
}

/** Active Stitches & Rows / Shaping Notation toggle in the diagram panel (live UI state). */
export function getDiagramModeFromPanel(panel: ParentNode | null): SleevelessDiagramViewMode | null {
  if (!panel) return null;
  const activeBtn = panel.querySelector(
    '[role="tab"][aria-selected="true"][data-sleeveless-back-diagram-mode-btn], ' +
      '[role="tab"][aria-selected="true"][data-sleeveless-front-diagram-mode-btn], ' +
      ".sleeveless-back-diagram-mode__btn.is-active[data-sleeveless-back-diagram-mode-btn], " +
      ".sleeveless-back-diagram-mode__btn.is-active[data-sleeveless-front-diagram-mode-btn]",
  );
  if (
    !activeBtn ||
    typeof activeBtn !== "object" ||
    !("getAttribute" in activeBtn) ||
    typeof (activeBtn as Element).getAttribute !== "function"
  ) {
    return null;
  }
  const mode =
    (activeBtn as Element).getAttribute("data-sleeveless-back-diagram-mode-btn") ??
    (activeBtn as Element).getAttribute("data-sleeveless-front-diagram-mode-btn");
  if (mode === "shaping-notation" || mode === "sts-rows") return mode;
  return null;
}

export function getDiagramModeFromHost(host: HTMLElement | null): SleevelessDiagramViewMode | null {
  if (!host) return null;
  if (host.hasAttribute("data-sleeveless-back-diagram")) {
    return readModeAttribute(host, "data-sleeveless-back-diagram-mode");
  }
  if (host.hasAttribute("data-sleeveless-front-diagram")) {
    return readModeAttribute(host, "data-sleeveless-front-diagram-mode");
  }
  return null;
}

/** Resolved mode: active panel toggle first, then host attribute (host can lag after toggle). */
export function resolveDiagramViewMode(
  host: HTMLElement | null,
  panel: ParentNode | null = host?.closest(".sleeveless-back-diagram-panel") ?? null,
): SleevelessDiagramViewMode | null {
  const fromPanel = getDiagramModeFromPanel(panel);
  if (fromPanel) return fromPanel;
  return getDiagramModeFromHost(host);
}

export function isShapingNotationDiagramHost(host: HTMLElement | null): boolean {
  return resolveDiagramViewMode(host) === "shaping-notation";
}

/** True when the inline SVG about to be enlarged is the shaping notation diagram. */
export function isDisplayedShapingNotationSvg(svg: Element | null): boolean {
  if (!svg) return false;
  const label = svg.getAttribute("aria-label") ?? "";
  return SHAPING_NOTATION_ARIA_RE.test(label);
}

/**
 * True when the enlarged diagram is back/front shaping notation (not Stitches & Rows).
 * Uses the displayed SVG first so a mode toggle is reflected before enlarge.
 */
export function shouldShowShapingNotationDiagramPrint(triggerEl: HTMLElement): boolean {
  const svg = triggerEl.querySelector(".sleeveless-piece-split__diagram-inline");
  if (svg) return isDisplayedShapingNotationSvg(svg);

  const host = getDiagramHostFromTrigger(triggerEl);
  if (!host) return false;
  if (!host.hasAttribute("data-sleeveless-back-diagram") && !host.hasAttribute("data-sleeveless-front-diagram")) {
    return false;
  }

  const panel = host.closest(".sleeveless-back-diagram-panel");
  return resolveDiagramViewMode(host, panel) === "shaping-notation";
}

export const SLEEVELESS_DIAGRAM_INLINE_CLASS = "sleeveless-piece-split__diagram-inline";

function printSleevelessShapingNotationDiagramModal(modal: HTMLElement): void {
  if (modal.dataset.sleevelessDiagramMode !== "shaping-notation") return;
  const content = modal.querySelector("[data-sleeveless-diagram-content]");
  const svg = content?.querySelector("svg");
  if (!(svg instanceof SVGElement)) return;

  const label = modal.getAttribute("aria-label") || "Shaping notation diagram";
  const printHtml = buildShapingNotationDiagramPrintDocument(svg.outerHTML, label);
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;

  printWindow.document.open();
  printWindow.document.write(printHtml);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 400);
}

/** Create (once) the shared enlarge modal used by sweater and Socks diagrams. */
export function ensureSleevelessDiagramModal(): HTMLElement {
  let modal = document.querySelector("[data-sleeveless-diagram-modal]");
  if (modal instanceof HTMLElement) return modal;

  modal = document.createElement("div");
  modal.className = "sleeveless-diagram-modal";
  modal.hidden = true;
  modal.setAttribute("data-sleeveless-diagram-modal", "");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Enlarged pattern diagram");
  modal.innerHTML = `
      <div class="sleeveless-diagram-modal__dialog" data-sleeveless-diagram-dialog>
        <div class="sleeveless-diagram-modal__actions no-print">
          <button
            type="button"
            class="sleeveless-diagram-modal__print kbm-btn kbm-btn-outline no-print"
            data-sleeveless-diagram-print
            hidden
            aria-label="Print shaping notation diagram"
          >Print</button>
          <button type="button" class="sleeveless-diagram-modal__close" data-sleeveless-diagram-close aria-label="Close enlarged diagram">X</button>
        </div>
        <div class="sleeveless-diagram-modal__content" data-sleeveless-diagram-content></div>
      </div>
    `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-sleeveless-diagram-print]")) {
      printSleevelessShapingNotationDiagramModal(modal);
      return;
    }
    if (target.closest("[data-sleeveless-diagram-close]")) {
      closeSleevelessDiagramModal();
      return;
    }
    const clickedInsideDialog = target.closest("[data-sleeveless-diagram-dialog]");
    const clickedSvg = target.closest("svg");
    if (!clickedInsideDialog || (clickedInsideDialog && !clickedSvg)) {
      closeSleevelessDiagramModal();
    }
  });

  return modal;
}

export function closeSleevelessDiagramModal(): void {
  const modal = document.querySelector("[data-sleeveless-diagram-modal]");
  if (!(modal instanceof HTMLElement)) return;
  const content = modal.querySelector("[data-sleeveless-diagram-content]");
  if (content instanceof HTMLElement) {
    content.innerHTML = "";
  }
  const printBtn = modal.querySelector("[data-sleeveless-diagram-print]");
  if (printBtn instanceof HTMLButtonElement) {
    printBtn.hidden = true;
  }
  delete modal.dataset.sleevelessDiagramMode;
  modal.hidden = true;
  document.body.classList.remove("sleeveless-diagram-modal-open");
}

/** Clone the currently displayed diagram SVG into the shared enlarge modal. */
export function openSleevelessDiagramModal(triggerEl: HTMLElement): void {
  const srcSvg =
    triggerEl.querySelector(`.${SLEEVELESS_DIAGRAM_INLINE_CLASS}`) ||
    triggerEl.querySelector("svg");
  if (!(srcSvg instanceof SVGElement)) return;

  const modal = ensureSleevelessDiagramModal();
  const content = modal.querySelector("[data-sleeveless-diagram-content]");
  if (!(content instanceof HTMLElement)) return;

  const showPrint = shouldShowShapingNotationDiagramPrint(triggerEl);
  const printBtn = modal.querySelector("[data-sleeveless-diagram-print]");
  if (printBtn instanceof HTMLButtonElement) {
    printBtn.hidden = !showPrint;
  }
  if (showPrint) {
    modal.dataset.sleevelessDiagramMode = "shaping-notation";
    const alt =
      triggerEl.querySelector("[data-sleeveless-diagram]")?.getAttribute("data-alt") ||
      "Shaping notation diagram";
    modal.setAttribute("aria-label", alt);
  } else {
    delete modal.dataset.sleevelessDiagramMode;
    modal.setAttribute("aria-label", "Enlarged pattern diagram");
  }

  content.innerHTML = "";
  const clone = srcSvg.cloneNode(true);
  if (clone instanceof SVGElement) {
    content.appendChild(clone);
    modal.hidden = false;
    document.body.classList.add("sleeveless-diagram-modal-open");
    const closeBtn = modal.querySelector("[data-sleeveless-diagram-close]");
    if (closeBtn instanceof HTMLElement) closeBtn.focus();
  }
}

/**
 * Magnifying-glass + diagram-click enlarge, plus Escape to close.
 * Same binding used by sweater (drop-shoulder / sleeveless) diagram tabs.
 */
export function bindSleevelessDiagramZoom(root: HTMLElement | null | undefined): void {
  if (!root || root.dataset.sleevelessDiagramZoomBound === "true") return;
  root.dataset.sleevelessDiagramZoomBound = "true";

  root.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const enlargeBtn = target.closest("[data-sleeveless-diagram-enlarge]");
    if (enlargeBtn instanceof HTMLElement) {
      e.preventDefault();
      const card = enlargeBtn.closest(".sleeveless-piece-split__diagram-card");
      const trigger = card?.querySelector("[data-sleeveless-diagram-trigger]");
      if (trigger instanceof HTMLElement) {
        openSleevelessDiagramModal(trigger);
      }
      return;
    }
    const trigger = target.closest("[data-sleeveless-diagram-trigger]");
    if (!(trigger instanceof HTMLElement)) return;
    openSleevelessDiagramModal(trigger);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSleevelessDiagramModal();
    }
  });
}

export function buildShapingNotationDiagramPrintDocument(
  svgMarkup: string,
  title = "Shaping notation diagram",
): string {
  const safeTitle = title.replace(/[<>&]/g, "");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      @page { margin: 0.5in; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: system-ui, sans-serif;
        color: #111827;
      }
      .print-diagram-root {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        width: 100%;
      }
      .print-diagram-root svg {
        display: block;
        max-width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>
    <div class="print-diagram-root">${svgMarkup}</div>
  </body>
</html>`;
}
