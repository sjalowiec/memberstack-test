/**
 * Japanese-notation help for the finished hat pattern diagram tab.
 * Reuses the shared Vimeo walkthrough (same content as sweater shaping-notation help)
 * and opens it via the site-wide KinCatalogVideoModal already mounted on the page.
 */
import { SHAPING_NOTATION_CHART_HELP_VIMEO_ID } from "../../glossary/shapingNotationGlossary";

export const HAT_JAPANESE_NOTATION_HELP_VIMEO_ID = SHAPING_NOTATION_CHART_HELP_VIMEO_ID;

export const HAT_JAPANESE_NOTATION_HELP_LABEL = "How to Read Japanese Notation";

export const HAT_JAPANESE_NOTATION_HELP_VIDEO_TITLE = "How to Read Japanese Notation";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Compact KinCatalogVideoModal trigger for the Japanese Notation tab only.
 * General Japanese-notation wording — not sweater-specific.
 */
export function buildHatJapaneseNotationHelpHtml(): string {
  const label = escapeHtml(HAT_JAPANESE_NOTATION_HELP_LABEL);
  const title = escapeHtml(HAT_JAPANESE_NOTATION_HELP_VIDEO_TITLE);
  const vimeoId = escapeHtml(HAT_JAPANESE_NOTATION_HELP_VIMEO_ID);
  return (
    `<p class="hat-pattern-diagram-jp-help no-print" data-hat-japanese-notation-help>` +
    `<button type="button" class="kbm-kin-catalog-video hat-pattern-diagram-jp-help__btn"` +
    ` data-vimeo-id="${vimeoId}"` +
    ` data-video-title="${title}"` +
    ` data-testid="hat-japanese-notation-help"` +
    ` aria-haspopup="dialog">` +
    `<i class="fa-solid fa-play" aria-hidden="true"></i> ${label}` +
    `</button>` +
    `</p>`
  );
}
