/**
 * Set-in sleeve construction identity for the working draft and saved projects.
 *
 * Follows the Drop Shoulder authored-construction pattern so a bare `style.construction`
 * value is never trusted. Sleeves are cuff-up only. This file does not change Drop Shoulder
 * or Sleeveless identity helpers.
 */

import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  type SleevelessPatternRecord,
} from "./patternStorage";
import {
  CONSTRUCTION_AUTHORED_KEY,
  CONSTRUCTION_FAMILY_OVERRIDE_KEY,
  DROP_SHOULDER_SLEEVE_LENGTH_CHOICES,
  normalizeDropShoulderSleeveLengthChoice,
  type DropShoulderSleeveLengthChoice,
} from "./patternConstructionIdentity";

export const SET_IN_SLEEVE_CONSTRUCTION = "set-in-sleeve";

/** Permanent sleeve direction for this builder. Not a knitter-facing choice. */
export const SET_IN_SLEEVE_DIRECTION = "cuff-up" as const;

export const SET_IN_SLEEVE_LENGTH_CHOICES = DROP_SHOULDER_SLEEVE_LENGTH_CHOICES;
export type SetInSleeveLengthChoice = DropShoulderSleeveLengthChoice;

export function withSetInSleeveConstructionAuthored(
  style: Record<string, unknown>,
  sleeveLength?: unknown,
): Record<string, unknown> {
  return {
    ...style,
    construction: SET_IN_SLEEVE_CONSTRUCTION,
    [CONSTRUCTION_AUTHORED_KEY]: SET_IN_SLEEVE_CONSTRUCTION,
    sleeveLength: normalizeDropShoulderSleeveLengthChoice(sleeveLength ?? style.sleeveLength),
    sleeveDirection: SET_IN_SLEEVE_DIRECTION,
  };
}

export function isSetInSleeveConstructionFamily(
  customOverrides: Record<string, unknown> | undefined,
): boolean {
  return section(customOverrides)[CONSTRUCTION_FAMILY_OVERRIDE_KEY] === SET_IN_SLEEVE_CONSTRUCTION;
}

export function withSetInSleeveConstructionFamily(
  customOverrides: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return {
    ...section(customOverrides),
    [CONSTRUCTION_FAMILY_OVERRIDE_KEY]: SET_IN_SLEEVE_CONSTRUCTION,
  };
}

export function hasAuthoritativeSetInSleeveConstruction(
  style: Record<string, unknown> | undefined,
  customOverrides?: Record<string, unknown>,
): boolean {
  const st = section(style);
  if (st.construction !== SET_IN_SLEEVE_CONSTRUCTION) return false;
  if (st[CONSTRUCTION_AUTHORED_KEY] === SET_IN_SLEEVE_CONSTRUCTION) return true;
  return isSetInSleeveConstructionFamily(customOverrides);
}

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? { ...(obj as Record<string, unknown>) }
    : {};
}

export function readSetInSleeveBuilderPageConstruction(): string {
  if (typeof document === "undefined") return "";
  return (
    document
      .querySelector<HTMLElement>("[data-express-construction]")
      ?.getAttribute("data-express-construction")
      ?.trim() || ""
  );
}

export function isSetInSleeveWorkspaceMeasurementSummaryPage(doc?: Document): boolean {
  if (typeof document === "undefined" && doc === undefined) return false;
  const scope = doc ?? document;
  const measureRoot = scope.querySelector<HTMLElement>("[data-cb-measure-root]");
  if (measureRoot?.hasAttribute("data-set-in-sleeve-workspace-measure-summary")) return true;
  const pathname = scope.defaultView?.location?.pathname ?? "";
  return /\/patterns\/set-in-sleeve\/pattern(?:\/|$)/.test(pathname);
}

export function stampSetInSleeveWorkingDraftFromPage(sleeveLength?: unknown): void {
  if (readSetInSleeveBuilderPageConstruction() !== SET_IN_SLEEVE_CONSTRUCTION) return;
  try {
    const style = withSetInSleeveConstructionAuthored(
      {
        ...section(getCurrentPattern().style),
        ...section(getPatternData().style),
      },
      sleeveLength,
    );
    saveCurrentPattern({ style });
    savePatternData("style", style);
  } catch {
    /* ignore */
  }
}

export function isActiveSetInSleeveConstruction(): boolean {
  try {
    const style = {
      ...section(getCurrentPattern().style),
      ...section(getPatternData().style),
    };
    return hasAuthoritativeSetInSleeveConstruction(style);
  } catch {
    return false;
  }
}

export function isSetInSleevePatternRecord(
  pattern: SleevelessPatternRecord,
  customOverrides?: Record<string, unknown>,
): boolean {
  return hasAuthoritativeSetInSleeveConstruction(section(pattern.style), customOverrides);
}
