/**
 * Written instructions for an adult set-in sleeve pullover.
 *
 * Armhole and sleeve-cap numbers come from the approved Step 4 calculations.
 * Neckline and shoulder lines come from the sleeveless timeline and its
 * instruction functions. Hem, cuff, and finishing wording follow the existing
 * sweater pattern lines. Cardigan fronts, V-necklines, and top-down sleeve
 * wording are not written here.
 */

import {
  CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET,
  cuffUpSleeveBodyRowCounterResetBlock,
} from "../legoBlocks/cuffUpSleeveRowCounter";
import {
  NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE,
  neckbandPickupInstructionFromDebug,
} from "../legoBlocks/neckbandPickup";
import {
  mergedShapingInstructionLines,
  ONE_SHOULDER_AT_A_TIME_NOTE,
  shapingActionsFromTimeline,
} from "../legoBlocks/neckShoulderExecution";
import { isShallowHoldRoundPlan, type RoundNecklinePlanResult } from "../legoBlocks/roundNeckline";
import {
  DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE,
  buildDropShoulderSleeveShapingChartRows,
  dropShoulderSleevePreShapingSpan,
  dropShoulderSleeveShapingRcSequence,
  type DropShoulderSleeveShapingChartRow,
} from "../dropShoulderSleeveShapingChart";
import {
  dropShoulderSleeveShapingPlan,
  dropShoulderSleeveShapingPlanForDirection,
  formatDropShoulderSleeveShapingWrittenLines,
} from "../dropShoulderSleeveShaping";
import { shapingActionRowNumbers } from "../evenShapingSchedule";
import { buildNeckShoulderTimelineAndChartRows } from "../neckShoulderShapingChartRows";
import { roundNeckBackShallowSleevelessSummaryWrittenLines } from "../roundNeckPlanPresentation";
import {
  ARMHOLE_RC_FROM_RESET_NOTE,
  castOnMethodQuickTipInnerHtml,
  formatCenterNecklineBindOffShapingExecution,
  formatCenterNecklineHoldShapingExecution,
  formatRcColon,
  type SleevelessPatternDisplayRow,
} from "../sleevelessPatternOutput";
import type { SetInArmholePlan } from "./setInArmhole";
import type { SetInSleeveCapSuccess } from "./sleeveCapMath";
import type { SetInSleeveSweaterSuccess } from "./setInSleeveSweaterMath";

export type SetInInstructionSectionId = "overview" | "back" | "front" | "sleeves" | "finishing";

export type SetInInstructionBlock = {
  heading?: string;
  lines: string[];
};

export type SetInInstructionSection = {
  id: SetInInstructionSectionId;
  title: string;
  blocks: SetInInstructionBlock[];
};

export type SetInInstructionCheck = {
  ok: boolean;
  errors: string[];
  limitations: string[];
};

export type SetInSleevePatternInstructions = {
  sections: SetInInstructionSection[];
  checks: SetInInstructionCheck;
};

type CountLine = {
  text: string;
  stitches?: number;
  rows?: number;
  /** Counter reading shown in the instruction column. */
  displayRc?: number;
};

export const SET_IN_SLEEVE_CAP_SHAPING_CHART_ID = "set-in-sleeve-cap-shaping-chart";

export type SetInSleeveCapChartRow = {
  rc: number;
  action: string;
  edge: string;
  stitchesRemaining: number;
};

const UNSUPPORTED = [
  "Cardigan fronts are not written for this set-in sleeve pattern.",
  "V-necklines are not written for this set-in sleeve pattern.",
  "Top-down sleeve wording is not written in this step. These sleeve instructions are cuff-up.",
] as const;

const KNIT_OTHER_ROWS =
  "Knit in pattern at all other rows in this section.";

function stitchWord(n: number): string {
  return n === 1 ? "stitch" : "stitches";
}

function rowWord(n: number): string {
  return n === 1 ? "row" : "rows";
}

function inches(n: number): string {
  return `${n.toFixed(2)} in`;
}

function remain(stitches: number): string {
  return `${stitches} ${stitchWord(stitches)} remain.`;
}

function rcList(rows: readonly number[]): string {
  return rows.map((rc) => formatRcColon(rc)).join(", ");
}

function sectionPlain(section: SetInInstructionSection): string {
  return [
    section.title,
    ...section.blocks.flatMap((block) => [
      ...(block.heading ? [block.heading] : []),
      ...block.lines,
    ]),
  ].join("\n");
}

export function setInSleeveInstructionsPlainText(doc: SetInSleevePatternInstructions): string {
  return doc.sections.map(sectionPlain).join("\n\n");
}

export function setInSleeveInstructionSection(
  doc: SetInSleevePatternInstructions,
  id: SetInInstructionSectionId,
): string {
  const section = doc.sections.find((item) => item.id === id);
  return section ? sectionPlain(section) : "";
}

function knitInPatternTo(startRc: number, rowCount: number): string {
  return `${formatRcColon(startRc)} Knit in pattern to ${formatRcColon(startRc + rowCount)}.`;
}

function groupEqualRows(amounts: readonly number[]): { stitches: number; rows: number }[] {
  const groups: { stitches: number; rows: number }[] = [];
  for (const stitches of amounts) {
    const last = groups[groups.length - 1];
    if (last && last.stitches === stitches) last.rows += 1;
    else groups.push({ stitches, rows: 1 });
  }
  return groups;
}

