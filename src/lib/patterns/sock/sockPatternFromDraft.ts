/**
 * Convert canonical `kbm_socks_draft` into Basic Socks Summary view data.
 * Presentation wiring only — calls {@link calculateBasicSockPattern}; does not duplicate math.
 */

import { formatSwatchCountForGaugeInput } from "../gaugeDisplayFormat";
import {
  BASIC_SOCK_PATTERN_NAME,
  type SockDraft,
  type SockDraftUnit,
} from "./sockDraft";
import { formatSockMeasurementDisplay } from "./sockBuilderUnits";
import {
  evaluateSockBuilderNeedleCapacity,
  isSockBuilderInputComplete,
  snapshotFromSockDraft,
  sockBuilderCalcInputFromFields,
  type SockBuilderFieldSnapshot,
} from "./sockBuilderValidation";
import {
  calculateBasicSockPattern,
  type BasicSockCalc,
} from "./sockMath";
import {
  findSockChartSize,
  sockSizeDisplayName,
  type SockSizingAdapter,
} from "./sockSizing";
import { validateSockNeedleCapacity } from "./sockAvailableNeedles";

export const SOCK_PATTERN_MISSING_DRAFT_MESSAGE =
  "Create a socks pattern first, then come back to review your summary.";

export const SOCK_PATTERN_INCOMPLETE_DRAFT_MESSAGE =
  "Your socks choices are incomplete. Return to the builder to finish size, measurements, construction, and gauge.";

export const SOCK_PATTERN_CALC_ERROR_MESSAGE =
  "We couldn't calculate this sock pattern from your saved choices. Return to the builder and try again.";

export const SOCK_STRAIGHT_LEG_STATUS = "Straight leg — no shaping required.";

export const SOCK_CONSTRUCTION_DIRECTION_LABELS = {
  "cuff-to-toe": "Cuff to Toe",
  "toe-up": "Toe Up",
} as const;

export type SockSummaryFailureReason = "missing" | "incomplete" | "calc-error" | "needles";

export type SockSummaryFailure = {
  ok: false;
  reason: SockSummaryFailureReason;
  message: string;
  errors?: string[];
};

export type SockSummaryView = {
  patternName: string;
  sizeLabel: string;
  constructionLabel: string;
  unitsLabel: string;
  unit: SockDraftUnit;
  footCircumference: string;
  footLength: string;
  legCircumference: string;
  legLength: string;
  stitchGauge: string;
  rowGauge: string;
  gaugeBasisLabel: string;
  gaugeLabel: string;
  totalSockStitches: number;
  legStitches: number;
  workingStitches: number;
  heldStitches: number;
  remainingStitches: number;
  /** One-way wrap-in rows (physical depth rows). Not in+out. */
  shortRowShapingRows: number;
  /** Wrap-out / return-to-work rows. Not used as physical depth. */
  returnToWorkRows: number;
  heelDepth: string;
  toeDepth: string;
  straightFootLength: string;
  straightFootRows: number;
  ankleStraightLength: string;
  ankleStraightRows: number;
  legRows: number;
  legShapingRowsAvailable: number;
  legShapingNeeded: boolean;
  legStitchChange: number;
  legShapingStatus: string;
  ankleStitches: number;
  topLegStitches: number;
  pairedShapingEvents: number;
  pairedEventLabel: string;
  magicFormulaSchedule: string;
  knitOrderSummary: string;
  requiredNeedles: number;
  availableNeedles: number;
  machineCapacityOk: boolean;
  machineCapacityMessage: string;
};

export type SockSummaryReady = {
  ok: true;
  draft: SockDraft;
  calc: BasicSockCalc;
  view: SockSummaryView;
};

export type SockSummaryResult = SockSummaryReady | SockSummaryFailure;

export function formatSockMeasurementWithUnit(
  inches: number,
  unit: SockDraftUnit,
): string {
  const n = formatSockMeasurementDisplay(inches, unit);
  if (!n) return "";
  return unit === "cm" ? `${n} cm` : `${n}"`;
}

export function formatSockEnteredMeasurement(
  raw: string,
  unit: SockDraftUnit,
): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  return unit === "cm" ? `${trimmed} cm` : `${trimmed}"`;
}

export function formatSockGaugeBasisLabel(unit: SockDraftUnit): string {
  return unit === "cm" ? "over 10 cm" : "over 4 inches";
}

