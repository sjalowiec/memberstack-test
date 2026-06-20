/**
 * Sync Express wizard selections + gauge/needles into `kbm_current_pattern` / `patternBuilderData`.
 * Used by the Express page, Change Pattern Choices, and review “Build My Pattern”.
 */
import {
  findExpressChartRow,
  getExpressUiUnit,
  nonEmptyTrimmed,
} from "./sleevelessExpressSizeChartClient";
import { seedCustomBuildBodyFinishedFromChartRow } from "./sleevelessCustomBuildBodyMeasurements";
import {
  EXPRESS_AVAILABLE_NEEDLES_INPUT_ID,
  resolveExpressAvailableNeedles,
} from "./sleevelessExpressAvailableNeedles";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import {
  expressWhoToChartAudience,
  mapExpressStyleKey,
  mapExpressNecklineToStorage,
} from "./syncSleevelessExpressDesignToStorage";
import { loadExpressPersisted, type ExpressPersistedV1 } from "./sleevelessExpressResume";
import {
  buildSizingIdentityFromExpressValues,
  detachActiveSavedProjectWhenChartAudienceDrifts,
} from "./savedCustomPatternSessionIdentity";

export const EXPRESS_GAUGE_STITCH_INPUT_ID = "express-stitch-gauge";
export const EXPRESS_GAUGE_ROW_INPUT_ID = "express-row-gauge";

function isValidPositiveNumber(v: string): boolean {
  if (v === "" || v === null || v === undefined) return false;
  const n = Number(v);
  return !Number.isNaN(n) && n > 0 && Number.isFinite(n);
}

export function rawSwatchToPerInch(
  stitchRaw: string,
  rowRaw: string,
  unit: "cm" | "in",
): { gaugeStitchesPerInch: string; gaugeRowsPerInch: string } {
  const s = parseFloat(String(stitchRaw).trim());
  const r = parseFloat(String(rowRaw).trim());
  let gaugeStitchesPerInch = "";
  let gaugeRowsPerInch = "";
  if (unit === "cm") {
    if (Number.isFinite(s) && s > 0) gaugeStitchesPerInch = String((s / 10) * 2.54);
    if (Number.isFinite(r) && r > 0) gaugeRowsPerInch = String((r / 10) * 2.54);
  } else {
    if (Number.isFinite(s) && s > 0) gaugeStitchesPerInch = String(s / 4);
    if (Number.isFinite(r) && r > 0) gaugeRowsPerInch = String(r / 4);
  }
  return { gaugeStitchesPerInch, gaugeRowsPerInch };
}

export type ExpressGaugeInputSnapshot = {
  gaugeStitchRaw: string;
  gaugeRowRaw: string;
  availableNeedles: string;
  unit: "in" | "cm";
};

/** Prefer live DOM inputs; fall back to Express builder localStorage snapshot. */
export function readExpressGaugeInputSnapshot(
  options: { preferDom?: boolean } = {},
): ExpressGaugeInputSnapshot {
  const preferDom = options.preferDom !== false;
  const persisted = loadExpressPersisted();
  const pb = getPatternData();
  const yarnG = section(pb.yarnGauge);
  const yarnM = section(pb.yarnGaugeMachine);

  let gaugeStitchRaw = "";
  let gaugeRowRaw = "";
  let availableNeedles = "";

  if (preferDom && typeof document !== "undefined") {
    const stEl = document.getElementById(EXPRESS_GAUGE_STITCH_INPUT_ID);
    const rwEl = document.getElementById(EXPRESS_GAUGE_ROW_INPUT_ID);
    const needlesEl = document.getElementById(EXPRESS_AVAILABLE_NEEDLES_INPUT_ID);
    if (stEl && typeof (stEl as HTMLInputElement).value === "string") {
      gaugeStitchRaw = (stEl as HTMLInputElement).value.trim();
    }
    if (rwEl && typeof (rwEl as HTMLInputElement).value === "string") {
      gaugeRowRaw = (rwEl as HTMLInputElement).value.trim();
    }
    if (needlesEl && typeof (needlesEl as HTMLInputElement).value === "string") {
      availableNeedles = (needlesEl as HTMLInputElement).value.trim();
    }
  }

  if (!gaugeStitchRaw) {
    gaugeStitchRaw =
      typeof persisted?.gaugeStitchRaw === "string"
        ? persisted.gaugeStitchRaw.trim()
        : String(yarnM.gaugeStitchRaw ?? yarnG.gaugeStitchRaw ?? "").trim();
  }
  if (!gaugeRowRaw) {
    gaugeRowRaw =
      typeof persisted?.gaugeRowRaw === "string"
        ? persisted.gaugeRowRaw.trim()
        : String(yarnM.gaugeRowRaw ?? yarnG.gaugeRowRaw ?? "").trim();
  }
  if (!availableNeedles) {
    availableNeedles =
      typeof persisted?.availableNeedles === "string"
        ? persisted.availableNeedles.trim()
        : "";
  }

  const unitStored = String(yarnM.gaugeRawUnit ?? yarnG.gaugeRawUnit ?? "").trim();
  let unit: "in" | "cm" = unitStored === "cm" ? "cm" : "in";
  if (unitStored !== "cm" && typeof document !== "undefined") {
    unit = getExpressUiUnit();
  }

  const prevMachine = section(pb.yarnGaugeMachine);
  if (!availableNeedles) {
    availableNeedles = resolveExpressAvailableNeedles(prevMachine, "");
  }

  return { gaugeStitchRaw, gaugeRowRaw, availableNeedles, unit };
}

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as Record<string, unknown>) : {};
}