function bothEdgeBindOffRows(stitchesEachSide: readonly number[]): number[] {
  const rows: number[] = [];
  for (const stitches of stitchesEachSide) rows.push(stitches, stitches);
  return rows;
}

function groupedBindOffLines(
  startRc: number,
  startStitches: number,
  stitchesEachSide: readonly number[],
): { lines: string[]; rc: number; stitches: number; rows: number } {
  const lines: string[] = [];
  let rc = startRc;
  let stitches = startStitches;
  let rows = 0;
  for (const group of groupEqualRows(bothEdgeBindOffRows(stitchesEachSide))) {
    const where =
      group.rows === 1 ? "the next row" : `each of the next ${group.rows} ${rowWord(group.rows)}`;
    stitches -= group.stitches * group.rows;
    lines.push(
      `${formatRcColon(rc)} Bind off ${group.stitches} ${stitchWord(group.stitches)} at the beginning of ${where}. ${remain(stitches)}`,
    );
    rc += group.rows;
    rows += group.rows;
  }
  return { lines, rc, stitches, rows };
}

function pairedDecreaseLine(
  startRc: number,
  startStitches: number,
  stitchesEachSide: number,
  everyRows: number,
  times: number,
  edge: "armhole" | "sleeve-cap",
): { text: string; rc: number; stitches: number; rows: number } {
  const actionRows = shapingActionRowNumbers(startRc, times, everyRows);
  const evenRows: number[] = [];
  for (const action of actionRows) {
    for (let offset = 1; offset < everyRows; offset += 1) evenRows.push(action + offset);
  }
  const removed = times * stitchesEachSide * 2;
  const stitches = startStitches - removed;
  const rows = times * everyRows;
  const place = edge === "armhole" ? "each armhole edge" : "each sleeve-cap edge";
  const even =
    evenRows.length > 0 ? ` Knit these rows even: ${rcList(evenRows)}.` : "";
  return {
    text: `${formatRcColon(startRc)} Decrease ${stitchesEachSide} ${stitchWord(stitchesEachSide)} at ${place} on ${rcList(actionRows)}. Each listed RC is the counter reading before that decrease row.${even} ${remain(stitches)}`,
    rc: startRc + rows,
    stitches,
    rows,
  };
}

/** Shared front and back armhole text, from the armhole row-counter reset. */
export function setInArmholeInstructionLines(
  armhole: Pick<
    SetInSleeveCapSuccess["armhole"],
    | "bindOffStitchesEachSide"
    | "stairStepBindOffsEachSide"
    | "decreaseStitchesEachSide"
    | "decreaseRows"
  >,
  stitchesAtUnderarm: number,
): string[] {
  const lines: string[] = [
    "Reset row counter to RC 000.",
    ARMHOLE_RC_FROM_RESET_NOTE,
  ];
  const bindOffs = groupedBindOffLines(0, stitchesAtUnderarm, [
    armhole.bindOffStitchesEachSide,
    ...armhole.stairStepBindOffsEachSide,
  ]);
  lines.push(...bindOffs.lines);
  let rc = bindOffs.rc;
  let stitches = bindOffs.stitches;
  if (armhole.decreaseStitchesEachSide > 0) {
    const decreases = pairedDecreaseLine(
      rc,
      stitches,
      1,
      2,
      armhole.decreaseStitchesEachSide,
      "armhole",
    );
    lines.push(decreases.text);
    rc = decreases.rc;
    stitches = decreases.stitches;
    if (decreases.rows !== armhole.decreaseRows) {
      lines.push("Armhole decrease rows do not match the every-other-row schedule.");
    }
  }
  lines.push(
    `${formatRcColon(rc)} Armhole decreases are complete. ${remain(stitches)}`,
  );
  return lines;
}

/**
 * Cardigan front: the same per-edge set-in groups, worked on the armhole edge only.
 * Each bind-off is one shaping row and one knit-across row, so the row budget matches the back.
 */
export function setInOneEdgeArmholeInstructionLines(
  armhole: Pick<
    SetInArmholePlan,
    | "initialBindOffStitchesEachSide"
    | "stairStepBindOffsEachSide"
    | "decreaseStitchesEachSide"
    | "decreaseRows"
  >,
  stitchesAtArmhole: number,
): string[] {
  const lines: string[] = ["Reset row counter to RC 000.", ARMHOLE_RC_FROM_RESET_NOTE];
  let rc = 0;
  let stitches = stitchesAtArmhole;
  const steps = [armhole.initialBindOffStitchesEachSide, ...armhole.stairStepBindOffsEachSide];
  for (const amount of steps) {
    if (amount <= 0) continue;
    stitches -= amount;
    lines.push(
      `${formatRcColon(rc)} Bind off ${amount} ${stitchWord(amount)} at the armhole edge. Knit across. ${remain(stitches)}`,
    );
    rc += 2;
  }
  if (armhole.decreaseStitchesEachSide > 0) {
    const actionRows = shapingActionRowNumbers(rc, armhole.decreaseStitchesEachSide, 2);
    const evenRows: number[] = [];
    for (const action of actionRows) evenRows.push(action + 1);
    stitches -= armhole.decreaseStitchesEachSide;
    lines.push(
      `${formatRcColon(rc)} Decrease 1 stitch at the armhole edge on ${rcList(actionRows)}. Knit these rows even: ${rcList(evenRows)}. ${remain(stitches)}`,
    );
    rc += armhole.decreaseRows;
  }
  lines.push(`${formatRcColon(rc)} Armhole decreases are complete. ${remain(stitches)}`);
  return lines;
}

