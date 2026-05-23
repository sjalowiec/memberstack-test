/**
 * Single source of truth for sleeveless pullover vs cardigan routing
 * (generator, display merge, diagrams, review labels, debug).
 */
export type SleevelessGarmentKind = {
  garmentStyle: "pullover" | "cardigan";
  frontStyle: "closed" | "open";
  isCardigan: boolean;
  source: string;
};

export type ResolveSleevelessGarmentKindOptions = {
  wizardGarmentType?: unknown;
  canonicalStyle?: Record<string, unknown>;
  patternBuilderStyle?: Record<string, unknown>;
  expressValues?: Record<string, unknown>;
  mergedStyle?: Record<string, unknown>;
};

const CARDIGAN_KIND: SleevelessGarmentKind = {
  garmentStyle: "cardigan",
  frontStyle: "open",
  isCardigan: true,
  source: "cardigan",
};

const PULLOVER_KIND: SleevelessGarmentKind = {
  garmentStyle: "pullover",
  frontStyle: "closed",
  isCardigan: false,
  source: "pullover",
};

function normalizeWizardGarmentType(raw: unknown): "" | "pullover" | "cardigan" {
  const w = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (w === "cardigan" || w === "pullover") return w;
  return "";
}

function styleRecordIndicatesCardigan(style: Record<string, unknown> | undefined): boolean {
  if (!style) return false;
  const gs = String(style.garmentStyle ?? "")
    .trim()
    .toLowerCase();
  const fs = String(style.frontStyle ?? "")
    .trim()
    .toLowerCase();
  return gs === "cardigan" || fs === "open";
}

function expressValuesIndicateCardigan(values: Record<string, unknown> | undefined): boolean {
  if (!values) return false;
  const front = String(values.front ?? "")
    .trim()
    .toLowerCase();
  if (front === "open") return true;
  const styleKey = String(values.style ?? "")
    .trim()
    .toLowerCase();
  if (styleKey.includes("cardigan")) return true;
  const gs = String(values.garmentStyle ?? "")
    .trim()
    .toLowerCase();
  return gs === "cardigan";
}

function withSource(kind: SleevelessGarmentKind, source: string): SleevelessGarmentKind {
  return { ...kind, source };
}

export function resolveSleevelessGarmentKind(
  options: ResolveSleevelessGarmentKindOptions,
): SleevelessGarmentKind {
  const wizard = normalizeWizardGarmentType(options.wizardGarmentType);
  const canonical = options.canonicalStyle ?? {};
  const pb = options.patternBuilderStyle ?? {};
  const merged = options.mergedStyle ?? {};
  const express = options.expressValues ?? {};

  if (wizard === "cardigan") {
    return withSource(CARDIGAN_KIND, "wizard:cardigan");
  }
  if (wizard === "pullover") {
    if (expressValuesIndicateCardigan(express)) {
      logSleevelessGarmentKindStaleConflict({
        wizardGarmentType: wizard,
        expressValues: express,
        canonicalStyle: canonical,
        patternBuilderStyle: pb,
        mergedStyle: merged,
        resolved: PULLOVER_KIND,
      });
    }
    return withSource(PULLOVER_KIND, "wizard:pullover");
  }

  if (expressValuesIndicateCardigan(express)) {
    return withSource(CARDIGAN_KIND, "express:cardigan");
  }
  if (styleRecordIndicatesCardigan(pb)) {
    return withSource(CARDIGAN_KIND, "patternBuilder:cardigan");
  }
  if (styleRecordIndicatesCardigan(canonical)) {
    return withSource(CARDIGAN_KIND, "canonical:cardigan");
  }
  if (styleRecordIndicatesCardigan(merged)) {
    return withSource(CARDIGAN_KIND, "merged:cardigan");
  }

  return withSource(PULLOVER_KIND, "default:pullover");
}

