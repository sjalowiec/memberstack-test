/**
 * Drop-shoulder vs sleeveless construction identity for saved projects and the working draft.
 *
 * `style.construction` alone is not trusted — it is only honored when explicitly authored
 * (Drop Shoulder builder) or stamped on the saved project (`customOverrides.constructionFamily`).
 */
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  type SleevelessPatternRecord,
} from "./patternStorage";

export const DROP_SHOULDER_CONSTRUCTION = "drop-shoulder";
export const CONSTRUCTION_AUTHORED_KEY = "constructionAuthored";
export const CONSTRUCTION_FAMILY_OVERRIDE_KEY = "constructionFamily";

export const DROP_SHOULDER_STYLE_KEYS = [
  "construction",
  CONSTRUCTION_AUTHORED_KEY,
  "sleeveDirection",
  "sleeveLength",
] as const;

const DROP_SHOULDER_SLEEVE_DIRECTIONS = new Set(["cuff-up", "top-down"]);

/** Sleeve-length picker choices (Drop Shoulder builder + Edit Pattern drawer). */
export const DROP_SHOULDER_SLEEVE_LENGTH_CHOICES = [
  "long",
  "three-quarter",
  "elbow",
  "short",
] as const;

export type DropShoulderSleeveLengthChoice =
  (typeof DROP_SHOULDER_SLEEVE_LENGTH_CHOICES)[number];

/**
 * Fraction of the full (long) chart `sleeve_length` each picker choice knits.
 * The chart only stores the full length; shorter choices scale it proportionally.
 */
export const DROP_SHOULDER_SLEEVE_LENGTH_PROPORTIONS: Record<
  DropShoulderSleeveLengthChoice,
  number
> = {
  long: 1,
  "three-quarter": 0.75,
  elbow: 0.5,
  short: 0.33,
};

/** Coerce an unknown value to a valid sleeve-length choice (defaults to "long"). */
export function normalizeDropShoulderSleeveLengthChoice(
  value: unknown,
): DropShoulderSleeveLengthChoice {
  return DROP_SHOULDER_SLEEVE_LENGTH_CHOICES.includes(value as DropShoulderSleeveLengthChoice)
    ? (value as DropShoulderSleeveLengthChoice)
    : "long";
}

/** Sleeve-length picker choice from the working draft style (canonical wins over builder mirror). */
export function readDropShoulderSleeveLengthChoice(): unknown {
  try {
    const canonical = section(getCurrentPattern().style);
    const pb = section(getPatternData().style);
    return canonical.sleeveLength ?? pb.sleeveLength;
  } catch {
    return undefined;
  }
}

/** Proportion of the full sleeve length for a (possibly unknown) picker choice. */
export function dropShoulderSleeveLengthProportion(value: unknown): number {
  return DROP_SHOULDER_SLEEVE_LENGTH_PROPORTIONS[normalizeDropShoulderSleeveLengthChoice(value)];
}

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj) ? { ...(obj as Record<string, unknown>) } : {};
}

/** Removes drop-shoulder-only style keys (does not touch unrelated style fields). */
export function stripDropShoulderStyleFields(
  style: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const next = { ...section(style) };
  for (const key of DROP_SHOULDER_STYLE_KEYS) {
    delete next[key];
  }
  return next;
}

/** Drop Shoulder builder page marker (`data-express-construction` on the Express shell). */
export function readDropShoulderBuilderPageConstruction(): string {
  if (typeof document === "undefined") return "";
  return (
    document
      .querySelector<HTMLElement>("[data-express-construction]")
      ?.getAttribute("data-express-construction")
      ?.trim() || ""
  );
}

/** Drop Shoulder workspace measurement summary (Edit Pattern → Measurements). */
export function isDropShoulderWorkspaceMeasurementSummaryPage(doc?: Document): boolean {
  if (typeof document === "undefined" && doc === undefined) return false;
  const scope = doc ?? document;
  const measureRoot = scope.querySelector<HTMLElement>("[data-cb-measure-root]");
  if (measureRoot?.hasAttribute("data-drop-shoulder-workspace-measure-summary")) {
    return true;
  }
  const pathname = scope.defaultView?.location?.pathname ?? "";
  if (/\/patterns\/drop-shoulder\/pattern(?:\/|$)/.test(pathname)) {
    return true;
  }
  // Saved Drop Shoulder projects open on the sleeveless pattern workspace template.
  if (
    measureRoot?.hasAttribute("data-sleeveless-review-managed") &&
    isActiveDropShoulderConstruction()
  ) {
    return true;
  }
  return false;
}

/** @deprecated Use {@link isDropShoulderWorkspaceMeasurementSummaryPage}. */
export function isDropShoulderReviewPage(doc?: Document): boolean {
  return isDropShoulderWorkspaceMeasurementSummaryPage(doc);
}

