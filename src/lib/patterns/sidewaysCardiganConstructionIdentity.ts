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
import {
  DROP_SHOULDER_SLEEVE_LENGTH_CHOICES,
  normalizeDropShoulderSleeveLengthChoice,
  type DropShoulderSleeveLengthChoice,
} from "./patternConstructionIdentity";

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

/** Same categorical sleeve-length choices as Drop Shoulder. Stored on `style.sleeveLength`. */
export const SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_CHOICES = DROP_SHOULDER_SLEEVE_LENGTH_CHOICES;
export type SidewaysCardiganSleeveLengthChoice = DropShoulderSleeveLengthChoice;

export const SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_DEFAULT: SidewaysCardiganSleeveLengthChoice =
  "long";

/** Customer-facing labels — match the Drop Shoulder picker. */
export const SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_LABELS: Record<
  SidewaysCardiganSleeveLengthChoice,
  string
> = {
  long: "Long",
  "three-quarter": "3/4",
  elbow: "Elbow",
  short: "Short",
};

export function parseSidewaysCardiganSleeveLengthChoice(
  value: unknown,
): SidewaysCardiganSleeveLengthChoice {
  return normalizeDropShoulderSleeveLengthChoice(value);
}

/** Saved picker value only — empty when the knitter has not chosen a sleeve length. */
export function readSavedSidewaysCardiganSleeveLengthChoice(
  value: unknown,
): SidewaysCardiganSleeveLengthChoice | "" {
  const raw = String(value ?? "").trim();
  return (SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_CHOICES as readonly string[]).includes(raw)
    ? (raw as SidewaysCardiganSleeveLengthChoice)
    : "";
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
  "sleeveLength",
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
  sleeveLength?: SidewaysCardiganSleeveLengthChoice,
): Record<string, unknown> {
  const resolved =
    parseSidewaysCardiganGarmentStyle(garmentStyle) ??
    resolveSidewaysCardiganGarmentStyle(style);
  const sleeveLengthChoice = parseSidewaysCardiganSleeveLengthChoice(
    sleeveLength ?? style.sleeveLength,
  );
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
    sleeveLength: sleeveLengthChoice,
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

export type SidewaysCardiganWorkingDraftStampOverrides = {
  sleeveDirection?: SidewaysCardiganSleeveDirection | "";
  garmentStyle?: SidewaysCardiganGarmentStyle;
  sleeveLength?: SidewaysCardiganSleeveLengthChoice | string;
};

/** Restore picker values only from a Sideways draft — not Drop Shoulder defaults such as `long`. */
function shouldRestoreSavedSidewaysCardiganSleeveSelections(
  style: Record<string, unknown>,
): boolean {
  return (
    String(style[SIDEWAYS_CARDIGAN_CONSTRUCTION_AUTHORED_KEY] ?? "") ===
      SIDEWAYS_CARDIGAN_CONSTRUCTION ||
    String(style.construction ?? "") === SIDEWAYS_CARDIGAN_CONSTRUCTION
  );
}

/**
 * Builder sleeve pickers start empty. Explicit empty overrides stay empty.
 * Saved Sideways drafts keep their stored direction and length.
 */
export function resolveSidewaysCardiganBuilderSleeveSelections(
  style: Record<string, unknown>,
  overrides?: SidewaysCardiganWorkingDraftStampOverrides,
): {
  sleeveDirection: SidewaysCardiganSleeveDirection | "";
  sleeveLengthChoice: SidewaysCardiganSleeveLengthChoice | "";
} {
  const restore = shouldRestoreSavedSidewaysCardiganSleeveSelections(style);
  const sleeveDirection =
    overrides && "sleeveDirection" in overrides
      ? parseSidewaysCardiganSleeveDirection(overrides.sleeveDirection) ?? ""
      : restore
        ? parseSidewaysCardiganSleeveDirection(style.sleeveDirection) ?? ""
        : "";
  const sleeveLengthChoice =
    overrides && "sleeveLength" in overrides
      ? readSavedSidewaysCardiganSleeveLengthChoice(overrides.sleeveLength)
      : restore
        ? readSavedSidewaysCardiganSleeveLengthChoice(style.sleeveLength)
        : "";
  return { sleeveDirection, sleeveLengthChoice };
}

/** Same working-draft write as the builder page stamp, without the page-construction guard. */
export function writeSidewaysCardiganWorkingDraftStamp(
  overrides?: SidewaysCardiganWorkingDraftStampOverrides,
): void {
  const previous = {
    ...section(getCurrentPattern().style),
    ...section(getPatternData().style),
  };
  const selections = resolveSidewaysCardiganBuilderSleeveSelections(previous, overrides);
  const garmentStyle =
    parseSidewaysCardiganGarmentStyle(overrides?.garmentStyle) ??
    resolveSidewaysCardiganGarmentStyle(previous);
  const style = withSidewaysCardiganConstructionAuthored(
    previous,
    selections.sleeveDirection || SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_DEFAULT,
    garmentStyle,
    selections.sleeveLengthChoice || undefined,
  );
  style.sleeveDirection = selections.sleeveDirection;
  style.sleeveLength = selections.sleeveLengthChoice;
  saveCurrentPattern({ style });
  savePatternData("style", style);
}

export function stampSidewaysCardiganWorkingDraftFromPage(
  overrides?: SidewaysCardiganWorkingDraftStampOverrides,
): void {
  if (readSidewaysCardiganBuilderPageConstruction() !== SIDEWAYS_CARDIGAN_CONSTRUCTION) return;
  try {
    writeSidewaysCardiganWorkingDraftStamp(overrides);
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