export function formatSockSummaryGaugeLabel(
  stitchRaw: string,
  rowRaw: string,
  unit: SockDraftUnit,
): string {
  const stitch = Number(stitchRaw.trim());
  const row = Number(rowRaw.trim());
  const sts = formatSwatchCountForGaugeInput(stitch);
  const rows = formatSwatchCountForGaugeInput(row);
  if (!sts || !rows) return "";
  return `${sts} sts / ${rows} rows ${formatSockGaugeBasisLabel(unit)}`;
}

export function formatSockLegShapingStatus(
  calc: Pick<BasicSockCalc, "legShapingNeeded" | "legStitchChange">,
): string {
  if (!calc.legShapingNeeded || calc.legStitchChange === 0) {
    return SOCK_STRAIGHT_LEG_STATUS;
  }
  const n = Math.abs(calc.legStitchChange);
  const stitches = n === 1 ? "1 stitch" : `${n} stitches`;
  return calc.legStitchChange > 0
    ? `Leg is ${stitches} wider than the foot.`
    : `Leg is ${stitches} narrower than the foot.`;
}

export function formatSockMagicFormulaSchedule(
  steps: ReadonlyArray<{ rows: number; times: number }>,
  shapingRowsAvailable?: number,
): string {
  if (steps.length === 0) return "";
  const schedule = steps
    .map((step) => {
      const interval =
        step.rows <= 1
          ? "every row"
          : step.rows === 2
            ? "every other row"
            : `every ${step.rows} rows`;
      return `${step.times} × ${interval}`;
    })
    .join("; ");
  if (!(shapingRowsAvailable != null && shapingRowsAvailable > 0)) return schedule;
  return `${schedule} over ${shapingRowsAvailable} rows after the straight ankle`;
}

export function formatSockLegKnitOrderSummary(
  calc: Pick<BasicSockCalc, "constructionDirection" | "legShapingSchedule">,
): string {
  const schedule = calc.legShapingSchedule;
  if (!schedule || schedule.direction === "none") return "";
  const start = schedule.knitOrder.startStitches;
  const target = schedule.knitOrder.targetStitches;
  if (calc.constructionDirection === "cuff-to-toe") {
    return `Cuff to Toe knits from ${start} stitches at the cuff toward ${target} at the ankle.`;
  }
  return `Toe Up knits from ${start} stitches at the ankle toward ${target} at the cuff.`;
}

export function formatSockPairedEventLabel(
  direction: BasicSockCalc["legShapingSchedule"]["direction"],
): string {
  if (direction === "decrease") return "Paired decrease events";
  return "Paired increase events";
}

export function sockConstructionDisplayLabel(direction: string): string {
  if (direction === "cuff-to-toe" || direction === "toe-up") {
    return SOCK_CONSTRUCTION_DIRECTION_LABELS[direction];
  }
  return "";
}

function sizeDisplayLabel(draft: SockDraft, adapter: SockSizingAdapter): string {
  const row = findSockChartSize(adapter, draft.sizeSel);
  if (row) return sockSizeDisplayName(row);
  return draft.sizeSel.trim();
}