/**
 * Gauge/needle fields for Express builder persistence.
 * DOM wins when non-empty; otherwise keep wizard snapshot, then canonical pattern data.
 */
export function resolveExpressGaugeFieldsForPersist(): Pick<
  ExpressPersistedV1,
  "gaugeStitchRaw" | "gaugeRowRaw" | "availableNeedles"
> {
  const prior = loadExpressPersisted();
  const pb = getPatternData();
  const yarnG = section(pb.yarnGauge);
  const yarnM = section(pb.yarnGaugeMachine);
  const yarnCanon = section(getCurrentPattern().yarnGauge);
  const machineCanon = section(getCurrentPattern().machine);

  let gaugeStitchRaw = "";
  let gaugeRowRaw = "";
  let needlesDom = "";

  if (typeof document !== "undefined") {
    const stEl = document.getElementById(EXPRESS_GAUGE_STITCH_INPUT_ID);
    const rwEl = document.getElementById(EXPRESS_GAUGE_ROW_INPUT_ID);
    const needlesEl = document.getElementById(EXPRESS_AVAILABLE_NEEDLES_INPUT_ID);
    if (stEl && typeof (stEl as HTMLInputElement).value === "string") {
      gaugeStitchRaw = (stEl as HTMLInputElement).value.trim();
    }
    if (rwEl && typeof (rwEl as HTMLInputElement).value === "string") {
      gaugeRowRaw = (rwEl as HTMLInputElement).value.trim();
    }
    if (needlesEl && typeof (needlesEl as HTMLInputElement).value === "string") {
      needlesDom = (needlesEl as HTMLInputElement).value.trim();
    }
  }

  if (!gaugeStitchRaw) {
    gaugeStitchRaw = String(
      prior?.gaugeStitchRaw ?? yarnM.gaugeStitchRaw ?? yarnG.gaugeStitchRaw ?? yarnCanon.gaugeStitchRaw ?? "",
    ).trim();
  }
  if (!gaugeRowRaw) {
    gaugeRowRaw = String(
      prior?.gaugeRowRaw ?? yarnM.gaugeRowRaw ?? yarnG.gaugeRowRaw ?? yarnCanon.gaugeRowRaw ?? "",
    ).trim();
  }

  const availableNeedles = resolveExpressAvailableNeedles(
    yarnM,
    needlesDom || String(prior?.availableNeedles ?? machineCanon.availableNeedles ?? "").trim(),
  );

  return { gaugeStitchRaw, gaugeRowRaw, availableNeedles };
}

/**
 * Simulates a gauge/needle edit: updates builder storage then syncs canonical pattern.
 * Used by tests and mirrors express-page `onGaugeInput` + `persistExpressSession`.
 */
export function applyExpressGaugeNeedleEdits(
  values: Record<string, string>,
  edits: { gaugeStitchRaw: string; gaugeRowRaw: string; availableNeedles: string },
  options: { preferDomGauge?: boolean } = {},
): void {
  const prior = loadExpressPersisted() ?? {};
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(
        SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
        JSON.stringify({
          ...prior,
          values: { ...(prior.values ?? {}), ...values },
          gaugeStitchRaw: edits.gaugeStitchRaw,
          gaugeRowRaw: edits.gaugeRowRaw,
          availableNeedles: edits.availableNeedles,
          editChoicesReopen: prior.editChoicesReopen ?? true,
        }),
      );
    } catch {
      /* ignore */
    }
  }
  syncExpressWizardToPatternStorage(values, null, {
    preferDomGauge: options.preferDomGauge ?? false,
  });
}

/**
 * Writes Express wizard `values` and gauge/needles into canonical pattern storage.
 * Call on gauge/needle input and before Build My Pattern / Generate Pattern.
 */
