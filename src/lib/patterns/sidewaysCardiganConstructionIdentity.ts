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

/** Cuff-up and top-down numeric sleeve sequences are generated; sideways sleeves are not yet connected. */
export const SIDEWAYS_CARDIGAN_SLEEVE_DIRECTIONS = ["cuff-up", "top-down", "sideways"] as const;
export type SidewaysCardiganSleeveDirection =
  (typeof SIDEWAYS_CARDIGAN_SLEEVE_DIRECTIONS)[number];

export const SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_DEFAULT: SidewaysCardiganSleeveDirection =
  "cuff-up";

export const SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS: Record<
  SidewaysCardiganSleeveDirection,
  string
> = {
  "cuff-up": "Cuff up",
  "top-down": "Top down",
  sideways: "Sideways",
};

export function parseSidewaysCardiganSleeveDirection(
  value: unknown,
): SidewaysCardiganSleeveDirection | null {
  const raw = String(value ?? "").trim().toLowerCase();
  return (SIDEWAYS_CARDIGAN_SLEEVE_DIRECTIONS as readonly string[]).includes(raw)
    ? (raw as SidewaysCardiganSleeveDirection)
    : null;
}

/** Shared Drop Shoulder / Sleeveless garment-style storage: cardigan/pullover + open/closed. */
export const SIDEWAYS_CARDIGAN_GARMENT_STYLES = ["cardigan", "pullover"] as const;
export type SidewaysCardiganGarmentStyle =
  (typeof SIDEWAYS_CARDIGAN_GARMENT_STYLES)[number];

export const SIDEWAYS_CARDIGAN_GARMENT_STYLE_DEFAULT: SidewaysCardiganGarmentStyle =
  "cardigan";

export const SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS: Record<
  SidewaysCardiganGarmentStyle,
  string
> = {
  cardigan: "Cardigan",
  pullover: "Pullover",
};

export function parseSidewaysCardiganGarmentStyle(
  value: unknown,
): SidewaysCardiganGarmentStyle | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "cardigan" || raw === "open") return "cardigan";
  if (raw === "pullover" || raw === "closed") return "pullover";
  return null;
}

export function frontStyleForSidewaysCardiganGarmentStyle(
  garmentStyle: SidewaysCardiganGarmentStyle,
): "open" | "closed" {
  return garmentStyle === "cardigan" ? "open" : "closed";
}

export function resolveSidewaysCardiganGarmentStyle(
  style: Record<string, unknown> | undefined,
): SidewaysCardiganGarmentStyle {
  const st = section(style);
  return (
    parseSidewaysCardiganGarmentStyle(st.garmentStyle) ??
    parseSidewaysCardiganGarmentStyle(st.frontStyle) ??
    SIDEWAYS_CARDIGAN_GARMENT_STYLE_DEFAULT
  );
}

export const SIDEWAYS_CARDIGAN_STYLE_KEYS = [
  "construction",
  SIDEWAYS_CARDIGAN_CONSTRUCTION_AUTHORED_KEY,
  "sleeveDirection",
  "garmentStyle",
  "frontStyle",
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
  garmentStyle?: SidewaysCardiganGarmentStyle,
): Record<string, unknown> {
  const resolved =
    parseSidewaysCardiganGarmentStyle(garmentStyle) ??
    resolveSidewaysCardiganGarmentStyle(style);
  return {
    ...style,
    construction: SIDEWAYS_CARDIGAN_CONSTRUCTION,
    [SIDEWAYS_CARDIGAN_CONSTRUCTION_AUTHORED_KEY]: SIDEWAYS_CARDIGAN_CONSTRUCTION,
    garmentStyle: resolved,
    frontStyle: frontStyleForSidewaysCardiganGarmentStyle(resolved),
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

export function stampSidewaysCardiganWorkingDraftFromPage(overrides?: {
  sleeveDirection?: SidewaysCardiganSleeveDirection;
  garmentStyle?: SidewaysCardiganGarmentStyle;
}): void {
  if (readSidewaysCardiganBuilderPageConstruction() !== SIDEWAYS_CARDIGAN_CONSTRUCTION) return;
  try {
    const previous = {
      ...section(getCurrentPattern().style),
      ...section(getPatternData().style),
    };
    const sleeveDirection =
      parseSidewaysCardiganSleeveDirection(overrides?.sleeveDirection) ??
      parseSidewaysCardiganSleeveDirection(previous.sleeveDirection) ??
      SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_DEFAULT;
    const garmentStyle =
      parseSidewaysCardiganGarmentStyle(overrides?.garmentStyle) ??
      resolveSidewaysCardiganGarmentStyle(previous);
    const style = withSidewaysCardiganConstructionAuthored(
      previous,
      sleeveDirection,
      garmentStyle,
    );
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
