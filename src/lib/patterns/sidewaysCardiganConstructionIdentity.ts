/**
 * Sideways Cardigan construction identity for the working draft and saved projects.
 *
 * Follows the Drop Shoulder authored-construction pattern so a bare `style.construction`
 * value is never trusted. Does not change Drop Shoulder or Sleeveless identity helpers.
 */

import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  type SleevelessPatternRecord,
} from "./patternStorage";

export const SIDEWAYS_CARDIGAN_CONSTRUCTION = "sideways-cardigan";
export const SIDEWAYS_CARDIGAN_CONSTRUCTION_AUTHORED_KEY = "constructionAuthored";
export const SIDEWAYS_CARDIGAN_CONSTRUCTION_FAMILY_OVERRIDE_KEY = "constructionFamily";

/** Future sleeve knitting directions — not generated in this task. */
export const SIDEWAYS_CARDIGAN_SLEEVE_DIRECTIONS = ["cuff-up", "top-down", "sideways"] as const;
export type SidewaysCardiganSleeveDirection =
  (typeof SIDEWAYS_CARDIGAN_SLEEVE_DIRECTIONS)[number];

export const SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_DEFAULT: SidewaysCardiganSleeveDirection =
  "cuff-up";

export const SIDEWAYS_CARDIGAN_STYLE_KEYS = [
  "construction",
  SIDEWAYS_CARDIGAN_CONSTRUCTION_AUTHORED_KEY,
  "sleeveDirection",
] as const;

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? { ...(obj as Record<string, unknown>) }
    : {};
}

export function readSidewaysCardiganBuilderPageConstruction(): string {
  if (typeof document === "undefined") return "";
  return (
    document
      .querySelector<HTMLElement>("[data-express-construction]")
      ?.getAttribute("data-express-construction")
      ?.trim() || ""
  );
}

export function withSidewaysCardiganConstructionAuthored(
  style: Record<string, unknown>,
  sleeveDirection: SidewaysCardiganSleeveDirection = SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_DEFAULT,
): Record<string, unknown> {
  return {
    ...style,
    construction: SIDEWAYS_CARDIGAN_CONSTRUCTION,
    [SIDEWAYS_CARDIGAN_CONSTRUCTION_AUTHORED_KEY]: SIDEWAYS_CARDIGAN_CONSTRUCTION,
    garmentStyle: "cardigan",
    frontStyle: "open",
    neckline: "v",
    bodyShape: "straight",
    length: "top",
    armholeStyle: "drop-shoulder",
    patternMode: "express",
    sleeveDirection,
  };
}

export function isSidewaysCardiganConstructionFamily(
  customOverrides: Record<string, unknown> | undefined,
): boolean {
  return (
    section(customOverrides)[SIDEWAYS_CARDIGAN_CONSTRUCTION_FAMILY_OVERRIDE_KEY] ===
    SIDEWAYS_CARDIGAN_CONSTRUCTION
  );
}

export function withSidewaysCardiganConstructionFamily(
  customOverrides: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return {
    ...section(customOverrides),
    [SIDEWAYS_CARDIGAN_CONSTRUCTION_FAMILY_OVERRIDE_KEY]: SIDEWAYS_CARDIGAN_CONSTRUCTION,
  };
}

export function hasAuthoritativeSidewaysCardiganConstruction(
  style: Record<string, unknown> | undefined,
  customOverrides?: Record<string, unknown>,
): boolean {
  const st = section(style);
  if (st.construction !== SIDEWAYS_CARDIGAN_CONSTRUCTION) return false;
  if (st[SIDEWAYS_CARDIGAN_CONSTRUCTION_AUTHORED_KEY] === SIDEWAYS_CARDIGAN_CONSTRUCTION) {
    return true;
  }
  return isSidewaysCardiganConstructionFamily(customOverrides);
}

export function stampSidewaysCardiganWorkingDraftFromPage(): void {
  if (readSidewaysCardiganBuilderPageConstruction() !== SIDEWAYS_CARDIGAN_CONSTRUCTION) return;
  try {
    const style = withSidewaysCardiganConstructionAuthored({
      ...section(getCurrentPattern().style),
      ...section(getPatternData().style),
    });
    saveCurrentPattern({ style });
    savePatternData("style", style);
  } catch {
    /* ignore */
  }
}

export function isActiveSidewaysCardiganConstruction(): boolean {
  try {
    const style = {
      ...section(getCurrentPattern().style),
      ...section(getPatternData().style),
    };
    return hasAuthoritativeSidewaysCardiganConstruction(style);
  } catch {
    return false;
  }
}

export function isSidewaysCardiganPatternRecord(
  pattern: SleevelessPatternRecord,
  customOverrides?: Record<string, unknown>,
): boolean {
  return hasAuthoritativeSidewaysCardiganConstruction(section(pattern.style), customOverrides);
}