type SetInCuffUpSleeveInput = {
  wristStitches: number;
  upperArmStitches: number;
  cuffRows: number;
  cuffInches: number;
  rowsCuffToUpperArm: number;
  cap: SetInSleeveCapSuccess;
};

type SetInCuffUpSleevePresentation = {
  blocks: SetInInstructionBlock[];
  displayRows: SleevelessPatternDisplayRow[];
  shapingRcs: number[];
};

function knitEvenSentence(rows: number): string {
  if (rows <= 0) return "";
  return rows === 1 ? "Knit 1 row even." : `Knit ${rows} rows even.`;
}

function stripInstructionTags(line: string): string {
  return line.replace(/<[^>]+>/g, "");
}

/** Even rows after the last shaping RC. The cap still begins at the sleeve-body end RC. */
function rowsAfterLastSleeveShaping(endRc: number, lastShapingRc: number): number {
  return endRc - (lastShapingRc + 1);
}

function afterFinalSleeveShapingLine(
  verb: "increase" | "decrease",
  afterRows: number,
  endRc: number,
): string {
  if (afterRows <= 0) return "";
  const span = afterRows === 1 ? "1 row even" : `${afterRows} rows even`;
  return `After the final ${verb}, knit ${span} in pattern to ${formatRcColon(endRc)}.`;
}

/**
 * Drop-shoulder taper checklist without the upper-arm bind-off row.
 * Set-in sleeves continue into the sleeve cap at that RC.
 */
function setInSleeveTaperChartRows(
  input: SetInCuffUpSleeveInput,
): DropShoulderSleeveShapingChartRow[] {
  const rows = buildDropShoulderSleeveShapingChartRows({
    topSts: input.upperArmStitches,
    wristSts: input.wristStitches,
    cuffRows: input.cuffRows,
    sleeveBodyRows: input.rowsCuffToUpperArm,
    sleeveTotalRows: input.cuffRows + input.rowsCuffToUpperArm,
    direction: "cuff-up",
  });
  const last = rows[rows.length - 1];
  if (last && last.stitchesRemaining === 0 && /bind off/i.test(last.action)) {
    return rows.slice(0, -1);
  }
  return rows;
}

function chartLine(row: DropShoulderSleeveShapingChartRow): string {
  return `${formatRcColon(row.rc)} ${row.action}. ${row.edge}. ${row.stitchesRemaining} ${stitchWord(row.stitchesRemaining)}.`;
}

function capDisplayBlock(line: CountLine): Extract<SleevelessPatternDisplayRow, { kind: "block" }> {
  const rcMatch = /^RC:\s*(\d+)\s+([\s\S]+)$/.exec(line.text.trim());
  const remainMatch = /(-?\d+) stitches remain/.exec(line.text);
  const rc = line.displayRc ?? (rcMatch ? Number(rcMatch[1]) : undefined);
  const stitchCount = remainMatch
    ? Number(remainMatch[1])
    : line.stitches !== undefined && line.stitches > 0
      ? line.stitches
      : undefined;
  return {
    kind: "block",
    ...(rc !== undefined ? { rc: formatRcColon(rc) } : {}),
    paragraphs: [rcMatch ? rcMatch[2]! : line.text],
    ...(stitchCount !== undefined ? { stitchCount } : {}),
  };
}

/**
 * Cuff-up sleeve presentation in the Drop Shoulder section order.
 * Increase and decrease row-counter readings stay on the shared cuff-up schedule.
 */
