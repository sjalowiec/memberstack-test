/**
 * Drop-shoulder sleeve construction (bottom-up vs top-down) — pattern-view preference only.
 * Not stored in builder data or saved project style; persisted per pattern in localStorage.
 */

import { buildPatternQuickTipInnerHtml } from "./patternQuickTip";

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

export function readDropShoulderSleeveConstruction(patternId: string): DropShoulderSleeveDirection {
  if (typeof localStorage === "undefined") return DROP_SHOULDER_SLEEVE_DIRECTION_DEFAULT;
  try {
    return normalizeDropShoulderSleeveDirection(
      localStorage.getItem(dropShoulderSleeveConstructionStorageKey(patternId)),
    );
  } catch {
    return DROP_SHOULDER_SLEEVE_DIRECTION_DEFAULT;
  }
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
