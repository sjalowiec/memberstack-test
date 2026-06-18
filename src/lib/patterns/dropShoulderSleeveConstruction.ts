/**
 * Drop-shoulder sleeve construction (bottom-up vs top-down) — pattern-view preference only.
 * Not stored in builder data or saved project style; persisted per pattern in localStorage.
 */

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
