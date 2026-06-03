/**
 * Canonical garment style resolution and persistence for Custom Build Review → Pattern tab.
 * Summary/Review display, Build Pattern click, and generator input must use this module only.
 */
import {
  deriveExpressStyleKeyFromShapeFront,
  readExpressBuilderValues,
} from "./sleevelessGeneratorBodyShape";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";
import { readCustomBuildWizardGarmentType } from "./sleevelessCustomBuildWizardNeckline";

export type CustomBuildGarmentStyleFields = {
  garmentStyle: "pullover" | "cardigan";
  frontStyle: "open" | "closed";
};

export type GarmentStyleHandoffSources = {
  wizardGarmentType: string;
  canonicalStyle: Record<string, unknown>;
  patternBuilderStyle: Record<string, unknown>;
  expressValues: Record<string, string>;
};

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj as Record<string, unknown>;
  return {};
}

export function styleRecordIndicatesCardigan(style: Record<string, unknown>): boolean {
  const gs = String(style.garmentStyle ?? "")
    .trim()
    .toLowerCase();
  const fs = String(style.frontStyle ?? "")
    .trim()
    .toLowerCase();
  return gs === "cardigan" || fs === "open";
}

/** Express builder `values` signals used on Summary/Review (`garmentStyleLabel`). */
export function expressValuesIndicateCardigan(expressValues: Record<string, string>): boolean {
  const lsFront = String(expressValues.front ?? "").trim().toLowerCase();
  const styleKey = String(expressValues.style ?? "").trim().toLowerCase();
  return lsFront === "open" || styleKey.includes("cardigan");
}

/** Collect every garment signal the Review page and Pattern tab can read. */
export function collectGarmentStyleHandoffSources(): GarmentStyleHandoffSources {
  return {
    wizardGarmentType: readCustomBuildWizardGarmentType(),
    canonicalStyle: section(getCurrentPattern().style),
    patternBuilderStyle: section(getPatternData().style),
    expressValues: readExpressBuilderValues(),
  };
}

/** Same rule as Summary/Review `garmentStyleLabel` (canonical + express; not wizard ls alone). */
export function reviewSummaryIndicatesCardigan(sources: GarmentStyleHandoffSources): boolean {
  const style = sources.canonicalStyle;
  const pbGarment = String(style.garmentStyle ?? "")
    .trim()
    .toLowerCase();
  const pbOpen = String(style.frontStyle ?? "")
    .trim()
    .toLowerCase();
  const ev = sources.expressValues;
  const lsFront = String(ev.front ?? "").trim().toLowerCase();
  const styleKey = String(ev.style ?? "").trim().toLowerCase();
  return (
    pbGarment === "cardigan" ||
    pbOpen === "open" ||
    lsFront === "open" ||
    styleKey.includes("cardigan")
  );
}

export function anyHandoffSourceIndicatesCardigan(sources: GarmentStyleHandoffSources): boolean {
  return (
    sources.wizardGarmentType === "cardigan" ||
    styleRecordIndicatesCardigan(sources.canonicalStyle) ||
    styleRecordIndicatesCardigan(sources.patternBuilderStyle) ||
    expressValuesIndicateCardigan(sources.expressValues)
  );
}

/**
 * Resolve garment for handoff. Wizard `cardigan` wins; empty/missing wizard never demotes cardigan.
 * Canonical `garmentStyle` wins over stale patternBuilderData / express defaults.
 */
export function resolveSleevelessGarmentStyleForHandoff(
  canonicalStyle: Record<string, unknown>,
  patternBuilderStyle: Record<string, unknown>,
  expressValues: Record<string, string>,
  wizardGarmentType?: string,
): CustomBuildGarmentStyleFields {
  const wizard = String(wizardGarmentType ?? "")
    .trim()
    .toLowerCase();
  if (wizard === "cardigan") return { garmentStyle: "cardigan", frontStyle: "open" };
  if (styleRecordIndicatesCardigan(canonicalStyle)) {
    return { garmentStyle: "cardigan", frontStyle: "open" };
  }
  if (styleRecordIndicatesCardigan(patternBuilderStyle)) {
    return { garmentStyle: "cardigan", frontStyle: "open" };
  }
  if (expressValuesIndicateCardigan(expressValues)) {
    return { garmentStyle: "cardigan", frontStyle: "open" };
  }
  if (wizard === "pullover") return { garmentStyle: "pullover", frontStyle: "closed" };
  return { garmentStyle: "pullover", frontStyle: "closed" };
}