export function buildSockSummaryView(
  draft: SockDraft,
  calc: BasicSockCalc,
  adapter: SockSizingAdapter,
  fields: SockBuilderFieldSnapshot,
  capacity: { ok: boolean; requiredNeedles: number; availableNeedles: number; message: string },
): SockSummaryView {
  const unit: SockDraftUnit = draft.unit === "cm" ? "cm" : "inches";
  const stitchGauge = fields.stitchGauge.trim();
  const rowGauge = fields.rowGauge.trim();
  return {
    patternName: BASIC_SOCK_PATTERN_NAME,
    sizeLabel: sizeDisplayLabel(draft, adapter),
    constructionLabel: sockConstructionDisplayLabel(draft.constructionDirection),
    unitsLabel: unit === "cm" ? "Centimeters" : "Inches",
    unit,
    footCircumference: formatSockEnteredMeasurement(fields.footCircumference, unit),
    footLength: formatSockEnteredMeasurement(fields.footLength, unit),
    legCircumference: formatSockEnteredMeasurement(fields.legCircumference, unit),
    legLength: formatSockEnteredMeasurement(fields.legLength, unit),
    stitchGauge,
    rowGauge,
    gaugeBasisLabel: formatSockGaugeBasisLabel(unit),
    gaugeLabel: formatSockSummaryGaugeLabel(stitchGauge, rowGauge, unit),
    totalSockStitches: calc.totalSockStitches,
    legStitches: calc.legStitches,
    workingStitches: calc.heel.workingStitches,
    heldStitches: calc.heel.heldStitches,
    remainingStitches: calc.heel.remainingStitches,
    shortRowShapingRows: calc.heel.shortRowDepthRows,
    returnToWorkRows: calc.heel.shortRowOutSteps,
    heelDepth: formatSockMeasurementWithUnit(calc.heelDepthInches, unit),
    toeDepth: formatSockMeasurementWithUnit(calc.toeDepthInches, unit),
    straightFootLength: formatSockMeasurementWithUnit(calc.straightFootLengthInches, unit),
    straightFootRows: calc.straightFootRows,
    ankleStraightLength: formatSockMeasurementWithUnit(calc.ankleStraightLengthInches, unit),
    ankleStraightRows: calc.ankleStraightRows,
    legRows: calc.legRows,
    legShapingRowsAvailable: calc.legShapingRowsAvailable,
    legShapingNeeded: calc.legShapingNeeded,
    legStitchChange: calc.legStitchChange,
    legShapingStatus: formatSockLegShapingStatus(calc),
    ankleStitches: calc.ankleStitches,
    topLegStitches: calc.legStitches,
    pairedShapingEvents: calc.legShapingSchedule.pairedEventCount,
    pairedEventLabel: formatSockPairedEventLabel(calc.legShapingSchedule.direction),
    magicFormulaSchedule: formatSockMagicFormulaSchedule(
      calc.legShapingSchedule.steps,
      calc.legShapingRowsAvailable,
    ),
    knitOrderSummary: formatSockLegKnitOrderSummary(calc),
    requiredNeedles: capacity.requiredNeedles,
    availableNeedles: capacity.availableNeedles,
    machineCapacityOk: capacity.ok,
    machineCapacityMessage: capacity.message,
  };
}

/**
 * Build Summary data from a saved Socks draft.
 * Incomplete drafts do not receive chart-invented measurements.
 */
export function buildSockSummaryFromDraft(
  draft: SockDraft | null | undefined,
  adapter: SockSizingAdapter,
): SockSummaryResult {
  if (!draft) {
    return { ok: false, reason: "missing", message: SOCK_PATTERN_MISSING_DRAFT_MESSAGE };
  }

  const fields = snapshotFromSockDraft(draft);
  if (!isSockBuilderInputComplete(fields, adapter)) {
    return { ok: false, reason: "incomplete", message: SOCK_PATTERN_INCOMPLETE_DRAFT_MESSAGE };
  }

  const unit: SockDraftUnit = draft.unit === "cm" ? "cm" : "inches";
  const capacity = evaluateSockBuilderNeedleCapacity(fields, unit);
  if (!capacity.ok) {
    return {
      ok: false,
      reason: "needles",
      message: capacity.message || SOCK_PATTERN_INCOMPLETE_DRAFT_MESSAGE,
    };
  }

  const input = sockBuilderCalcInputFromFields(fields, unit);
  if (!input) {
    return { ok: false, reason: "incomplete", message: SOCK_PATTERN_INCOMPLETE_DRAFT_MESSAGE };
  }

  const result = calculateBasicSockPattern(input);
  if (!result.ok) {
    return {
      ok: false,
      reason: "calc-error",
      message: result.errors[0] ?? SOCK_PATTERN_CALC_ERROR_MESSAGE,
      errors: result.errors,
    };
  }

  return {
    ok: true,
    draft,
    calc: result.calc,
    view: buildSockSummaryView(draft, result.calc, adapter, fields, {
      ok: capacity.ok,
      requiredNeedles: capacity.requiredNeedles,
      availableNeedles: capacity.availableNeedles,
      message: capacity.message,
    }),
  };
}

/** Re-check capacity from a successful calc (same even-upped tube as math). */
export function sockSummaryCapacityFromCalc(
  calc: BasicSockCalc,
  availableNeedlesRaw: string,
): ReturnType<typeof validateSockNeedleCapacity> {
  return validateSockNeedleCapacity(availableNeedlesRaw, calc.totalSockStitches);
}
