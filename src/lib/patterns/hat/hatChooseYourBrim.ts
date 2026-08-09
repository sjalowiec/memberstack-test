/**
 * Shared “Choose Your Brim” instructional block for all hat crown styles.
 * Clarifies brim finishes only — does not change cast-on, brim depth, or row math.
 * Rendered as a dismissable neutral pattern tip (never printed).
 */
import { buildGlossaryTooltipPlaceholderHtml } from "../../glossary/glossaryTooltipPrint";
import {
  HAT_PLANNING_RIBBING_TIP_TEXT,
  HAT_PLANNING_RIBBING_TIP_TITLE,
  buildHatPlanningRibbingVideoHtml,
} from "./hatPlanningRibbingVideoTip";

/** Stable pattern-tip id for dismiss / Show Tips restore. */
export const HAT_CHOOSE_YOUR_BRIM_TIP_ID = "hat-choose-your-brim";

/** @deprecated Prefer {@link HAT_CHOOSE_YOUR_BRIM_TIP_ID}; kept for older test references. */
export const HAT_CHOOSE_YOUR_BRIM_SECTION_ID = HAT_CHOOSE_YOUR_BRIM_TIP_ID;

export const HAT_CHOOSE_YOUR_BRIM_TITLE = "Choose Your Brim";

/** Glossary entry id for “Hung Hem” (`src/data/glossary.json`). */
export const HAT_HUNG_HEM_GLOSSARY_ID = 284;

export const HAT_HUNG_HEM_GLOSSARY_VISIBLE_TEXT = "hung hem";

export const HAT_HUNG_HEM_GLOSSARY_ARIA_LABEL = "Learn about hung hems";

/** Glossary entry id for “e-Wrap” (`src/data/glossary.json`). */
export const HAT_EWRAP_GLOSSARY_ID = 312;

/** Visible linked words only (sentence keeps “cast on” as plain text). */
export const HAT_EWRAP_GLOSSARY_VISIBLE_TEXT = "E-wrap";

export const HAT_EWRAP_GLOSSARY_ARIA_LABEL = "Learn about the e-wrap cast on";

export const HAT_ROLLED_EDGE_IMAGE_SRC = "/images/patterns/hat/rolled-brim-hat.png";

export const HAT_ROLLED_EDGE_IMAGE_ALT =
  "Pink machine-knit hat with a rolled stockinette edge and pompom";

export const HAT_ROLLED_EDGE_IMAGE_MODAL_TITLE = "Rolled-edge hat example";

export const HAT_ROLLED_EDGE_EXAMPLE_LABEL = "See a rolled-edge hat";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

export type BuildHatChooseYourBrimHtmlArgs = {
  /** Formatted finished brim depth (visible height), e.g. "2" or "5". */
  displayBrimDepth: string;
  /** Unit label for finished depth: "inches" or "cm". */
  unit: string;
  /** Calculated brim row count already allocated in finished hat length. */
  brimRows: number;
};

/**
 * Inline hung-hem glossary placeholder (entry 284). Hydrated to glossary tooltip/modal.
 */
export function buildHatHungHemGlossaryHtml(): string {
  return buildGlossaryTooltipPlaceholderHtml(
    HAT_HUNG_HEM_GLOSSARY_ID,
    HAT_HUNG_HEM_GLOSSARY_VISIBLE_TEXT,
    escapeAttr,
    escapeHtml,
    { ariaLabel: HAT_HUNG_HEM_GLOSSARY_ARIA_LABEL },
  );
}

/**
 * Inline e-wrap glossary placeholder (entry 312). Hydrated to glossary tooltip/modal.
 * Linked once on the rolled-edge line; later “E-wrap” mentions stay plain text.
 */
export function buildHatEwrapGlossaryHtml(): string {
  return buildGlossaryTooltipPlaceholderHtml(
    HAT_EWRAP_GLOSSARY_ID,
    HAT_EWRAP_GLOSSARY_VISIBLE_TEXT,
    escapeAttr,
    escapeHtml,
    { ariaLabel: HAT_EWRAP_GLOSSARY_ARIA_LABEL },
  );
}

/**
 * Thumbnail + label trigger for the rolled-edge example image modal.
 * Excluded from print via `no-print` / `pattern-tip-media-no-print`.
 */
