/**
 * Pattern-workspace calculation summary for the Sideways Cardigan.
 * Uses established print-summary-dl markup. No knitting instructions.
 */

import type { SidewaysCardiganBodyCalc } from "./sidewaysCardiganBodyCalc";
import type { SidewaysCardiganBodyCalcInput } from "./sidewaysCardiganBodyCalc";
import type { SidewaysCardiganSleeveCalc } from "./sidewaysCardiganSleeveCalc";
import {
  SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS,
  SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS,
  parseSidewaysCardiganSleeveDirection,
  resolveSidewaysCardiganGarmentStyle,
  type SidewaysCardiganGarmentStyle,
  type SidewaysCardiganSleeveDirection,
} from "./sidewaysCardiganConstructionIdentity";
import {
  formatBustAdjustmentMessage,
  formatInchesWithUnit,
  formatRowsCount,
  formatStitchesCount,
} from "./sidewaysCardiganDisplayFormat";
import { rowsToInches } from "./sleevelessRowAccounting";

export type SidewaysCardiganWorkspaceSummaryRow = {
  term: string;
  def: string;
};

export type SidewaysCardiganWorkspaceSummary = {
  rows: SidewaysCardiganWorkspaceSummaryRow[];
  adjustmentMessage: string | null;
};

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inchesAndStitches(inches: number, stitches: number): string {
  return `${formatInchesWithUnit(inches)} · ${formatStitchesCount(stitches)}`;
}

function inchesAndRows(inches: number, rows: number): string {
  return `${formatInchesWithUnit(inches)} · ${formatRowsCount(rows)}`;
}

/** Finished sleeve measurements shared by the workspace summary and the sleeve piece. */
export function sidewaysCardiganSleeveFinishedMeasurementPairs(
  calc: Pick<
    SidewaysCardiganSleeveCalc,
    "topSts" | "wristSts" | "sleeveTotalRows" | "finished"
  >,
): SidewaysCardiganWorkspaceSummaryRow[] {
  return [
    {
      term: "Upper arm",
      def: inchesAndStitches(calc.finished.upperArmInches, calc.topSts),
    },
    {
      term: "Sleeve length",
      def: inchesAndRows(calc.finished.sleeveLengthInches, calc.sleeveTotalRows),
    },
    {
      term: "Wrist/Cuff",
      def: inchesAndStitches(calc.finished.wristInches, calc.wristSts),
    },
  ];
}

export function buildSidewaysCardiganWorkspaceSummary(args: {
  calc: SidewaysCardiganBodyCalc;
  input: SidewaysCardiganBodyCalcInput;
  sleeveDirection?: string | SidewaysCardiganSleeveDirection;
  garmentStyle?: string | SidewaysCardiganGarmentStyle;
  sleeveCalc?: SidewaysCardiganSleeveCalc | null;
}): SidewaysCardiganWorkspaceSummary {
  const { calc, input } = args;
  const neckInches = input.neckOpeningWidthInches;
  const frontInches = rowsToInches(calc.frontRows, input.rowsPerInch) ?? 0;
  const backInches = rowsToInches(calc.backRows, input.rowsPerInch) ?? 0;
  const halfNeckInches = rowsToInches(calc.halfNeckRows, input.rowsPerInch) ?? 0;
  const shoulderInches =
    rowsToInches(calc.shoulders.firstFrontRows, input.rowsPerInch) ?? 0;
  const sleeve =
    parseSidewaysCardiganSleeveDirection(args.sleeveDirection) ?? "cuff-up";
  const garmentStyle = resolveSidewaysCardiganGarmentStyle({
    garmentStyle: args.garmentStyle,
  });
  const adjustmentMessage = formatBustAdjustmentMessage(
    calc.bust.adjustmentRows,
    calc.bust.adjustmentInches,
  );

  const rows: SidewaysCardiganWorkspaceSummaryRow[] = [
    {
      term: "Garment style",
      def: SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS[garmentStyle],
    },
    {
      term: "Garment length",
      def: inchesAndStitches(input.garmentLengthInches, calc.garmentLengthStitches),
    },
    {
      term: "V-neck depth",
      def: inchesAndStitches(input.vNeckDepthInches, calc.vNeckDepthStitches),
    },
    {
      term: "Armhole slit depth",
      def: inchesAndStitches(calc.armholeDepthInches, calc.armholeDepthStitches),
    },
    ...(calc.backNeckDepthStitches > 0
      ? [
          {
            term: "Back-neck depth",
            def: inchesAndStitches(calc.backNeckDepthInches, calc.backNeckDepthStitches),
          },
        ]
      : []),
    {
      term: "Requested finished bust",
      def: formatInchesWithUnit(calc.bust.requestedFinishedBustInches),
    },
    {
      term: "Actual finished bust",
      def: formatInchesWithUnit(calc.bust.actualFinishedBustInches),
    },
    {
      term: "Each front",
      def: inchesAndRows(frontInches, calc.frontRows),
    },
    {
      term: "Back",
      def: inchesAndRows(backInches, calc.backRows),
    },
    {
      term: "Neck-opening width",
      def: inchesAndRows(neckInches, calc.backNeckOpeningRows),
    },
    {
      term: "Each V-neck section",
      def: inchesAndRows(halfNeckInches, calc.halfNeckRows),
    },
    {
      term: "Each shoulder section",
      def: inchesAndRows(shoulderInches, calc.shoulders.firstFrontRows),
    },
    {
      term: "Total bust rows",
      def: formatRowsCount(calc.bust.actualTotalBustRows),
    },
    {
      term: "Sleeve direction",
      def: SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS[sleeve],
    },
    ...(args.sleeveCalc
      ? sidewaysCardiganSleeveFinishedMeasurementPairs(args.sleeveCalc)
      : []),
  ];

  return { rows, adjustmentMessage };
}

export function renderSidewaysCardiganWorkspaceSummaryHtml(
  summary: SidewaysCardiganWorkspaceSummary,
): string {
  const pairs = summary.rows
    .map(
      (row) =>
        `<div class="print-summary-dl__pair"><dt>${escapeHtml(row.term)}</dt><dd>${escapeHtml(row.def)}</dd></div>`,
    )
    .join("");
  return `<dl class="print-summary-dl print-summary-dl--inline">${pairs}</dl>`;
}
