/**
 * Pattern-workspace calculation summary for the Sideways Cardigan.
 * Uses established print-summary-dl markup. No knitting instructions.
 */

import type { SidewaysCardiganBodyCalc } from "./sidewaysCardiganBodyCalc";
import type { SidewaysCardiganBodyCalcInput } from "./sidewaysCardiganBodyCalc";
import {
  SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS,
  parseSidewaysCardiganSleeveDirection,
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

export function buildSidewaysCardiganWorkspaceSummary(args: {
  calc: SidewaysCardiganBodyCalc;
  input: SidewaysCardiganBodyCalcInput;
  sleeveDirection?: string | SidewaysCardiganSleeveDirection;
}): SidewaysCardiganWorkspaceSummary {
  const { calc, input } = args;
  const neckInches = input.neckOpeningWidthInches;
  const shoulderInches =
    rowsToInches(calc.shoulders.firstFrontRows, input.rowsPerInch) ?? 0;
  const sleeve =
    parseSidewaysCardiganSleeveDirection(args.sleeveDirection) ?? "cuff-up";
  const adjustmentMessage = formatBustAdjustmentMessage(
    calc.bust.adjustmentRows,
    calc.bust.adjustmentInches,
  );

  const rows: SidewaysCardiganWorkspaceSummaryRow[] = [
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
      term: "Neck-opening width",
      def: inchesAndRows(neckInches, calc.neckOpeningRows),
    },
    {
      term: "Each shoulder section",
      def: inchesAndRows(shoulderInches, calc.shoulders.firstFrontRows),
    },
    {
      term: "Sleeve direction",
      def: SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS[sleeve],
    },
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