export function warnGarmentStyleHandoffMismatch(
  sources: GarmentStyleHandoffSources,
  resolved: CustomBuildGarmentStyleFields,
  context: string,
): void {
  if (typeof console === "undefined" || typeof console.warn !== "function") return;
  const reviewCardigan = reviewSummaryIndicatesCardigan(sources);
  const anyCardigan = anyHandoffSourceIndicatesCardigan(sources);
  if ((reviewCardigan || anyCardigan) && resolved.garmentStyle === "pullover") {
    console.warn(
      `[sleeveless review→pattern] WARNING ${context}: source(s) indicate cardigan but resolved pullover`,
      {
        reviewSummaryCardigan: reviewCardigan,
        anySourceCardigan: anyCardigan,
        resolved,
        sources: formatGarmentHandoffSourcesForDebug(sources),
      },
    );
  }
}

export type GarmentHandoffResolvedFrom =
  | "wizard"
  | "canonical"
  | "patternBuilder"
  | "express"
  | "lock"
  | "default";

/** Temporary trace at each Review → Pattern handoff stage (remove when stable). */
export function logGarmentStyleHandoffAtStage(
  stageName: string,
  incoming: {
    garmentStyle?: string;
    frontStyle?: string;
    patternMode?: string;
  },
  outgoing: CustomBuildGarmentStyleFields,
  resolvedFrom: GarmentHandoffResolvedFrom,
  extra?: Record<string, unknown>,
): void {
  if (typeof console === "undefined" || typeof console.log !== "function") return;
  const sources = collectGarmentStyleHandoffSources();
  console.log(`[sleeveless review→pattern] handoff stage: ${stageName}`, {
    incomingGarmentStyle: incoming.garmentStyle ?? "(missing)",
    incomingFrontStyle: incoming.frontStyle ?? "(missing)",
    incomingPatternMode: incoming.patternMode ?? "(missing)",
    outgoingGarmentStyle: outgoing.garmentStyle,
    outgoingFrontStyle: outgoing.frontStyle,
    resolvedFrom,
    ...formatGarmentHandoffSourcesForDebug(sources),
    ...extra,
  });
}

/** Which source won for the current storage snapshot (for debug only). */
export function describeGarmentHandoffResolutionSource(
  canonicalStyle: Record<string, unknown>,
  patternBuilderStyle: Record<string, unknown>,
  expressValues: Record<string, string>,
  wizardGarmentType?: string,
  lockGarmentStyle?: "pullover" | "cardigan",
): GarmentHandoffResolvedFrom {
  if (lockGarmentStyle === "cardigan" || lockGarmentStyle === "pullover") return "lock";
  const wizard = String(wizardGarmentType ?? "")
    .trim()
    .toLowerCase();
  if (wizard === "cardigan") return "wizard";
  if (styleRecordIndicatesCardigan(canonicalStyle)) return "canonical";
  if (styleRecordIndicatesCardigan(patternBuilderStyle)) return "patternBuilder";
  if (expressValuesIndicateCardigan(expressValues)) return "express";
  if (wizard === "pullover") return "wizard";
  return "default";
}

export function formatGarmentHandoffSourcesForDebug(sources: GarmentStyleHandoffSources): Record<string, unknown> {
  return {
    wizardGarmentType: sources.wizardGarmentType || "(missing)",
    canonicalGarmentStyle: sources.canonicalStyle.garmentStyle,
    canonicalFrontStyle: sources.canonicalStyle.frontStyle,
    patternBuilderGarmentStyle: sources.patternBuilderStyle.garmentStyle,
    patternBuilderFrontStyle: sources.patternBuilderStyle.frontStyle,
    expressFront: sources.expressValues.front,
    expressStyle: sources.expressValues.style,
    reviewSummaryIndicatesCardigan: reviewSummaryIndicatesCardigan(sources),
    anySourceIndicatesCardigan: anyHandoffSourceIndicatesCardigan(sources),
  };
}