export function buildSetInCuffUpSleevePresentation(
  input: SetInCuffUpSleeveInput,
): SetInCuffUpSleevePresentation {
  const chartInput = {
    topSts: input.upperArmStitches,
    wristSts: input.wristStitches,
    cuffRows: input.cuffRows,
    sleeveBodyRows: input.rowsCuffToUpperArm,
    sleeveTotalRows: input.cuffRows + input.rowsCuffToUpperArm,
    direction: "cuff-up" as const,
  };
  const plan = dropShoulderSleeveShapingPlanForDirection(
    {
      topSts: input.upperArmStitches,
      wristSts: input.wristStitches,
      sleeveBodyRows: input.rowsCuffToUpperArm,
    },
    "cuff-up",
  );
  const shapingRcs = dropShoulderSleeveShapingRcSequence(chartInput);
  const preShaping = dropShoulderSleevePreShapingSpan(chartInput);
  const writtenShaping = formatDropShoulderSleeveShapingWrittenLines(
    plan.shapingDirection,
    plan.steps,
    shapingRcs,
  );
  const plainShaping = writtenShaping.map(stripInstructionTags);
  const taperRows = setInSleeveTaperChartRows(input);
  const capModel = buildSleeveCapInstructionModel(input.cap, input.rowsCuffToUpperArm);
  const capLines = capModel.lines.map((line) => line.text);
  const cuffEven = knitEvenSentence(input.cuffRows);
  const cuffDepth = `Cuff, ${inches(input.cuffInches)}.`;
  const cuffSentence = cuffEven ? `${cuffEven} ${cuffDepth}` : cuffDepth;

  const cuffLines = [
    "Make 2 sleeves.",
    `${formatRcColon(0)} Cast on ${input.wristStitches} ${stitchWord(input.wristStitches)} for the sleeve cuff.`,
    `${formatRcColon(0)} ${cuffSentence}`,
    CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET,
  ];

  const sleeveBodyLines: string[] = [];
  const lastShapingRc = shapingRcs[shapingRcs.length - 1];
  const afterLine =
    lastShapingRc === undefined
      ? ""
      : afterFinalSleeveShapingLine(
          plan.shapingDirection,
          rowsAfterLastSleeveShaping(input.rowsCuffToUpperArm, lastShapingRc),
          input.rowsCuffToUpperArm,
        );
  if (shapingRcs.length === 0) {
    const straight = knitEvenSentence(input.rowsCuffToUpperArm);
    sleeveBodyLines.push(
      `${formatRcColon(0)} ${straight ? `${straight} ` : ""}${remain(input.upperArmStitches)}`.trim(),
    );
  } else {
    if (preShaping.straightRows > 0) {
      sleeveBodyLines.push(`${formatRcColon(preShaping.bodyStartRc)} ${knitEvenSentence(preShaping.straightRows)}`);
    }
    sleeveBodyLines.push(
      `${formatRcColon(preShaping.firstShapingRc ?? 0)} ${DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE}`,
    );
    sleeveBodyLines.push(...plainShaping);
    if (afterLine) sleeveBodyLines.push(`${afterLine} ${remain(input.upperArmStitches)}`);
    else sleeveBodyLines.push(`${formatRcColon(input.rowsCuffToUpperArm)} ${remain(input.upperArmStitches)}`);
  }

  const chartLines =
    taperRows.length > 0
      ? taperRows.map(chartLine)
      : ["There is no side shaping on this sleeve. Continue to the sleeve cap."];

  const blocks: SetInInstructionBlock[] = [
    { heading: "CUFF", lines: cuffLines },
    { heading: "SLEEVE BODY", lines: sleeveBodyLines },
    { heading: "SLEEVE SHAPING CHART", lines: chartLines },
    { heading: "SLEEVE CAP", lines: capLines },
    { heading: "SLEEVE CAP SHAPING CHART", lines: capModel.chartRows.map(chartLine) },
  ];

  const displayRows: SleevelessPatternDisplayRow[] = [
    { kind: "piece", title: "SLEEVE" },
    { kind: "block", paragraphs: ["Make 2 sleeves."] },
    {
      kind: "block",
      rc: formatRcColon(0),
      paragraphs: [`Cast on ${input.wristStitches} stitches for the sleeve cuff.`],
      stitchCount: input.wristStitches > 0 ? input.wristStitches : undefined,
      ...(input.wristStitches > 0
        ? {
            tipHtml: castOnMethodQuickTipInnerHtml(),
            tipHtmlIsFull: true,
            tipPresentation: "quick-tip" as const,
            tipId: "set-in-sleeve-cast-on-cuff",
          }
        : {}),
    },
    { kind: "section", title: "CUFF" },
    {
      kind: "block",
      rc: formatRcColon(0),
      paragraphs: [cuffSentence],
      stitchCount: input.wristStitches > 0 ? input.wristStitches : undefined,
    },
    cuffUpSleeveBodyRowCounterResetBlock(),
    { kind: "section", title: "SLEEVE BODY" },
  ];

  if (shapingRcs.length === 0) {
    const straight = knitEvenSentence(input.rowsCuffToUpperArm);
    displayRows.push({
      kind: "block",
      rc: formatRcColon(0),
      paragraphs: [straight, remain(input.upperArmStitches)].filter((line) => line.length > 0),
      stitchCount: input.upperArmStitches > 0 ? input.upperArmStitches : undefined,
    });
  } else {
    if (preShaping.straightRows > 0) {
      displayRows.push({
        kind: "block",
        rc: formatRcColon(preShaping.bodyStartRc),
        paragraphs: [knitEvenSentence(preShaping.straightRows)],
        stitchCount: input.wristStitches > 0 ? input.wristStitches : undefined,
      });
    }
    displayRows.push({
      kind: "block",
      rc: formatRcColon(preShaping.firstShapingRc ?? 0),
      paragraphs: [DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE, ...plainShaping],
      trustedParagraphs: [DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE, ...writtenShaping],
      stitchCount: input.wristStitches > 0 ? input.wristStitches : undefined,
    });
    displayRows.push({
      kind: "block",
      rc: formatRcColon(afterLine ? (lastShapingRc ?? 0) + 1 : input.rowsCuffToUpperArm),
      paragraphs: [afterLine, remain(input.upperArmStitches)].filter((line) => line.length > 0),
      stitchCount: input.upperArmStitches > 0 ? input.upperArmStitches : undefined,
    });
  }

  displayRows.push({ kind: "section", title: "SLEEVE SHAPING CHART" });
  if (taperRows.length > 0) {
    displayRows.push({
      kind: "block",
      paragraphs: [],
      sleeveShapingChartRows: taperRows,
    });
  } else {
    displayRows.push({
      kind: "block",
      paragraphs: ["There is no side shaping on this sleeve. Continue to the sleeve cap."],
    });
  }

  displayRows.push({ kind: "section", title: "SLEEVE CAP" });
  displayRows.push(...capModel.lines.map(capDisplayBlock));
  displayRows.push({
    kind: "block",
    paragraphs: [
      `Sleeve-cap height is ${input.cap.totals.capHeightInches.toFixed(2)} in and is not included in the cuff-to-upper-arm length.`,
    ],
  });
  displayRows.push({ kind: "section", title: "SLEEVE CAP SHAPING CHART" });
  displayRows.push({
    kind: "block",
    paragraphs: [],
    sleeveShapingChartRows: capModel.chartRows,
    sleeveShapingChartId: SET_IN_SLEEVE_CAP_SHAPING_CHART_ID,
  });

  return { blocks, displayRows, shapingRcs };
}

