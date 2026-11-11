/**
 * Instructions-only neckline and shoulder prose for Set-In Sleeve.
 * Built from the same checklist rows the on-screen chart renders.
 * The chart stays on screen and in Charts / Complete pattern.
 */

import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
  buildHeldSideInstructionTableRows,
  buildSecondShoulderInstructionTableRows,
  isCenterNecklineSetupChecklistRow,
  type ActiveSideInstructionTableRow,
} from "./neckShoulderActiveSideChecklist";
import { CARDIGAN_FRONT_OPPOSITE_FRONT_SENTENCE } from "./neckShoulderActiveIntroCopy";
import {
  isSleevelessCardiganFrontNeckShoulderChart,
  NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
  usesVNeckHeldSideChecklist,
  type NeckShoulderShapingChart,
} from "./neckShoulderShapingChart";
import {
  compactActiveSideInstructionRowsForPrint,
  SET_IN_HELD_NECKLINE_FINISH_SENTENCE,
} from "./neckShoulderShapingChartHtml";
import { isPatternPrintChecklistPointer } from "./patternPrintWrittenShaping";
import {
  formatRcColon,
  formatShoulderBindoffRemainingInstruction,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";

export { SET_IN_HELD_NECKLINE_FINISH_SENTENCE };

export type SetInNecklinePrintShapingOptions = {
  /** Passed to the checklist builder. The row-counter start is always computed with the center row included. */
  includeCenterNecklineSetupRow: boolean;
  hideCenterNecklineSetupRow: boolean;
  resetRowCounterForSecondShoulder: boolean;
  finishHeldNecklineAfterSecondShoulder: boolean;
  /** One piece. No mirrored shoulder list. */
  singleSide: boolean;
};

export type SetInNecklinePrintShaping = {
  paragraphs: string[];
  firstRows: ActiveSideInstructionTableRow[];
  secondRows: ActiveSideInstructionTableRow[];
};

const CENTER_SETUP_RC_OPTIONS = { includeCenterNecklineSetupRow: true as const };

export function setInBackPrintShapingOptions(args: {
  centerSeamHalf: boolean;
  shallowRound: boolean;
}): SetInNecklinePrintShapingOptions {
  if (args.centerSeamHalf) {
    return {
      includeCenterNecklineSetupRow: false,
      hideCenterNecklineSetupRow: true,
      resetRowCounterForSecondShoulder: false,
      finishHeldNecklineAfterSecondShoulder: false,
      singleSide: true,
    };
  }
  return {
    includeCenterNecklineSetupRow: true,
    hideCenterNecklineSetupRow: true,
    resetRowCounterForSecondShoulder: true,
    finishHeldNecklineAfterSecondShoulder: args.shallowRound,
    singleSide: false,
  };
}

export function setInFrontPrintShapingOptions(args: {
  splitFront: boolean;
  roundNeck: boolean;
  centerBindOff: number;
}): SetInNecklinePrintShapingOptions {
  const split = args.splitFront;
  return {
    includeCenterNecklineSetupRow: true,
    hideCenterNecklineSetupRow: false,
    resetRowCounterForSecondShoulder: !split,
    finishHeldNecklineAfterSecondShoulder: !split && args.roundNeck && args.centerBindOff > 0,
    singleSide: split,
  };
}

function checklistBuildOptions(includeCenter: boolean) {
  return includeCenter ? CENTER_SETUP_RC_OPTIONS : undefined;
}

function displayRowsForChecklist(
  rows: readonly ActiveSideInstructionTableRow[],
  invertCarriageParity: boolean,
): ActiveSideInstructionTableRow[] {
  return compactActiveSideInstructionRowsForPrint(rows, { invertCarriageParity });
}

function carriagePhrase(carriage: string): string {
  const value = carriage.trim();
  if (/alternating/i.test(value)) return "carriage alternating left and right";
  if (/^right$/i.test(value)) return "carriage on the right";
  if (/^left$/i.test(value)) return "carriage on the left";
  return value ? `carriage ${value.toLowerCase()}` : "";
}

function edgePhrase(edge: string): string {
  const value = edge.trim();
  if (!value) return "";
  if (/^center$/i.test(value)) return "center";
  if (/alternating/i.test(value)) return "alternating neck and armhole edges";
  return `${value.toLowerCase()} edge`;
}

function remainPhrase(row: ActiveSideInstructionTableRow): string {
  const display = row.stitchesRemainingDisplay?.trim() ?? "";
  if (display) return display.endsWith(".") ? display.slice(0, -1) : display;
  const count = Math.max(0, Math.floor(row.stitchesRemaining));
  return count === 1 ? "1 stitch remains" : `${count} stitches remain`;
}

function rcLabel(row: ActiveSideInstructionTableRow): string {
  if (row.rcEnd !== undefined && row.rcEnd !== row.rc) {
    const end = String(Math.max(0, Math.floor(row.rcEnd))).padStart(3, "0");
    return `${formatRcColon(row.rc)}–${end}`;
  }
  return formatRcColon(row.rc);
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function canGroup(row: ActiveSideInstructionTableRow): boolean {
  if (row.passNote || row.rowCounterReset || row.rcEnd !== undefined) return false;
  if (row.edge === "Center") return false;
  if (row.action === NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL) return false;
  return /^(Hold|Decrease|Bind off)\b/.test(row.action);
}

function sameGroup(a: ActiveSideInstructionTableRow, b: ActiveSideInstructionTableRow): boolean {
  return canGroup(b) && a.action === b.action && a.edge === b.edge && a.carriagePosition === b.carriagePosition;
}

function singleRowSentence(row: ActiveSideInstructionTableRow): string {
  const where = [carriagePhrase(row.carriagePosition), edgePhrase(row.edge)].filter(Boolean).join(", ");
  const action = row.action.trim().replace(/\.$/, "");
  let sentence = where ? `${rcLabel(row)}, ${where}: ${action}.` : `${rcLabel(row)}: ${action}.`;
  if (row.rowCounterReset) {
    const garment =
      row.rowCounterResetGarmentRc !== undefined
        ? ` The garment row counter was ${formatRcColon(row.rowCounterResetGarmentRc)}.`
        : "";
    sentence = `Reset the row counter to ${formatRcColon(0)}.${garment} ${sentence}`;
  }
  const remain = remainPhrase(row);
  if (remain && !sentence.includes(remain)) sentence = `${sentence} ${remain}.`;
  if (row.passNote) sentence = `${sentence} ${row.passNote.trim()}`;
  return sentence.replace(/\s+/g, " ").trim();
}

function groupedSentence(rows: readonly ActiveSideInstructionTableRow[]): string {
  const first = rows[0]!;
  const edge = edgePhrase(first.edge);
  const carriage = carriagePhrase(first.carriagePosition);
  const where = [edge ? `At the ${edge}` : "", carriage].filter(Boolean).join(", ");
  const steps = rows.map((row) => `${formatRcColon(row.rc)} (${remainPhrase(row)})`);
  const action = first.action.trim().replace(/\.$/, "");
  return `${where}: ${action} at ${joinAnd(steps)}.`;
}

export function writtenLinesFromChecklistRows(rows: readonly ActiveSideInstructionTableRow[]): string[] {
  const lines: string[] = [];
  let index = 0;
  while (index < rows.length) {
    const row = rows[index]!;
    if (!canGroup(row)) {
      lines.push(singleRowSentence(row));
      index += 1;
      continue;
    }
    let end = index;
    while (end + 1 < rows.length && sameGroup(row, rows[end + 1]!)) end += 1;
    lines.push(end === index ? singleRowSentence(row) : groupedSentence(rows.slice(index, end + 1)));
    index = end + 1;
  }
  return lines;
}

function heldShoulderStitches(chart: NeckShoulderShapingChart, heldSide: boolean): number {
  const fromComposition = heldSide ? chart.frontVNeckArmholeComposition?.heldAfterDivideRow : undefined;
  const count = fromComposition ?? chart.rows[0]?.leftStitchCount ?? 0;
  return Math.max(0, Math.floor(Number(count) || 0));
}

function secondShoulderLead(
  chart: NeckShoulderShapingChart,
  startRc: number | undefined,
  options: SetInNecklinePrintShapingOptions,
  heldSide: boolean,
): string {
  if (heldSide) {
    const reset =
      options.resetRowCounterForSecondShoulder && startRc !== undefined
        ? `Free Pass the carriage to the side with the working yarn. This does not add a knitted row. Set the row counter to ${formatRcColon(startRc)} before beginning the Second Side. `
        : "";
    return `${reset}Neckline shaping remains at the neck edge and shoulder shaping remains at the shoulder edge.`;
  }
  const held = heldShoulderStitches(chart, false);
  const reset =
    options.resetRowCounterForSecondShoulder && startRc !== undefined
      ? ` Free Pass the carriage to the side with the working yarn. This does not add a knitted row. Set the row counter to ${formatRcColon(startRc)} before beginning the Second Shoulder.`
      : "";
  return `Once this side is complete, cut yarn and return the ${held} held stitches for the second shoulder to working position.${reset} Work the second shoulder with the steps below. Neckline shaping stays on the neck edge and shoulder shaping stays on the shoulder edge.`;
}

function bindOffLine(rows: readonly ActiveSideInstructionTableRow[]): string | null {
  const last = rows.length > 0 ? rows[rows.length - 1] : undefined;
  if (!last) return null;
  return formatShoulderBindoffRemainingInstruction(last.stitchesRemaining);
}

export function setInNecklinePrintShaping(
  chart: NeckShoulderShapingChart | null | undefined,
  armholeStartRow: number | null | undefined,
  options: SetInNecklinePrintShapingOptions,
): SetInNecklinePrintShaping {
  if (!chart?.rows?.length) return { paragraphs: [], firstRows: [], secondRows: [] };
  const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, armholeStartRow, CENTER_SETUP_RC_OPTIONS);
  const buildOptions = checklistBuildOptions(options.includeCenterNecklineSetupRow);
  let active = buildActiveSideInstructionTableRows(chart, rcStart, buildOptions);
  if (options.hideCenterNecklineSetupRow) {
    active = active.filter((row) => !isCenterNecklineSetupChecklistRow(row));
  }
  const firstRows = displayRowsForChecklist(active, false);
  const cardigan = isSleevelessCardiganFrontNeckShoulderChart(chart);
  const paragraphs = [
    ...(options.singleSide || cardigan ? [] : ["First shoulder."]),
    ...writtenLinesFromChecklistRows(firstRows),
  ];
  const firstBindOff = bindOffLine(active);
  if (firstBindOff) paragraphs.push(firstBindOff);

  if (options.singleSide || cardigan) {
    if (cardigan && !options.singleSide) {
      paragraphs.push(
        `${CARDIGAN_FRONT_OPPOSITE_FRONT_SENTENCE} Use the same row numbers. Keep neckline shaping on the neck edge and shoulder shaping on the shoulder edge, with the carriage on the opposite side.`,
      );
    }
    return { paragraphs, firstRows, secondRows: [] };
  }

  const heldSide = usesVNeckHeldSideChecklist(chart);
  let opposite = heldSide
    ? buildHeldSideInstructionTableRows(chart, rcStart, buildOptions)
    : buildSecondShoulderInstructionTableRows(active);
  if (options.hideCenterNecklineSetupRow) {
    opposite = opposite.filter((row) => !isCenterNecklineSetupChecklistRow(row));
  }
  const secondRows = displayRowsForChecklist(opposite, !heldSide);
  if (secondRows.length === 0) return { paragraphs, firstRows, secondRows };
  const startRc = options.resetRowCounterForSecondShoulder ? secondRows[0]?.rc : undefined;
  paragraphs.push(secondShoulderLead(chart, startRc, options, heldSide));
  paragraphs.push(heldSide ? "Second side." : "Second shoulder.");
  paragraphs.push(...writtenLinesFromChecklistRows(secondRows));
  const secondBindOff = bindOffLine(opposite);
  if (secondBindOff) paragraphs.push(secondBindOff);
  if (options.finishHeldNecklineAfterSecondShoulder) paragraphs.push(SET_IN_HELD_NECKLINE_FINISH_SENTENCE);
  return { paragraphs, firstRows, secondRows };
}

export function setInNecklinePrintShapingParagraphs(
  chart: NeckShoulderShapingChart | null | undefined,
  armholeStartRow: number | null | undefined,
  options: SetInNecklinePrintShapingOptions,
): string[] {
  return setInNecklinePrintShaping(chart, armholeStartRow, options).paragraphs;
}

/**
 * Put the written shaping on the neckline block that points at the checklist.
 * Pass `match` when that block has no checklist sentence, such as a V-neck half.
 */
export function attachSetInNecklinePrintShaping(
  rows: readonly SleevelessPatternDisplayRow[],
  paragraphs: readonly string[],
  match?: RegExp,
): SleevelessPatternDisplayRow[] {
  if (paragraphs.length === 0) return [...rows];
  let section = "";
  let attached = false;
  return rows.map((row) => {
    if (row.kind === "section") {
      section = row.title ?? "";
      return row;
    }
    if (attached || row.kind !== "block" || !/neckline|shoulder/i.test(section)) return row;
    const text = [...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? [])].join("\n");
    const hits = match ? match.test(text) : isPatternPrintChecklistPointer(text);
    if (!hits) return row;
    attached = true;
    return { ...row, printInstructionParagraphs: [...paragraphs] };
  });
}
