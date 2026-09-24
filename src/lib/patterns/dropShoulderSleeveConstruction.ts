/**
 * Drop-shoulder sleeve construction (bottom-up vs top-down) — pattern-view preference only.
 * Not stored in builder data or saved project style; persisted per pattern in localStorage.
 */

import { buildPatternQuickTipInnerHtml } from "./patternQuickTip";
import { patternTipWrapperHtml } from "./sleevelessPatternOutput";

export type DropShoulderSleeveDirection = "cuff-up" | "top-down";

export const DROP_SHOULDER_SLEEVE_DIRECTION_DEFAULT: DropShoulderSleeveDirection = "cuff-up";

const STORAGE_NS = "kbm:drop-shoulder-sleeve-construction";

function sanitizeKeyPart(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/[^\w.-]/g, "_");
}

export function dropShoulderSleeveConstructionStorageKey(patternId: string): string {
  return `${STORAGE_NS}:${sanitizeKeyPart(patternId || "default")}`;
}

export function normalizeDropShoulderSleeveDirection(
  raw: unknown,
): DropShoulderSleeveDirection {
  return raw === "top-down" ? "top-down" : DROP_SHOULDER_SLEEVE_DIRECTION_DEFAULT;
}

/** Stored pattern-view choice, or null when the knitter has not changed it on the finished pattern. */
export function readStoredDropShoulderSleeveConstruction(
  patternId: string,
): DropShoulderSleeveDirection | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(dropShoulderSleeveConstructionStorageKey(patternId));
    if (raw == null || raw.trim() === "") return null;
    return normalizeDropShoulderSleeveDirection(raw);
  } catch {
    return null;
  }
}

export function readDropShoulderSleeveConstruction(patternId: string): DropShoulderSleeveDirection {
  return readStoredDropShoulderSleeveConstruction(patternId) ?? DROP_SHOULDER_SLEEVE_DIRECTION_DEFAULT;
}

export function writeDropShoulderSleeveConstruction(
  patternId: string,
  direction: DropShoulderSleeveDirection,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      dropShoulderSleeveConstructionStorageKey(patternId),
      normalizeDropShoulderSleeveDirection(direction),
    );
  } catch {
    /* quota / blocked */
  }
}

/** User-facing labels for the pattern-view toggle. */
export function dropShoulderSleeveConstructionLabel(direction: DropShoulderSleeveDirection): string {
  return direction === "top-down" ? "Top-down" : "Bottom-up";
}

export const DROP_SHOULDER_SLEEVE_CONSTRUCTION_CHOICE_TIP_ID = "drop-shoulder-sleeve-construction-choice";

const DROP_SHOULDER_SLEEVE_CONSTRUCTION_CHOICE_TIP_SUMMARY = "Sleeve construction choice";

/** Quick Tip body for the sleeve construction toggle (trusted HTML only). */
export function dropShoulderSleeveConstructionChoiceQuickTipBodyHtml(): string {
  return (
    '<div class="drop-shoulder-sleeve-construction-tip-body">' +
    '<div class="drop-shoulder-sleeve-construction-tip-body__columns">' +
    "<p><strong>Top-Down Sleeve:</strong> Knitted directly from the armhole and shaped toward the cuff. " +
    "Many knitters find this method easier because the sleeve is attached as it is knitted.</p>" +
    "<p><strong>Bottom-Up Sleeve:</strong> Knitted separately from the cuff upward, then joined to the body at the armhole. " +
    "This follows traditional machine knitting construction.</p>" +
    "</div>" +
    '<p class="drop-shoulder-sleeve-construction-tip-body__summary">Both methods produce the same finished sweater. Choose the method you are most comfortable knitting.</p>' +
    "</div>"
  );
}

/** Quick Tip inner markup for the sleeve construction toggle. */
export function dropShoulderSleeveConstructionChoiceQuickTipInnerHtml(): string {
  return buildPatternQuickTipInnerHtml({
    summaryLabel: DROP_SHOULDER_SLEEVE_CONSTRUCTION_CHOICE_TIP_SUMMARY,
    bodyHtml: dropShoulderSleeveConstructionChoiceQuickTipBodyHtml(),
  });
}

export const SIDEWAYS_SLEEVE_CONSTRUCTION_CUFF_UP_LABEL = "Cuff Up";
export const SIDEWAYS_SLEEVE_CONSTRUCTION_TOP_DOWN_LABEL = "Top Down";
export const SIDEWAYS_SLEEVE_CONSTRUCTION_CHOICE_TIP_ID = "sideways-sleeve-construction-choice";

/** Sideways copy inside the shared construction-choice tip chrome. */
export function sidewaysSleeveConstructionChoiceQuickTipBodyHtml(): string {
  return (
    '<div class="drop-shoulder-sleeve-construction-tip-body">' +
    '<div class="drop-shoulder-sleeve-construction-tip-body__columns">' +
    "<p><strong>Cuff Up:</strong> Begins at the cuff and increases toward the upper arm.</p>" +
    "<p><strong>Top Down:</strong> Begins at the upper arm and decreases toward the cuff.</p>" +
    "</div>" +
    '<p class="drop-shoulder-sleeve-construction-tip-body__summary">Either construction produces the same finished sleeve. Choose the method that is most comfortable.</p>' +
    "</div>"
  );
}

export function sidewaysSleeveConstructionChoiceQuickTipInnerHtml(): string {
  return buildPatternQuickTipInnerHtml({
    summaryLabel: DROP_SHOULDER_SLEEVE_CONSTRUCTION_CHOICE_TIP_SUMMARY,
    bodyHtml: sidewaysSleeveConstructionChoiceQuickTipBodyHtml(),
  });
}

export function renderSleeveConstructionChoiceHtml(options: {
  direction: DropShoulderSleeveDirection;
  cuffUpLabel?: string;
  topDownLabel?: string;
  tipInnerHtml?: string;
  tipId?: string;
}): string {
  const cuffUpActive = options.direction !== "top-down";
  const cuffUpLabel = options.cuffUpLabel ?? "Bottom-up";
  const topDownLabel = options.topDownLabel ?? "Top-down";
  const tipInnerHtml = options.tipInnerHtml ?? dropShoulderSleeveConstructionChoiceQuickTipInnerHtml();
  const tipId = options.tipId ?? DROP_SHOULDER_SLEEVE_CONSTRUCTION_CHOICE_TIP_ID;
  const constructionTipHtml = patternTipWrapperHtml({
    tipHtml: tipInnerHtml,
    tipHtmlIsFull: true,
    tipPresentation: "quick-tip",
    tipId,
  });
  return (
    `<div class="drop-shoulder-sleeve-construction-wrap no-print">` +
    `<div class="drop-shoulder-sleeve-construction" role="group" aria-label="Sleeve construction">` +
    `<span class="drop-shoulder-sleeve-construction__label">Sleeve construction</span>` +
    `<div class="sleeveless-back-diagram-mode drop-shoulder-sleeve-construction__options">` +
    `<button type="button" class="sleeveless-back-diagram-mode__btn${cuffUpActive ? " is-active" : ""}" data-drop-shoulder-sleeve-construction="cuff-up" aria-pressed="${cuffUpActive ? "true" : "false"}">${cuffUpLabel}</button>` +
    `<button type="button" class="sleeveless-back-diagram-mode__btn${!cuffUpActive ? " is-active" : ""}" data-drop-shoulder-sleeve-construction="top-down" aria-pressed="${!cuffUpActive ? "true" : "false"}">${topDownLabel}</button>` +
    `</div></div>` +
    constructionTipHtml +
    `</div>`
  );
}