export function setInCuffUpSleeveInstructionLines(input: SetInCuffUpSleeveInput): string[] {
  return buildSetInCuffUpSleevePresentation(input).blocks.flatMap((block) => [
    ...(block.heading ? [block.heading] : []),
    ...block.lines,
  ]);
}

function necklineInstructionLines(
  result: SetInSleeveSweaterSuccess,
  piece: "back" | "front",
  necklineStartRc: number,
): string[] {
  const plan: RoundNecklinePlanResult = result.body.neckline[piece];
  const schedule = result.body.neckline.shoulderBindOff;
  const built = buildNeckShoulderTimelineAndChartRows(
    {
      firstShapingRow: necklineStartRc,
      shoulderStitchesPerSide: result.body.neckline.shoulderStitchesPerSide,
      centerNeckBindOff: result.body.neckline.openingStitches,
      neckDepthRows: plan.necklineDepthRows,
      neckProfile: piece,
      stitchesAfterArmhole: result.body.stitchesAtShoulder,
      shoulderBindoffRows: schedule.placementRows,
    },
    { shoulderSchedule: schedule },
  );
  const row0 = built.chartRows[0];
  const centerLine = isShallowHoldRoundPlan(plan)
    ? formatCenterNecklineHoldShapingExecution({
        totalCenterHold: plan.centerBindOff,
        stitchesLeftAfter: row0?.leftStitchCount ?? 0,
        stitchesRightAfter: row0?.rightStitchCount ?? 0,
      })
    : formatCenterNecklineBindOffShapingExecution({
        totalCenterBindOff: plan.centerBindOff,
        stitchesLeftAfter: row0?.leftStitchCount ?? 0,
        stitchesRightAfter: row0?.rightStitchCount ?? 0,
      });
  const actions = shapingActionsFromTimeline(built.timeline, {
    centerBindOffShapingLine: centerLine,
  });
  const summary = roundNeckBackShallowSleevelessSummaryWrittenLines(plan, {
    bodyWidthStitches: result.body.stitchesAtShoulder,
    necklineStartRcLabel: formatRcColon(necklineStartRc),
  }).filter((line) => !/checklist below/i.test(line));
  return [
    ...summary,
    ONE_SHOULDER_AT_A_TIME_NOTE,
    ...mergedShapingInstructionLines(actions.neckActions, actions.shoulderActions),
    KNIT_OTHER_ROWS,
  ];
}

function bodyLines(result: SetInSleeveSweaterSuccess, piece: "back" | "front"): string[] {
  const { body } = result;
  const pieceName = piece === "back" ? "the back" : "the front";
  const lines = [
    `${formatRcColon(0)} Cast on ${body.bodyBlock.hemStitches} ${stitchWord(body.bodyBlock.hemStitches)} for ${pieceName}.`,
    knitInPatternTo(0, body.hemRows) + ` Hem, ${inches(body.hemInches)}.`,
  ];
  if (body.bodyBlock.shapingDirection === "none" || body.bodyBlock.shapingRowNumbers.length === 0) {
    lines.push(
      `${knitInPatternTo(body.hemRows, body.rowsToArmhole)} ${remain(body.stitchesAtUnderarm)}`,
    );
    return lines;
  }
  const verb = body.bodyBlock.shapingDirection === "decrease" ? "Decrease" : "Increase";
  lines.push(
    `${knitInPatternTo(body.hemRows, body.rowsToArmhole)} ${verb} 1 stitch at each side when the counter reads ${rcList(body.bodyBlock.shapingRowNumbers)}, before knitting that row. ${remain(body.stitchesAtUnderarm)}`,
    );
  return lines;
}

function padRc(rc: number): string {
  return String(Math.max(0, Math.floor(rc))).padStart(3, "0");
}

function parentheticalRcReadings(rows: readonly number[]): string {
  return `(RC: ${rows.map(padRc).join(", ")})`;
}

function zoneLabel(name: string): string {
  return `${name[0]!.toUpperCase()}${name.slice(1)} cap`;
}

/**
 * One underarm or slope bind-off is worked at the beginning of a row, first one side, then the other.
 * The calculation does not name a carriage side.
 */
function recordBindOffRows(
  chartRows: SetInSleeveCapChartRow[],
  startRc: number,
  startStitches: number,
  stitchesEachSide: readonly number[],
): void {
  let rc = startRc;
  let stitches = startStitches;
  bothEdgeBindOffRows(stitchesEachSide).forEach((amount, index) => {
    stitches -= amount;
    chartRows.push({
      rc,
      action: `Bind off ${amount} ${stitchWord(amount)}`,
      edge: index % 2 === 0 ? "One side" : "Other side",
      stitchesRemaining: stitches,
    });
    rc += 1;
  });
}

function sleeveCapDecreaseSentence(
  label: string,
  stitchesEachSide: number,
  everyRows: number,
  times: number,
  actionRows: readonly number[],
): string {
  const interval = everyRows <= 1 ? "every row" : `every ${everyRows} rows`;
  const timesLabel = times === 1 ? "time" : "times";
  return `${label}: Decrease ${stitchesEachSide} ${stitchWord(stitchesEachSide)} at each end ${interval}, ${times} ${timesLabel}. ${parentheticalRcReadings(actionRows)}`;
}