/** Fields spread onto pattern `style` objects. */
export function sleevelessGarmentKindToStyleFields(
  kind: SleevelessGarmentKind,
): Pick<SleevelessGarmentKind, "garmentStyle" | "frontStyle"> {
  return { garmentStyle: kind.garmentStyle, frontStyle: kind.frontStyle };
}

export type SleevelessGarmentKindLogPayload = {
  wizardGarmentType: string;
  expressFront: string;
  expressStyle: string;
  expressGarmentStyle: string;
  canonicalGarmentStyle: string;
  canonicalFrontStyle: string;
  patternBuilderGarmentStyle: string;
  patternBuilderFrontStyle: string;
  mergedGarmentStyle: string;
  mergedFrontStyle: string;
  resolvedGarmentStyle: string;
  resolvedFrontStyle: string;
  resolvedIsCardigan: boolean;
  resolvedSource: string;
};

export function buildSleevelessGarmentKindLogPayload(
  options: ResolveSleevelessGarmentKindOptions,
  resolved: SleevelessGarmentKind,
): SleevelessGarmentKindLogPayload {
  const express = options.expressValues ?? {};
  const canonical = options.canonicalStyle ?? {};
  const pb = options.patternBuilderStyle ?? {};
  const merged = options.mergedStyle ?? {};
  return {
    wizardGarmentType: String(options.wizardGarmentType ?? "").trim(),
    expressFront: String(express.front ?? "").trim(),
    expressStyle: String(express.style ?? "").trim(),
    expressGarmentStyle: String(express.garmentStyle ?? "").trim(),
    canonicalGarmentStyle: String(canonical.garmentStyle ?? "").trim(),
    canonicalFrontStyle: String(canonical.frontStyle ?? "").trim(),
    patternBuilderGarmentStyle: String(pb.garmentStyle ?? "").trim(),
    patternBuilderFrontStyle: String(pb.frontStyle ?? "").trim(),
    mergedGarmentStyle: String(merged.garmentStyle ?? "").trim(),
    mergedFrontStyle: String(merged.frontStyle ?? "").trim(),
    resolvedGarmentStyle: resolved.garmentStyle,
    resolvedFrontStyle: resolved.frontStyle,
    resolvedIsCardigan: resolved.isCardigan,
    resolvedSource: resolved.source,
  };
}

export function logSleevelessGarmentKindResolution(
  options: ResolveSleevelessGarmentKindOptions,
  resolved: SleevelessGarmentKind,
): void {
  if (typeof console === "undefined" || typeof console.group !== "function") return;
  const payload = buildSleevelessGarmentKindLogPayload(options, resolved);
  console.group("[kbm sleeveless garment kind]");
  console.log(payload);
  console.groupEnd();
}

function logSleevelessGarmentKindStaleConflict(ctx: {
  wizardGarmentType: string;
  expressValues: Record<string, unknown>;
  canonicalStyle: Record<string, unknown>;
  patternBuilderStyle: Record<string, unknown>;
  mergedStyle: Record<string, unknown>;
  resolved: SleevelessGarmentKind;
}): void {
  if (typeof console === "undefined" || typeof console.warn !== "function") return;
  console.warn("[kbm sleeveless garment kind] stale-state conflict: wizard pullover vs express cardigan", {
    wizardGarmentType: ctx.wizardGarmentType,
    expressValues: ctx.expressValues,
    canonicalStyle: {
      garmentStyle: ctx.canonicalStyle.garmentStyle,
      frontStyle: ctx.canonicalStyle.frontStyle,
    },
    patternBuilderStyle: {
      garmentStyle: ctx.patternBuilderStyle.garmentStyle,
      frontStyle: ctx.patternBuilderStyle.frontStyle,
    },
    mergedStyle: {
      garmentStyle: ctx.mergedStyle.garmentStyle,
      frontStyle: ctx.mergedStyle.frontStyle,
    },
    resolved: ctx.resolved,
  });
}