export function buildHatRolledEdgeExampleHtml(): string {
  const src = escapeHtml(HAT_ROLLED_EDGE_IMAGE_SRC);
  const alt = escapeHtml(HAT_ROLLED_EDGE_IMAGE_ALT);
  const title = escapeHtml(HAT_ROLLED_EDGE_IMAGE_MODAL_TITLE);
  const label = escapeHtml(HAT_ROLLED_EDGE_EXAMPLE_LABEL);
  return (
    `<div class="hat-rolled-edge-example pattern-tip-media-no-print no-print" data-hat-rolled-edge-example>` +
    `<button type="button"` +
    ` class="kbm-kin-image-modal hat-rolled-edge-example__trigger"` +
    ` data-image-src="${src}"` +
    ` data-image-alt="${alt}"` +
    ` data-image-title="${title}"` +
    ` data-testid="hat-rolled-edge-example-open"` +
    ` aria-label="${label}">` +
    `<img class="hat-rolled-edge-example__thumb" src="${src}" alt="${alt}" loading="lazy" decoding="async" width="96" height="96" />` +
    `<span class="hat-rolled-edge-example__label">${label}</span>` +
    `</button>` +
    `</div>`
  );
}

/** Planning Ribbing copy + video control (no nested pattern-tip wrapper). */
export function buildHatChooseYourBrimPlanningHtml(): string {
  const videoHtml = buildHatPlanningRibbingVideoHtml();
  return (
    `<p class="hat-choose-your-brim-tip__planning" data-hat-planning-ribbing-brim-tip>` +
    `<strong>${escapeHtml(HAT_PLANNING_RIBBING_TIP_TITLE)}</strong> ` +
    `${escapeHtml(HAT_PLANNING_RIBBING_TIP_TEXT)} ` +
    `${videoHtml}` +
    `</p>`
  );
}

/**
 * Brim-choice body HTML (planning + finishes). Used inside the tip wrapper.
 */
export function buildHatChooseYourBrimBodyHtml(args: BuildHatChooseYourBrimHtmlArgs): string {
  const depth = escapeHtml(String(args.displayBrimDepth ?? "").trim());
  const unit = escapeHtml(String(args.unit ?? "").trim());
  const rows = Math.max(0, Math.round(Number(args.brimRows) || 0));
  const hungHemGlossaryHtml = buildHatHungHemGlossaryHtml();
  const ewrapGlossaryHtml = buildHatEwrapGlossaryHtml();
  const rolledExampleHtml = buildHatRolledEdgeExampleHtml();

  return (
    `${buildHatChooseYourBrimPlanningHtml()}` +
    `<p>Work the brim finish of your choice.</p>` +
    `<p><strong>Ribbing or mock ribbing:</strong> Work the calculated finished brim depth (${depth} ${unit}) using your preferred method. If you adjusted the cast-on stitch count so the ribbing meets neatly at the seam, increase or decrease back to the pattern stitch count after completing the brim.</p>` +
    `<p><strong>Hung hem:</strong> Work a ${hungHemGlossaryHtml} using the calculated finished brim depth (${depth} ${unit}). Follow your preferred hung-hem method, accounting for the rows needed for both layers of the hem.</p>` +
    `<p><strong>Rolled edge:</strong> ${ewrapGlossaryHtml} cast on and knit the calculated ${rows} brim rows in stockinette. The lower edge will roll naturally. Continue in stockinette for the body.</p>` +
    `${rolledExampleHtml}`
  );
}

/**
 * @deprecated Prefer {@link buildHatChooseYourBrimTipHtml}; body-only helper for tests.
 */
export function buildHatChooseYourBrimHtml(args: BuildHatChooseYourBrimHtmlArgs): string {
  return buildHatChooseYourBrimBodyHtml(args);
}

/**
 * Shared dismissable Choose Your Brim tip (neutral card; never prints).
 * Includes Planning Ribbing video, brim finishes, glossary links, and rolled-edge image.
 */
export function buildHatChooseYourBrimTipHtml(args: BuildHatChooseYourBrimHtmlArgs): string {
  const body = buildHatChooseYourBrimBodyHtml(args);
  return (
    `<div class="pattern-tip pattern-tip--neutral hat-choose-your-brim-tip pattern-print-personalization-never-print no-print"` +
    ` data-tip data-tip-id="${HAT_CHOOSE_YOUR_BRIM_TIP_ID}" data-hat-choose-your-brim-tip>` +
    `<h4 class="hat-choose-your-brim-tip__title">${escapeHtml(HAT_CHOOSE_YOUR_BRIM_TITLE)}</h4>` +
    `${body}` +
    `</div>`
  );
}