/**
 * Sleeve-cap wording and checklist from the approved cap schedule.
 * Decrease RC readings are the counter before that decrease row.
 * The final bind-off is recorded at that same counter and does not add a knitted row.
 */
function buildSleeveCapInstructionModel(
  cap: SetInSleeveCapSuccess,
  capStartRc: number,
): { lines: CountLine[]; chartRows: SetInSleeveCapChartRow[] } {
  const lines: CountLine[] = [];
  const chartRows: SetInSleeveCapChartRow[] = [];
  let rc = capStartRc;
  let stitches = cap.sleeve.upperArmStitches;
  lines.push({
    text: `${formatRcColon(rc)} Begin the sleeve cap. ${remain(stitches)}`,
    stitches,
    rows: 0,
  });

  const underarmAmounts = [
    cap.sleeve.initialBindOffStitchesEachSide,
    ...cap.sleeve.stairStepBindOffsEachSide,
  ];
  const bindOffs = groupedBindOffLines(rc, stitches, underarmAmounts);
  recordBindOffRows(chartRows, rc, stitches, underarmAmounts);
  bindOffs.lines.forEach((text, index) => {
    lines.push({
      text,
      rows: index === bindOffs.lines.length - 1 ? bindOffs.rows : 0,
      stitches: index === bindOffs.lines.length - 1 ? bindOffs.stitches : undefined,
    });
  });
  rc = bindOffs.rc;
  stitches = bindOffs.stitches;

  for (const zone of [
    cap.workingCap.zones.lower,
    cap.workingCap.zones.middle,
    cap.workingCap.zones.upper,
  ]) {
    const label = zoneLabel(zone.name);
    for (const step of zone.steps) {
      if (step.times <= 0 || step.everyRows <= 0 || step.stitchesEachSide <= 0) continue;
      const actionRows = shapingActionRowNumbers(rc, step.times, step.everyRows);
      let after = stitches;
      for (const actionRc of actionRows) {
        after -= step.stitchesEachSide * 2;
        chartRows.push({
          rc: actionRc,
          action: `Decrease ${step.stitchesEachSide} ${stitchWord(step.stitchesEachSide)} at each end`,
          edge: "Each end",
          stitchesRemaining: after,
        });
      }
      const rows = step.times * step.everyRows;
      lines.push({
        text: sleeveCapDecreaseSentence(label, step.stitchesEachSide, step.everyRows, step.times, actionRows),
        stitches: after,
        rows,
        displayRc: actionRows[0] ?? rc,
      });
      rc += rows;
      stitches = after;
    }
  }

  const slopeAmounts: number[] = [];
  for (const step of cap.upperSlope.steps) slopeAmounts.push(step.stitchesEachSide);
  if (slopeAmounts.length > 0) {
    const slope = groupedBindOffLines(rc, stitches, slopeAmounts);
    recordBindOffRows(chartRows, rc, stitches, slopeAmounts);
    slope.lines[0] = `${slope.lines[0]} Upper slope.`;
    slope.lines.forEach((text, index) => {
      lines.push({
        text,
        rows: index === slope.lines.length - 1 ? slope.rows : 0,
        stitches: index === slope.lines.length - 1 ? slope.stitches : undefined,
      });
    });
    rc = slope.rc;
    stitches = slope.stitches;
  }
  if (cap.upperSlope.plainRows > 0) {
    lines.push({
      text: `${knitInPatternTo(rc, cap.upperSlope.plainRows)} ${remain(stitches)}`,
      stitches,
      rows: cap.upperSlope.plainRows,
    });
    rc += cap.upperSlope.plainRows;
  }
  lines.push({
    text: `${formatRcColon(rc)} Bind off the remaining ${cap.totals.finalStitches} ${stitchWord(cap.totals.finalStitches)}. This bind-off does not add a knitted row.`,
    stitches: 0,
    rows: 0,
  });
  chartRows.push({
    rc,
    action: `Bind off the remaining ${cap.totals.finalStitches} ${stitchWord(cap.totals.finalStitches)}`,
    edge: "All stitches",
    stitchesRemaining: 0,
  });
  return { lines, chartRows };
}

function sleeveCapLines(cap: SetInSleeveCapSuccess, capStartRc: number): CountLine[] {
  return buildSleeveCapInstructionModel(cap, capStartRc).lines;
}

function sleeveBodyRowAccount(endRc: number, shapingRcs: readonly number[]): number {
  if (shapingRcs.length === 0) return endRc;
  const first = shapingRcs[0]!;
  const last = shapingRcs[shapingRcs.length - 1]!;
  let between = 0;
  for (let index = 1; index < shapingRcs.length; index += 1) {
    between += shapingRcs[index]! - shapingRcs[index - 1]! - 1;
  }
  return first + shapingRcs.length + between + (endRc - (last + 1));
}

function checkWhole(label: string, value: number, errors: string[]): void {
  if (!Number.isInteger(value) || value < 0) {
    errors.push(`${label} is ${value}.`);
  }
}

