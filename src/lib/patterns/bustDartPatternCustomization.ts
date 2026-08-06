/**
 * Post-build bust-dart customization for finished women’s sweater patterns.
 *
 * Builders never ask about darts. The finished pattern view imports a cup size into
 * `style.bustDart`, then regenerates front instructions via the shared Lego block.
 */
import { buildCustomBuildEffectivePatternInput } from "./buildCustomBuildEffectivePatternInput";
import { hasAuthoritativeDropShoulderConstruction } from "./patternConstructionIdentity";
import { resolveMeasurementDisplayUnitFromPatternData } from "./patternMeasurementDisplayUnit";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
} from "./patternStorage";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import {
  BUST_DART_STYLE_KEY,
  calculateBustDart,
  isBustDartEligibleAudience,
  normalizeBustDartConfigForAudience,
  normalizeBustDartSavedConfig,
  readBustDartConfigFromPatternData,
  type BustDartFrontConstruction,
  type BustDartInput,
  type BustDartResult,
  type BustDartSavedConfig,
} from "./legoBlocks/bustDart";
import {
  CUP_DART_BY_SIZE,
  formatDartCupOptionLabel,
  isDartCupSize,
  type DartCupSize,
  type DartFormulaUnit,
} from "../tools/dartFormulaMath";
import { runSaveCustomPatternFromWorkspace } from "./customPatternEditingBannerActions";
import { readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";

export type BustDartPatternContext = {
  eligible: boolean;
  sizeGroup: string;
  unit: DartFormulaUnit;
  frontConstruction: BustDartFrontConstruction;
  stitchesPerInch: number;
  rowsPerInch: number;
  /** Swatch counts for display (over 4″ or 10 cm). */
  stitchGaugeDisplay: number;
  rowGaugeDisplay: number;
  frontStitchCount: number;
  armholeOpeningGarmentRc: number;
  hemRows: number;
  bodyToArmholeRows: number;
  /** Current imported config (may be off). */
  config: BustDartSavedConfig;
  /** Human labels for the modal summary. */
  summary: {
    constructionLabel: string;
    garmentLabel: string;
    gaugeLabel: string;
    placementLabel: string;
    frontStitchesLabel: string;
  };
};

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

function pickAudience(patternData: Record<string, unknown>): string {
  const fit = section(patternData.fit);
  const style = section(patternData.style);
  return String(fit.sizingChart ?? fit.knitFor ?? style.recipientCategory ?? "").trim();
}

function isCardiganStyle(style: Record<string, unknown>): boolean {
  if (String(style.frontStyle ?? "").trim() === "open") return true;
  return String(style.garmentStyle ?? "").trim().toLowerCase() === "cardigan";
}

function toDisplayGauge(perInch: number, unit: DartFormulaUnit): number {
  if (!(perInch > 0)) return 0;
  return unit === "cm" ? (perInch * 10) / 2.54 : perInch * 4;
}

/**
 * Build prefill / validation context from the working pattern draft.
 * Uses the same generators as the pattern view so placement matches printed instructions.
 */
export function buildBustDartPatternContext(
  patternData: Record<string, unknown> = buildCustomBuildEffectivePatternInput(),
): BustDartPatternContext {
  const style = section(patternData.style);
  const sizeGroup = pickAudience(patternData);
  const eligible = isBustDartEligibleAudience(sizeGroup);
  const unit = resolveMeasurementDisplayUnitFromPatternData(
    getCurrentPattern(),
    getPatternData(),
  ) as DartFormulaUnit;
  const config = normalizeBustDartConfigForAudience(
    readBustDartConfigFromPatternData(patternData),
    sizeGroup,
  );
  const isDrop = hasAuthoritativeDropShoulderConstruction(style);
  const isCardigan = isCardiganStyle(style);
  const frontConstruction: BustDartFrontConstruction = isCardigan ? "cardigan" : "pullover";

  const empty = (partial: Partial<BustDartPatternContext> = {}): BustDartPatternContext => ({
    eligible,
    sizeGroup,
    unit,
    frontConstruction,
    stitchesPerInch: 0,
    rowsPerInch: 0,
    stitchGaugeDisplay: 0,
    rowGaugeDisplay: 0,
    frontStitchCount: 0,
    armholeOpeningGarmentRc: 0,
    hemRows: 0,
    bodyToArmholeRows: 0,
    config,
    summary: {
      constructionLabel: isDrop ? "Drop Shoulder" : "Sleeveless",
      garmentLabel: isCardigan ? "Cardigan" : "Pullover",
      gaugeLabel: "",
      placementLabel: "1″ below the armhole opening (front only)",
      frontStitchesLabel: "",
    },
    ...partial,
  });

  if (!eligible) {
    return empty();
  }

  const result = isDrop
    ? generateDropShoulderPattern(patternData)
    : generateSleevelessBackPattern(patternData);
  const debug = result.debug as Record<string, unknown>;
  const spi = Number(debug.stitchesPerInch) || 0;
  const rpi = Number(debug.rowsPerInch) || 0;
  const hemRows = Math.max(0, Math.floor(Number(debug.hemRows) || 0));
  const bodyToArmholeRows = Math.max(0, Math.floor(Number(debug.bodyRows) || 0));
  const armholeOpeningGarmentRc =
    Number(debug.armholeStartRow) > 0
      ? Math.floor(Number(debug.armholeStartRow))
      : Math.floor(Number(debug.rowsFromCastOnToArmholeStart) || hemRows + bodyToArmholeRows);

  let frontStitchCount = Math.floor(Number(debug.backStitches) || 0);
  if (isCardigan) {
    const half = Number(debug.cardiganHalfLeftBustBodySts);
    if (Number.isFinite(half) && half > 0) frontStitchCount = Math.floor(half);
    else if (frontStitchCount > 0) frontStitchCount = Math.ceil(frontStitchCount / 2);
  }

  const stitchGaugeDisplay = toDisplayGauge(spi, unit);
  const rowGaugeDisplay = toDisplayGauge(rpi, unit);
  const over = unit === "cm" ? "10 cm" : '4"';
  const gaugeLabel =
    stitchGaugeDisplay > 0 && rowGaugeDisplay > 0
      ? `${roundDisplay(stitchGaugeDisplay)} sts / ${roundDisplay(rowGaugeDisplay)} rows over ${over}`
      : "";

  return empty({
    stitchesPerInch: spi,
    rowsPerInch: rpi,
    stitchGaugeDisplay,
    rowGaugeDisplay,
    frontStitchCount,
    armholeOpeningGarmentRc,
    hemRows,
    bodyToArmholeRows,
    summary: {
      constructionLabel: isDrop ? "Drop Shoulder" : "Sleeveless",
      garmentLabel: isCardigan ? "Cardigan" : "Pullover",
      gaugeLabel,
      placementLabel: "1″ below the armhole opening (front only)",
      frontStitchesLabel:
        frontStitchCount > 0
          ? `${frontStitchCount} sts (${isCardigan ? "one front" : "full front"})`
          : "",
    },
  });
}

function roundDisplay(n: number): string {
  const r = Math.round(n * 100) / 100;
  return r === Math.floor(r) ? String(Math.floor(r)) : String(r);
}

export function previewBustDartForPattern(
  context: BustDartPatternContext,
  cupSize: string | null,
): BustDartResult {
  const input: BustDartInput = {
    enabled: true,
    cupSize,
    sizeGroup: context.sizeGroup,
    stitchesPerInch: context.stitchesPerInch,
    rowsPerInch: context.rowsPerInch,
    frontConstruction: context.frontConstruction,
    frontStitchCount: context.frontStitchCount,
    armholeOpeningGarmentRc: context.armholeOpeningGarmentRc,
    hemRows: context.hemRows,
    bodyToArmholeRows: context.bodyToArmholeRows,
  };
  return calculateBustDart(input);
}

/** Write imported dart config into the working draft (local storage). Does not cloud-save. */
export function writeBustDartConfigToWorkingDraft(config: BustDartSavedConfig): BustDartSavedConfig {
  const normalized = normalizeBustDartSavedConfig(config);
  // Audience eligibility is enforced at action visibility + calculateBustDart time.
  // Persist exactly the requested on/off + cup so reopen/print stay stable.
  const stored: BustDartSavedConfig = normalized.enabled
    ? { enabled: true, cupSize: normalized.cupSize }
    : { enabled: false, cupSize: null };
  saveCurrentPattern({ style: { [BUST_DART_STYLE_KEY]: stored } });
  savePatternData("style", { [BUST_DART_STYLE_KEY]: stored });
  return stored;
}

export function applyBustDartCupToWorkingDraft(cupSize: DartCupSize): BustDartSavedConfig {
  return writeBustDartConfigToWorkingDraft({ enabled: true, cupSize });
}

export function removeBustDartFromWorkingDraft(): BustDartSavedConfig {
  return writeBustDartConfigToWorkingDraft({ enabled: false, cupSize: null });
}

export type PersistBustDartCustomizationResult =
  | { ok: true; config: BustDartSavedConfig }
  | { ok: false; error: string };

/**
 * Apply or remove bust darts on the working draft, then update the active saved project when present.
 * Local draft write always succeeds first so reopen/print of the current session keeps the dart.
 */
export async function persistBustDartCustomization(
  config: BustDartSavedConfig,
): Promise<PersistBustDartCustomizationResult> {
  const written = writeBustDartConfigToWorkingDraft(config);
  const activeId = readActiveCustomPatternProjectId();
  if (!activeId) {
    // Unsaved working draft — pattern view already reads from local storage.
    return { ok: true, config: written };
  }
  const save = await runSaveCustomPatternFromWorkspace(undefined, {
    skipPreSavePrepare: true,
    activeProjectId: activeId,
  });
  if (!save.ok) {
    return { ok: false, error: save.error || "Could not update the saved pattern." };
  }
  return { ok: true, config: written };
}

export function bustDartCupOptions(unit: DartFormulaUnit): { value: DartCupSize; label: string }[] {
  return (Object.keys(CUP_DART_BY_SIZE) as DartCupSize[]).map((value) => ({
    value,
    label: formatDartCupOptionLabel(value, unit),
  }));
}

export function parseCupSizeInput(raw: unknown): DartCupSize | null {
  return isDartCupSize(raw) ? raw : null;
}

export function patternHasImportedBustDart(
  patternData: Record<string, unknown> = getPatternData(),
): boolean {
  const c = readBustDartConfigFromPatternData(patternData);
  return c.enabled === true && c.cupSize != null;
}

export function isPatternEligibleForBustDartAction(
  patternData: Record<string, unknown> = buildCustomBuildEffectivePatternInput(),
): boolean {
  return isBustDartEligibleAudience(pickAudience(patternData));
}

export { normalizeBustDartSavedConfig, readBustDartConfigFromPatternData, BUST_DART_STYLE_KEY };
