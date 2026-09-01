/**
 * Shared "How to Read Shaping Notation" control for finished-pattern diagram tabs.
 * Presentation chrome only — same Vimeo walkthrough as sweater / hat shaping-notation help.
 * Opens via the site-wide KinCatalogVideoModal (`kbm-kin-catalog-video`).
 */
import { SHAPING_NOTATION_CHART_HELP_VIMEO_ID } from "../glossary/shapingNotationGlossary";

export const PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_LABEL = "How to Read Shaping Notation";

export const PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_VIMEO_ID =
  SHAPING_NOTATION_CHART_HELP_VIMEO_ID;

export const PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_CLASS = "pattern-diagram-shaping-help";

export const PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_BTN_CLASS =
  "pattern-diagram-shaping-help__btn";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Compact KinCatalogVideoModal trigger for the Shaping Notation tab only.
 */
export function buildPatternDiagramShapingNotationHelpHtml(): string {
  const label = escapeHtml(PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_LABEL);
  const vimeoId = escapeHtml(PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_VIMEO_ID);
  return (
    `<p class="${PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_CLASS} no-print" data-pattern-diagram-shaping-help>` +
    `<button type="button" class="kbm-btn kbm-btn-outline kbm-kin-catalog-video ${PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_BTN_CLASS}"` +
    ` data-vimeo-id="${vimeoId}"` +
    ` data-video-title="${label}"` +
    ` data-testid="pattern-diagram-shaping-notation-help"` +
    ` aria-haspopup="dialog">` +
    `<i class="fa-solid fa-circle-info" aria-hidden="true"></i>` +
    `<span>${label}</span>` +
    `</button>` +
    `</p>`
  );
}