function validate(
  result: SetInSleeveSweaterSuccess,
  armholeLines: string[],
  capLineRecords: CountLine[],
  sleeveBodyRows: number,
): SetInInstructionCheck {
  const errors: string[] = [];
  const limitations: string[] = [...UNSUPPORTED.slice(0, 2)];
  if (result.sleeveDirection !== "cuff-up") limitations.push(UNSUPPORTED[2]);

  const armhole = result.body.armhole;
  if (result.body.neckline.back.necklineDepthRows > armhole.straightRows) {
    errors.push("The back neckline is deeper than the straight armhole rows.");
  }
  if (result.body.neckline.front.necklineDepthRows > armhole.straightRows) {
    errors.push("The front neckline is deeper than the straight armhole rows.");
  }

  const shoulder = result.body.neckline.shoulderBindOff;
  const shoulderStitches =
    shoulder.leftChunks.reduce((sum, n) => sum + n, 0) +
    shoulder.rightChunks.reduce((sum, n) => sum + n, 0);
  if (shoulderStitches + result.body.neckline.openingStitches !== armhole.bodyStitchesAtShoulder) {
    errors.push("Shoulder bind-offs and the neck opening do not use every stitch at the shoulder.");
  }

  let capRows = 0;
  let capStitches = result.sleeve.upperArmStitches;
  for (const line of capLineRecords) {
    if (line.rows) capRows += line.rows;
    if (line.stitches !== undefined) {
      checkWhole("Sleeve stitch count", line.stitches, errors);
      capStitches = line.stitches;
    }
  }
  if (capRows !== result.sleeveCap.totals.capRows) {
    errors.push(
      `Sleeve-cap instructions use ${capRows} rows and the calculation uses ${result.sleeveCap.totals.capRows}.`,
    );
  }
  if (capStitches !== 0) {
    errors.push(`Sleeve-cap instructions end with ${capStitches} stitches on the needle.`);
  }
  if (sleeveBodyRows !== result.sleeve.rowsCuffToUpperArm) {
    errors.push(
      `Sleeve-body instructions use ${sleeveBodyRows} rows and the calculation uses ${result.sleeve.rowsCuffToUpperArm}.`,
    );
  }

  const carriageGroups = armholeLines.filter((line) => line.includes("Bind off"));
  const expectedGroups = groupEqualRows(
    bothEdgeBindOffRows([armhole.bindOffStitchesEachSide, ...armhole.stairStepBindOffsEachSide]),
  ).length;
  if (carriageGroups.length !== expectedGroups) {
    errors.push("Armhole bind-off groups do not match the calculated bind-off rows.");
  }
  if (!armholeLines.some((line) => line.includes("Decrease 1 stitch at each armhole edge"))) {
    if (armhole.decreaseStitchesEachSide > 0) errors.push("Armhole decrease instructions are missing.");
  }

  checkWhole("Body stitches at the underarm", result.body.stitchesAtUnderarm, errors);
  checkWhole("Body stitches at the shoulder", result.body.stitchesAtShoulder, errors);
  checkWhole("Upper-arm stitches", result.sleeve.upperArmStitches, errors);
  checkWhole("Final sleeve-cap stitches", result.sleeveCap.totals.finalStitches, errors);

  const text = armholeLines.join("\n");
  if (/\s-\d+ stitches remain/.test(text) || text.includes("NaN")) {
    errors.push("Armhole instructions contain a negative or invalid stitch count.");
  }

  return { ok: errors.length === 0, errors, limitations };
}

function finishingLines(result: SetInSleeveSweaterSuccess): string[] {
  const spi = result.body.neckline.openingStitches / result.finished.neckWidthInches;
  const rpi = result.body.neckline.back.necklineDepthRows / result.finished.backNeckDepthInches;
  const pickup = neckbandPickupInstructionFromDebug("round", {
    stitchesPerInch: spi,
    rowsPerInch: rpi,
    necklineStitches: result.body.neckline.openingStitches,
    frontNeckDepthRows: result.body.neckline.front.necklineDepthRows,
    backNeckDepthRows: result.body.neckline.back.necklineDepthRows,
    frontCenterNeckBindOffStitches: result.body.neckline.front.centerBindOff,
    centerNeckBindOffStitches: result.body.neckline.back.centerBindOff,
  });
  return [
    "Block the pieces if you want to set the measurements before seaming.",
    "Lightly steam the pieces to the finished measurements. Allow the pieces to dry completely before assembly.",
    "Join one shoulder using your preferred method: linker, crochet slip stitch, or the machine bind-off method.",
    ...(pickup ? [pickup.primaryText, NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE] : []),
    "Work the neckline trim or neckband.",
    "Finish the neckband as desired.",
    "Join the remaining shoulder seam and neckband seam.",
    "Seam each sleeve.",
    "Set the sleeves into the armholes. Match each underarm bind-off to the sleeve-cap bind-off, and match the top of the sleeve cap to the shoulder seam.",
    "Match the armhole edges and the hem. Seam from the hem to the underarm.",
    "Lightly steam the seams if needed. Weave in the ends. Allow the garment to rest before wearing.",
  ];
}