export function syncExpressWizardToPatternStorage(
  values: Record<string, string>,
  chartFit: { selectedSize: string; selectedMeasurements: Record<string, number> } | null = null,
  options: { preferDomGauge?: boolean } = {},
): void {
  const gaugeInputs = readExpressGaugeInputSnapshot({ preferDom: options.preferDomGauge !== false });
  const { gaugeStitchRaw, gaugeRowRaw, availableNeedles, unit } = gaugeInputs;

  const hasBothGauge = isValidPositiveNumber(gaugeStitchRaw) && isValidPositiveNumber(gaugeRowRaw);
  const { gaugeStitchesPerInch, gaugeRowsPerInch } = hasBothGauge
    ? rawSwatchToPerInch(gaugeStitchRaw, gaugeRowRaw, unit)
    : { gaugeStitchesPerInch: "", gaugeRowsPerInch: "" };

  const prevMachine = section(getPatternData().yarnGaugeMachine);
  const prevCanonMachine = section(getCurrentPattern().machine);
  const prevPbMachine = section(getPatternData().machine);
  const stylePayload: Record<string, string> = {};
  const fitPayload: Record<string, unknown> = {};
  const sm = mapExpressStyleKey(values.style ?? "");

  if (values.who) {
    const aud = expressWhoToChartAudience(values.who);
    stylePayload.recipientCategory = aud;
    fitPayload.sizingChart = aud;
  }
  if (values.style) {
    stylePayload.bodyShape = sm.bodyShape;
    stylePayload.frontStyle = sm.frontStyle;
    stylePayload.garmentStyle = sm.frontStyle === "open" ? "cardigan" : "pullover";
    stylePayload.length = "top";
    stylePayload.armholeStyle = "standard";
    stylePayload.patternMode = "express";
  }
  if (values.neckline) {
    stylePayload.neckline = mapExpressNecklineToStorage(values.neckline);
  }
  if (values.fit) {
    fitPayload.easeChoice = values.fit;
    fitPayload.fitChoice = values.fit;
  }
  if (chartFit) {
    fitPayload.selectedSize = chartFit.selectedSize;
    fitPayload.selectedMeasurements = chartFit.selectedMeasurements;
  } else if (nonEmptyTrimmed(values.selectedSize)) {
    fitPayload.selectedSize = values.selectedSize!.trim();
  }

  const yarnGaugeCanonical: Record<string, unknown> = {};
  if (hasBothGauge) {
    yarnGaugeCanonical.stitchGauge = gaugeStitchesPerInch;
    yarnGaugeCanonical.rowGauge = gaugeRowsPerInch;
    yarnGaugeCanonical.gaugeUnits = "per_inch";
    yarnGaugeCanonical.gaugeStitchRaw = gaugeStitchRaw;
    yarnGaugeCanonical.gaugeRowRaw = gaugeRowRaw;
    yarnGaugeCanonical.gaugeRawUnit = unit;
  } else if (gaugeStitchRaw || gaugeRowRaw) {
    yarnGaugeCanonical.gaugeStitchRaw = gaugeStitchRaw;
    yarnGaugeCanonical.gaugeRowRaw = gaugeRowRaw;
    yarnGaugeCanonical.gaugeRawUnit = unit;
  }

  const resolvedNeedles = resolveExpressAvailableNeedles(prevMachine, availableNeedles);

  const yarnMachinePayload: Record<string, unknown> = {
    yarnNotes: "",
    yarnWeight: "",
    availableNeedles: resolvedNeedles,
    gaugeStitchRaw,
    gaugeRowRaw,
    gaugeRawUnit: unit,
    gaugeStitchesPerInch,
    gaugeRowsPerInch,
  };

  const hasStyle = Object.keys(stylePayload).length > 0;
  const hasFit = Object.keys(fitPayload).length > 0;
  const hasYarn = Object.keys(yarnGaugeCanonical).length > 0;

  if (!hasStyle && !hasFit && !hasYarn && !availableNeedles) return;

  saveCurrentPattern({
    ...(hasStyle ? { style: stylePayload } : {}),
    ...(hasFit ? { fit: fitPayload } : {}),
    ...(hasYarn ? { yarnGauge: yarnGaugeCanonical } : {}),
    machine: { ...prevCanonMachine, availableNeedles: resolvedNeedles },
  });

  if (hasStyle) savePatternData("style", stylePayload);
  if (hasFit) savePatternData("fit", fitPayload);
  if (hasYarn) savePatternData("yarnGauge", yarnGaugeCanonical);
  savePatternData("machine", { ...prevPbMachine, availableNeedles: resolvedNeedles });
  if (hasYarn || gaugeStitchRaw || gaugeRowRaw || availableNeedles) {
    savePatternData("yarnGaugeMachine", { ...prevMachine, ...yarnMachinePayload });
  }

  if (chartFit && values.fit && values.who) {
    const aud = expressWhoToChartAudience(values.who);
    const row = findExpressChartRow(aud, chartFit.selectedSize);
    if (row) {
      seedCustomBuildBodyFinishedFromChartRow(row, values.fit, {
        preserveFinished: true,
        bodyShape: sm.bodyShape,
      });
    }
  }

  const sizingIdentity = buildSizingIdentityFromExpressValues(values);
  if (sizingIdentity) {
    detachActiveSavedProjectWhenChartAudienceDrifts(sizingIdentity);
  }
}

/** Read `values` from the Express builder snapshot. */
export function readExpressWizardValues(): Record<string, string> {
  const persisted = loadExpressPersisted();
  const v = persisted?.values;
  if (v && typeof v === "object" && !Array.isArray(v)) return { ...v };
  return {};
}
