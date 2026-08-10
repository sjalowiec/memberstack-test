/**
 * Shaping-notation help for the finished hat pattern diagram tab.
 * Reuses the shared Vimeo walkthrough (same content as sweater shaping-notation help)
 * and opens it via the site-wide KinCatalogVideoModal already mounted on the page.
 */
import { SHAPING_NOTATION_CHART_HELP_VIMEO_ID } from "../../glossary/shapingNotationGlossary";

export const HAT_SHAPING_NOTATION_HELP_VIMEO_ID = SHAPING_NOTATION_CHART_HELP_VIMEO_ID;

export const HAT_SHAPING_NOTATION_HELP_LABEL = "How to Read Shaping Notation";

export const HAT_SHAPING_NOTATION_HELP_VIDEO_TITLE = "How to Read Shaping Notation";

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
export function buildHatShapingNotationHelpHtml(): string {
  const label = escapeHtml(HAT_SHAPING_NOTATION_HELP_LABEL);
  const title = escapeHtml(HAT_SHAPING_NOTATION_HELP_VIDEO_TITLE);
  const vimeoId = escapeHtml(HAT_SHAPING_NOTATION_HELP_VIMEO_ID);
  return (
    `<p class="hat-pattern-diagram-shaping-help no-print" data-hat-shaping-notation-help>` +
    `<button type="button" class="kbm-kin-catalog-video hat-pattern-diagram-shaping-help__btn"` +
    ` data-vimeo-id="${vimeoId}"` +
    ` data-video-title="${title}"` +
    ` data-testid="hat-shaping-notation-help"` +
    ` aria-haspopup="dialog">` +
    `<i class="fa-solid fa-play" aria-hidden="true"></i> ${label}` +
    `</button>` +
    `</p>`
  );
}