export function generateSetInSleeveInstructions(
  result: SetInSleeveSweaterSuccess,
): SetInSleevePatternInstructions {
  const armhole = result.body.armhole;
  const armholeText = setInArmholeInstructionLines(armhole, result.body.stitchesAtUnderarm);
  const necklineStartBack = armhole.totalRows - result.body.neckline.back.necklineDepthRows;
  const necklineStartFront = armhole.totalRows - result.body.neckline.front.necklineDepthRows;
  const decreaseCompleteRc = armhole.bindOffRows + armhole.decreaseRows;
  const backNeck = [
    ...(necklineStartBack > decreaseCompleteRc
      ? [knitInPatternTo(decreaseCompleteRc, necklineStartBack - decreaseCompleteRc)]
      : []),
    `${formatRcColon(necklineStartBack)} Begin the back neckline. The neckline uses ${result.body.neckline.back.necklineDepthRows} ${rowWord(result.body.neckline.back.necklineDepthRows)} and finishes the armhole at ${formatRcColon(armhole.totalRows)}.`,
    ...necklineInstructionLines(result, "back", necklineStartBack),
  ];
  const frontNeck = [
    ...(necklineStartFront > decreaseCompleteRc
      ? [knitInPatternTo(decreaseCompleteRc, necklineStartFront - decreaseCompleteRc)]
      : []),
    `${formatRcColon(necklineStartFront)} Begin the front neckline. The neckline uses ${result.body.neckline.front.necklineDepthRows} ${rowWord(result.body.neckline.front.necklineDepthRows)} and finishes the armhole at ${formatRcColon(armhole.totalRows)}.`,
    ...necklineInstructionLines(result, "front", necklineStartFront),
  ];

  const cuffUp = dropShoulderSleeveShapingPlan({
    topSts: result.sleeve.upperArmStitches,
    wristSts: result.sleeve.wristStitches,
    sleeveBodyRows: result.sleeve.rowsCuffToUpperArm,
  });
  const sleeveChartInput = {
    topSts: result.sleeve.upperArmStitches,
    wristSts: result.sleeve.wristStitches,
    cuffRows: result.sleeve.cuffRows,
    sleeveBodyRows: result.sleeve.rowsCuffToUpperArm,
    sleeveTotalRows: result.sleeve.rowsToUpperArm,
    direction: "cuff-up" as const,
  };
  const shapingRcs = dropShoulderSleeveShapingRcSequence(sleeveChartInput);
  const capRecords = sleeveCapLines(result.sleeveCap, result.sleeve.rowsCuffToUpperArm);
  const sleeveBodyRows = sleeveBodyRowAccount(result.sleeve.rowsCuffToUpperArm, shapingRcs);
  const checks = validate(result, armholeText, capRecords, sleeveBodyRows);
  const finalCapLine = capRecords[capRecords.length - 1]?.text ?? "";
  if (!finalCapLine.includes(`Bind off the remaining ${result.sleeveCap.totals.finalStitches}`)) {
    checks.errors.push("The final sleeve-cap bind-off does not match the calculation.");
    checks.ok = false;
  }
  if (cuffUp.steps.reduce((sum, step) => sum + step.times, 0) * 2 + result.sleeve.wristStitches !== result.sleeve.upperArmStitches) {
    checks.errors.push("Sleeve increases do not reach the upper-arm stitch count.");
    checks.ok = false;
  }

  const finished = result.finished;
  const overview: SetInInstructionSection = {
    id: "overview",
    title: "Pattern overview and measurements",
    blocks: [
      {
        lines: [
          "Set-in sleeve sweater, pullover, round neckline.",
          `Size audience: ${result.chartAudience}. Fit: ${result.fit}.`,
          `Finished bust ${inches(finished.bustInches)}, hip ${inches(finished.hipInches)}, length ${inches(finished.lengthInches)}.`,
          `Shoulder width ${inches(finished.shoulderWidthInches)}. Armhole depth ${inches(finished.armholeDepthInches)}.`,
          `Finished upper arm ${inches(finished.finishedUpperArmInches)}. Wrist ${inches(finished.wristInches)}.`,
          `Sleeve length from cuff to upper arm ${inches(finished.sleeveLengthInches)}. Sleeve-cap height ${inches(result.sleeveCap.totals.capHeightInches)} is not included in that length.`,
          `Armhole method: ${armhole.method}. The same armhole is used on the front and the back.`,
          ...result.needles.messages,
          ...checks.limitations,
        ],
      },
    ],
  };

  const back: SetInInstructionSection = {
    id: "back",
    title: "Back",
    blocks: [
      { heading: "HEM", lines: bodyLines(result, "back") },
      { heading: "ARMHOLE", lines: armholeText },
      { heading: "NECKLINE AND SHOULDERS", lines: backNeck },
    ],
  };
  const front: SetInInstructionSection = {
    id: "front",
    title: "Front",
    blocks: [
      { heading: "HEM", lines: bodyLines(result, "front") },
      { heading: "ARMHOLE", lines: [...armholeText] },
      { heading: "NECKLINE AND SHOULDERS", lines: frontNeck },
    ],
  };

  const sleevePresentation = buildSetInCuffUpSleevePresentation({
    wristStitches: result.sleeve.wristStitches,
    upperArmStitches: result.sleeve.upperArmStitches,
    cuffRows: result.sleeve.cuffRows,
    cuffInches: result.sleeve.cuffInches,
    rowsCuffToUpperArm: result.sleeve.rowsCuffToUpperArm,
    cap: result.sleeveCap,
  });
  if (sleevePresentation.shapingRcs.join(",") !== shapingRcs.join(",")) {
    checks.errors.push("Sleeve increase row-counter readings do not match the cuff-up schedule.");
    checks.ok = false;
  }

  const sleeves: SetInInstructionSection = {
    id: "sleeves",
    title: "Sleeves",
    blocks: sleevePresentation.blocks,
  };

  const finishing: SetInInstructionSection = {
    id: "finishing",
    title: "Finishing",
    blocks: [{ lines: finishingLines(result) }],
  };

  return {
    sections: [overview, back, front, sleeves, finishing],
    checks,
  };
}