export type GarmentHandoffPersistResult = {
  resolved: CustomBuildGarmentStyleFields;
  storageKeysWritten: string[];
};

function patchExpressBuilderGarmentValues(
  garment: CustomBuildGarmentStyleFields,
  bodyShapeRaw: unknown,
): void {
  if (typeof localStorage === "undefined") return;
  const shapeRaw = String(bodyShapeRaw ?? "straight").trim().toLowerCase();
  const shape = shapeRaw === "aline" || shapeRaw === "shaped" ? "aline" : "straight";
  const front = garment.frontStyle;
  const styleKey = deriveExpressStyleKeyFromShapeFront(shape, front);
  if (!styleKey) return;
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    let prev: Record<string, unknown> = {};
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) prev = p as Record<string, unknown>;
    }
    const oldVals =
      prev.values && typeof prev.values === "object" && !Array.isArray(prev.values)
        ? { ...(prev.values as Record<string, string>) }
        : {};
    const values = { ...oldVals, shape, front, style: styleKey };
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({ ...prev, values }),
    );
  } catch {
    /* quota */
  }
}

/**
 * Final synchronous write of garment style to every store the Pattern tab reads.
 * Call last on Build Pattern click, before navigation.
 */
export function persistSleevelessGarmentStyleHandoff(
  garment: CustomBuildGarmentStyleFields,
  sources: GarmentStyleHandoffSources,
  label: string,
): GarmentHandoffPersistResult {
  const storageKeysWritten: string[] = [];

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType, garment.garmentStyle);
      storageKeysWritten.push(`localStorage:${CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType}`);
    } catch {
      /* quota */
    }
  }

  const bodyShape =
    sources.canonicalStyle.bodyShape ?? sources.patternBuilderStyle.bodyShape ?? "straight";
  patchExpressBuilderGarmentValues(garment, bodyShape);
  storageKeysWritten.push(`localStorage:${SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY}.values.front`);
  storageKeysWritten.push(`localStorage:${SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY}.values.style`);

  const canonStyle = section(getCurrentPattern().style);
  const pbStyle = section(getPatternData().style);
  const styleFields = {
    garmentStyle: garment.garmentStyle,
    frontStyle: garment.frontStyle,
  };

  saveCurrentPattern({
    style: {
      ...canonStyle,
      ...styleFields,
      patternMode: "custom-build",
    },
  });
  storageKeysWritten.push("kbm_current_pattern.style.garmentStyle");
  storageKeysWritten.push("kbm_current_pattern.style.frontStyle");

  savePatternData("style", {
    ...pbStyle,
    ...styleFields,
    patternMode: "custom-build",
  });
  storageKeysWritten.push("patternBuilderData.style.garmentStyle");
  storageKeysWritten.push("patternBuilderData.style.frontStyle");

  warnGarmentStyleHandoffMismatch(sources, garment, label);

  logGarmentStyleHandoffAtStage(
    `persistSleevelessGarmentStyleHandoff (${label})`,
    {
      garmentStyle: String(sources.canonicalStyle.garmentStyle ?? sources.patternBuilderStyle.garmentStyle ?? ""),
      frontStyle: String(sources.canonicalStyle.frontStyle ?? sources.patternBuilderStyle.frontStyle ?? ""),
      patternMode: String(sources.canonicalStyle.patternMode ?? sources.patternBuilderStyle.patternMode ?? ""),
    },
    garment,
    describeGarmentHandoffResolutionSource(
      sources.canonicalStyle,
      sources.patternBuilderStyle,
      sources.expressValues,
      sources.wizardGarmentType,
    ),
    { storageKeysWritten },
  );

  return { resolved: garment, storageKeysWritten };
}
