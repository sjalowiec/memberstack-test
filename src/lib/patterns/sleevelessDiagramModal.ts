/**
 * Helpers for sleeveless diagram enlarge modal (shaping notation print gate).
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