/** Stamp drop-shoulder construction on the working draft when the active page is the Drop Shoulder builder. */
export function stampDropShoulderWorkingDraftFromPage(sleeveLength = "long"): void {
  if (readDropShoulderBuilderPageConstruction() !== DROP_SHOULDER_CONSTRUCTION) return;
  try {
    const style = withDropShoulderConstructionAuthored(
      { ...section(getCurrentPattern().style), ...section(getPatternData().style) },
      sleeveLength,
    );
    saveCurrentPattern({ style });
    savePatternData("style", style);
  } catch {
    /* ignore */
  }
}

/** Marks style as an intentional drop-shoulder construction (builder + save pipeline). */
export function withDropShoulderConstructionAuthored(
  style: Record<string, unknown>,
  sleeveLength: string,
): Record<string, unknown> {
  return {
    ...style,
    construction: DROP_SHOULDER_CONSTRUCTION,
    [CONSTRUCTION_AUTHORED_KEY]: DROP_SHOULDER_CONSTRUCTION,
    sleeveLength,
  };
}

export function isDropShoulderConstructionFamily(
  customOverrides: Record<string, unknown> | undefined,
): boolean {
  return section(customOverrides)[CONSTRUCTION_FAMILY_OVERRIDE_KEY] === DROP_SHOULDER_CONSTRUCTION;
}

export function withDropShoulderConstructionFamily(
  customOverrides: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return {
    ...section(customOverrides),
    [CONSTRUCTION_FAMILY_OVERRIDE_KEY]: DROP_SHOULDER_CONSTRUCTION,
  };
}

/** True when a saved project or draft intentionally represents drop-shoulder construction. */
export function hasAuthoritativeDropShoulderConstruction(
  style: Record<string, unknown> | undefined,
  customOverrides?: Record<string, unknown>,
): boolean {
  const st = section(style);
  if (st.construction !== DROP_SHOULDER_CONSTRUCTION) return false;
  if (st[CONSTRUCTION_AUTHORED_KEY] === DROP_SHOULDER_CONSTRUCTION) return true;
  if (isDropShoulderConstructionFamily(customOverrides)) return true;
  return false;
}

/** Bare `construction` without authored/family markers — legacy sleeveless corruption. */
export function isCorruptedSleevelessConstruction(
  pattern: SleevelessPatternRecord,
  customOverrides?: Record<string, unknown>,
): boolean {
  const style = section(pattern.style);
  if (style.construction !== DROP_SHOULDER_CONSTRUCTION) return false;
  return !hasAuthoritativeDropShoulderConstruction(style, customOverrides);
}

/** Strip accidental drop-shoulder style keys from a saved project before hydration. */
export function sanitizeSavedProjectForHydration(project: CustomPatternProject): CustomPatternProject {
  if (isCorruptedSleevelessConstruction(project.pattern, project.customOverrides)) {
    return {
      ...project,
      pattern: {
        ...project.pattern,
        style: stripDropShoulderStyleFields(project.pattern.style),
      },
    };
  }
  if (isDropShoulderConstructionFamily(project.customOverrides)) {
    const style = section(project.pattern.style);
    if (
      style.construction === DROP_SHOULDER_CONSTRUCTION &&
      style[CONSTRUCTION_AUTHORED_KEY] !== DROP_SHOULDER_CONSTRUCTION
    ) {
      return {
        ...project,
        pattern: {
          ...project.pattern,
          style: {
            ...style,
            [CONSTRUCTION_AUTHORED_KEY]: DROP_SHOULDER_CONSTRUCTION,
          },
        },
      };
    }
  }
  return project;
}

/** Active working draft — merged canonical + patternBuilderData style. */
export function isActiveDropShoulderConstruction(): boolean {
  try {
    const style = {
      ...section(getCurrentPattern().style),
      ...section(getPatternData().style),
    };
    return hasAuthoritativeDropShoulderConstruction(style);
  } catch {
    return false;
  }
}

/** Pattern record style only (saved blob / generator input). */
export function isDropShoulderPatternRecord(
  pattern: SleevelessPatternRecord,
  customOverrides?: Record<string, unknown>,
): boolean {
  return hasAuthoritativeDropShoulderConstruction(section(pattern.style), customOverrides);
}

/** Ensure save payloads do not persist accidental drop-shoulder keys on sleeveless projects. */
export function preparePatternRecordForSave(
  pattern: SleevelessPatternRecord,
  options: {
    customOverrides?: Record<string, unknown>;
    allowDropShoulder?: boolean;
  } = {},
): SleevelessPatternRecord {
  const style = section(pattern.style);
  if (style.construction !== DROP_SHOULDER_CONSTRUCTION) {
    return pattern;
  }
  if (
    options.allowDropShoulder &&
    hasAuthoritativeDropShoulderConstruction(style, options.customOverrides)
  ) {
    return pattern;
  }
  return {
    ...pattern,
    style: stripDropShoulderStyleFields(style),
  };
}
