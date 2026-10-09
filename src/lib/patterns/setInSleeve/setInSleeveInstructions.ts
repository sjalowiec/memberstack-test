/**
 * Written instructions for an adult set-in sleeve pullover.
 *
 * Numbers come from the approved sweater and sleeve-cap calculations.
 * Wording follows the existing row-counter, bind-off, neckline, and cuff-up
 * sleeve conventions. Cardigan fronts, V-necklines, and top-down sleeve
 * wording are not written here.
 */

import { CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET } from "../legoBlocks/cuffUpSleeveRowCounter";
import {
  dropShoulderSleeveBodyRowSpans,
  dropShoulderSleeveShapingRcSequence,
} from "../dropShoulderSleeveShapingChart";
import {
  dropShoulderSleeveShapingPlan,
  formatDropShoulderSleeveShapingWrittenLines,
} from "../dropShoulderSleeveShaping";
import { shapingActionRowNumbers } from "../evenShapingSchedule";
import {
  roundNeckPlanCenterWrittenLine,
  roundNeckPlanFinishHeldStitchesLine,
  roundNeckPlanOneSideNeckEdgeWrittenLines,
} from "../roundNeckPlanPresentation";
import { ARMHOLE_RC_FROM_RESET_NOTE, formatRcColon } from "../sleevelessPatternOutput";
import type { RoundNecklinePlanResult } from "../legoBlocks/roundNeckline";
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
  /** Stitches on the needle after this line. Omitted when the line does not change or report them. */
  stitches?: number;
  /** Rows consumed by this line. */
  rows?: number;
};

const UNSUPPORTED = [
  "Cardigan fronts are not written for this set-in sleeve pattern.",
  "V-necklines are not written for this set-in sleeve pattern.",
  "Top-down sleeve wording is not written in this step. These sleeve instructions are cuff-up.",
] as const;

function stitchWord(n: number): string {
  return n === 1 ? "stitch" : "stitches";
}

function rowWord(n: number): string {
  return n === 1 ? "row" : "rows";
}

function timeWord(n: number): string {
  return n === 1 ? "time" : "times";
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

function bindOffPairLines(
  startRc: number,
  startStitches: number,
  stitchesEachSide: number,
  edge: "armhole" | "sleeve-cap",
): { lines: string[]; rc: number; stitches: number; rows: number } {
  const afterFirst = startStitches - stitchesEachSide;
  const afterSecond = afterFirst - stitchesEachSide;
  const lines = [
    `${formatRcColon(startRc)} Bind off ${stitchesEachSide} ${stitchWord(stitchesEachSide)} at the carriage-side ${edge} edge. Knit across. ${remain(afterFirst)}`,
    `${formatRcColon(startRc + 1)} Bind off ${stitchesEachSide} ${stitchWord(stitchesEachSide)} at the opposite ${edge} edge. Knit across. ${remain(afterSecond)}`,
  ];
  return { lines, rc: startRc + 2, stitches: afterSecond, rows: 2 };
}

function armholeDecreaseLines(
  startRc: number,
  startStitches: number,
  stitchesEachSide: number,
  decreaseRows: number,
): { lines: string[]; rc: number; stitches: number; rows: number } {
  if (stitchesEachSide === 0) {
    return { lines: [], rc: startRc, stitches: startStitches, rows: 0 };
  }
  const actionRows = shapingActionRowNumbers(startRc, stitchesEachSide, 2);
  const removed = stitchesEachSide * 2;
  const stitches = startStitches - removed;
  const lines = [
    `${formatRcColon(startRc)} Decrease 1 stitch at each armhole edge every other row ${stitchesEachSide} ${timeWord(stitchesEachSide)}. One stitch is decreased at each edge on the same row. Decrease on ${rcList(actionRows)}. ${remain(stitches)}`,
  ];
  if (actionRows.length !== stitchesEachSide || decreaseRows !== stitchesEachSide * 2) {
    lines.push("Armhole decrease rows do not match the every-other-row schedule.");
  }
  return { lines, rc: startRc + decreaseRows, stitches, rows: decreaseRows };
}

/** Shared front and back armhole text, from the armhole row-counter reset. */
export function setInArmholeInstructionLines(
  armhole: SetInSleeveCapSuccess["armhole"],
  stitchesAtUnderarm: number,
): string[] {
  const lines: string[] = [
    "Reset row counter to RC 000.",
    ARMHOLE_RC_FROM_RESET_NOTE,
  ];
  let rc = 0;
  let stitches = stitchesAtUnderarm;
  const first = bindOffPairLines(rc, stitches, armhole.bindOffStitchesEachSide, "armhole");
  lines.push(...first.lines);
  rc = first.rc;
  stitches = first.stitches;
  for (const stair of armhole.stairStepBindOffsEachSide) {
    const step = bindOffPairLines(rc, stitches, stair, "armhole");
    lines.push(...step.lines);
    rc = step.rc;
    stitches = step.stitches;
  }
  const decreases = armholeDecreaseLines(
    rc,
    stitches,
    armhole.decreaseStitchesEachSide,
    armhole.decreaseRows,
  );
  lines.push(...decreases.lines);
  rc = decreases.rc;
  stitches = decreases.stitches;
  lines.push(
    `${formatRcColon(rc)} Armhole decreases are complete. ${remain(stitches)} Knit even from here to the neckline. Those rows are part of the armhole depth.`,
  );
  return lines;
}

function shoulderShapingRcs(
  necklineStartRc: number,
  necklineDepthRows: number,
  placementRows: number,
  chunkCount: number,
): number[] {
  const workRows = Math.max(0, necklineDepthRows - 1);
  const rowsUsed = Math.min(Math.max(placementRows, 0), workRows);
  const startI = Math.max(0, workRows - rowsUsed);
  const rows: number[] = [];
  for (let index = 0; index < chunkCount; index += 1) {
    const rowIndex = startI + index * 2;
    if (rowIndex >= workRows) break;
    rows.push(necklineStartRc + rowIndex);
  }
  return rows;
}

function labeledNeckEdgeLines(
  plan: RoundNecklinePlanResult,
  necklineStartRc: number,
  bothEdges: boolean,
): string[] {
  const left = roundNeckPlanOneSideNeckEdgeWrittenLines(plan, "left", { necklineStartRc });
  const right = roundNeckPlanOneSideNeckEdgeWrittenLines(plan, "right", { necklineStartRc });
  if (!bothEdges) return right;
  if (left.join("\n") === right.join("\n")) {
    return left.map((line) => line.replace("At the neck edge", "At each neck edge"));
  }
  return [
    ...left.map((line) => line.replace("At the neck edge", "At the left neck edge")),
    ...right.map((line) => line.replace("At the neck edge", "At the right neck edge")),
  ];
}

function shoulderBindOffSentence(label: string, chunks: number[], rows: number[]): string[] {
  if (chunks.length === 0) return [];
  const fitted = chunks.slice(0, rows.length);
  const omitted = chunks.slice(rows.length);
  const lines = [
    `Work the ${label} shoulder at the armhole edge. Bind off on alternate rows: ${fitted.join(", then ")} ${stitchWord(fitted[0] ?? 0)}. Bind off on ${rcList(rows.slice(0, fitted.length))}.`,
  ];
  if (omitted.length > 0) {
    lines.push(
      `The remaining ${label} shoulder stitches (${omitted.join(", ")}) do not fit in the neckline rows.`,
    );
  }
  return lines;
}

function necklineLines(
  plan: RoundNecklinePlanResult,
  shoulderChunks: { left: number[]; right: number[] },
  necklineStartRc: number,
  necklineDepthRows: number,
  shoulderPlacementRows: number,
  stitchesAtShoulder: number,
  piece: "back" | "front",
): string[] {
  const center = roundNeckPlanCenterWrittenLine(plan);
  const rightRows = shoulderShapingRcs(
    necklineStartRc,
    necklineDepthRows,
    shoulderPlacementRows,
    shoulderChunks.right.length,
  );
  const lines = [
    `${formatRcColon(necklineStartRc)} Begin the neckline. ${stitchesAtShoulder} ${stitchWord(stitchesAtShoulder)} are on the needle.`,
  ];

  if (piece === "front") {
    lines.push("Place the opposite shoulder stitches on hold. Work one shoulder at a time.");
    if (center) lines.push(center);
    lines.push(...labeledNeckEdgeLines(plan, necklineStartRc, false));
    lines.push(...shoulderBindOffSentence("working", shoulderChunks.right, rightRows));
    const leftMatchesRight =
      shoulderChunks.left.join(",") === shoulderChunks.right.join(",");
    lines.push(
      leftMatchesRight
        ? "Return the held shoulder stitches to the needles and repeat the neckline shaping for the second shoulder, matching the first side."
        : `Return the held shoulder stitches to the needles and repeat the neckline shaping for the second shoulder. Bind off that shoulder on alternate rows: ${shoulderChunks.left.join(", then ")} ${stitchWord(shoulderChunks.left[0] ?? 0)}, on the same shaping rows.`,
    );
  } else {
    if (center) lines.push(center);
    lines.push(...labeledNeckEdgeLines(plan, necklineStartRc, true));
    const leftRows = rightRows
      .map((row) => row + 1)
      .filter((row) => row < necklineStartRc + necklineDepthRows);
    lines.push(...shoulderBindOffSentence("right", shoulderChunks.right, rightRows));
    lines.push(...shoulderBindOffSentence("left", shoulderChunks.left, leftRows));
    lines.push(
      "Bind off the right shoulder on the shaping row, then bind off the left shoulder on the return row. Do not bind off both shoulders on the same pass.",
    );
  }

  if (center?.includes("in hold")) {
    lines.push(roundNeckPlanFinishHeldStitchesLine());
  }
  return lines;
}

function bodyLines(result: SetInSleeveSweaterSuccess): CountLine[] {
  const { body } = result;
  const lines: CountLine[] = [
    {
      text: `${formatRcColon(0)} Cast on ${body.bodyBlock.hemStitches} ${stitchWord(body.bodyBlock.hemStitches)}.`,
      stitches: body.bodyBlock.hemStitches,
      rows: 0,
    },
    {
      text: `${formatRcColon(0)} Knit ${body.hemRows} ${rowWord(body.hemRows)} even for the hem (${inches(body.hemInches)}). The row counter will read ${formatRcColon(body.hemRows)}.`,
      stitches: body.bodyBlock.hemStitches,
      rows: body.hemRows,
    },
  ];
  const armholeRc = body.hemRows + body.rowsToArmhole;
  if (body.bodyBlock.shapingDirection === "none" || body.bodyBlock.shapingRowNumbers.length === 0) {
    lines.push({
      text: `${formatRcColon(body.hemRows)} Knit ${body.rowsToArmhole} ${rowWord(body.rowsToArmhole)} even to the armhole. The row counter will read ${formatRcColon(armholeRc)}. ${remain(body.stitchesAtUnderarm)}`,
      stitches: body.stitchesAtUnderarm,
      rows: body.rowsToArmhole,
    });
    return lines;
  }
  const verb = body.bodyBlock.shapingDirection === "decrease" ? "Decrease" : "Increase";
  lines.push({
    text: `${formatRcColon(body.hemRows)} Knit ${body.rowsToArmhole} ${rowWord(body.rowsToArmhole)} to the armhole. ${verb} 1 stitch at each side on ${rcList(body.bodyBlock.shapingRowNumbers)}. The row counter will read ${formatRcColon(armholeRc)}. ${remain(body.stitchesAtUnderarm)}`,
    stitches: body.stitchesAtUnderarm,
    rows: body.rowsToArmhole,
  });
  return lines;
}

function sleeveCapLines(cap: SetInSleeveCapSuccess, capStartRc: number): CountLine[] {
  const lines: CountLine[] = [];
  let rc = capStartRc;
  let stitches = cap.sleeve.upperArmStitches;
  lines.push({
    text: `${formatRcColon(rc)} Begin the sleeve cap. ${remain(stitches)}`,
    stitches,
    rows: 0,
  });

  const pushBindOff = (stitchesEachSide: number) => {
    const pair = bindOffPairLines(rc, stitches, stitchesEachSide, "sleeve-cap");
    for (const text of pair.lines) lines.push({ text, rows: 1 });
    rc = pair.rc;
    stitches = pair.stitches;
    const last = lines[lines.length - 1];
    if (last) last.stitches = stitches;
  };

  pushBindOff(cap.sleeve.initialBindOffStitchesEachSide);
  for (const stair of cap.sleeve.stairStepBindOffsEachSide) pushBindOff(stair);

  for (const zone of [
    cap.workingCap.zones.lower,
    cap.workingCap.zones.middle,
    cap.workingCap.zones.upper,
  ]) {
    for (const step of zone.steps) {
      const stepStart = rc;
      const actionRows = shapingActionRowNumbers(rc, step.times, step.everyRows);
      const removed = step.times * step.stitchesEachSide * 2;
      stitches -= removed;
      const interval =
        step.everyRows <= 1 ? "every row" : `every ${step.everyRows} ${rowWord(step.everyRows)}`;
      const zoneLabel = `${zone.name[0]!.toUpperCase()}${zone.name.slice(1)}`;
      lines.push({
        text: `${formatRcColon(stepStart)} ${zoneLabel} cap: decrease ${step.stitchesEachSide} ${stitchWord(step.stitchesEachSide)} at each edge ${interval} ${step.times} ${timeWord(step.times)}. One decrease is worked at each edge on the same row. Decrease on ${rcList(actionRows)}. ${remain(stitches)}`,
        stitches,
        rows: step.times * step.everyRows,
      });
      rc += step.times * step.everyRows;
    }
  }

  for (const step of cap.upperSlope.steps) {
    const pair = bindOffPairLines(rc, stitches, step.stitchesEachSide, "sleeve-cap");
    lines.push({
      text: `${pair.lines[0]} Upper slope.`,
      rows: 1,
    });
    lines.push({
      text: pair.lines[1] ?? "",
      stitches: pair.stitches,
      rows: 1,
    });
    rc = pair.rc;
    stitches = pair.stitches;
  }
  if (cap.upperSlope.plainRows > 0) {
    const endRc = rc + cap.upperSlope.plainRows;
    lines.push({
      text: `${formatRcColon(rc)} Knit ${cap.upperSlope.plainRows} ${rowWord(cap.upperSlope.plainRows)} even. The row counter will read ${formatRcColon(endRc)}. ${remain(stitches)}`,
      stitches,
      rows: cap.upperSlope.plainRows,
    });
    rc += cap.upperSlope.plainRows;
  }
  lines.push({
    text: `${formatRcColon(rc)} Bind off the remaining ${cap.totals.finalStitches} ${stitchWord(cap.totals.finalStitches)}.`,
    stitches: 0,
    rows: 0,
  });
  return lines;
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
): SetInInstructionCheck {
  const errors: string[] = [];
  const limitations: string[] = [...UNSUPPORTED.slice(0, 2)];
  if (result.sleeveDirection !== "cuff-up") limitations.push(UNSUPPORTED[2]);

  const armhole = result.body.armhole;
  const backNeckRows = result.body.neckline.back.necklineDepthRows;
  const frontNeckRows = result.body.neckline.front.necklineDepthRows;
  if (backNeckRows > armhole.straightRows) {
    errors.push("The back neckline is deeper than the straight armhole rows.");
  }
  if (frontNeckRows > armhole.straightRows) {
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
  const bindOffCount = (armhole.stairStepBindOffsEachSide.length + 1) * 2;
  const decreaseMention = armhole.decreaseStitchesEachSide === 0
    ? true
    : armholeLines.some((line) => line.includes("Decrease 1 stitch at each armhole edge every other row"));
  if (!decreaseMention) errors.push("Armhole decrease instructions are missing.");
  const carriageLines = armholeLines.filter((line) => line.includes("carriage-side armhole edge"));
  if (carriageLines.length !== armhole.stairStepBindOffsEachSide.length + 1) {
    errors.push("Each armhole bind-off is not written as its own pair of rows.");
  }
  if (bindOffCount !== armhole.bindOffRows) {
    errors.push("Armhole bind-off rows do not match the calculation.");
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

export function generateSetInSleeveInstructions(
  result: SetInSleeveSweaterSuccess,
): SetInSleevePatternInstructions {
  const armhole = result.body.armhole;
  const armholeText = setInArmholeInstructionLines(armhole, result.body.stitchesAtUnderarm);
  const necklineStartBack = armhole.totalRows - result.body.neckline.back.necklineDepthRows;
  const necklineStartFront = armhole.totalRows - result.body.neckline.front.necklineDepthRows;
  const shoulderChunks = {
    left: result.body.neckline.shoulderBindOff.leftChunks,
    right: result.body.neckline.shoulderBindOff.rightChunks,
  };
  const backNeck = necklineLines(
    result.body.neckline.back,
    shoulderChunks,
    necklineStartBack,
    result.body.neckline.back.necklineDepthRows,
    result.body.neckline.shoulderBindOff.placementRows,
    result.body.stitchesAtShoulder,
    "back",
  );
  const frontNeck = necklineLines(
    result.body.neckline.front,
    shoulderChunks,
    necklineStartFront,
    result.body.neckline.front.necklineDepthRows,
    result.body.neckline.shoulderBindOff.placementRows,
    result.body.stitchesAtShoulder,
    "front",
  );

  const evenBeforeBackNeck = armhole.straightRows - result.body.neckline.back.necklineDepthRows;
  const evenBeforeFrontNeck = armhole.straightRows - result.body.neckline.front.necklineDepthRows;
  const backArmhole = [...armholeText];
  const frontArmhole = [...armholeText];
  if (evenBeforeBackNeck >= 0) {
    backNeck.unshift(
      `After the armhole decreases, knit ${evenBeforeBackNeck} ${rowWord(evenBeforeBackNeck)} even. Begin the back neckline at ${formatRcColon(necklineStartBack)}. The neckline uses ${result.body.neckline.back.necklineDepthRows} ${rowWord(result.body.neckline.back.necklineDepthRows)} and finishes the armhole at ${formatRcColon(armhole.totalRows)}.`,
    );
  }
  if (evenBeforeFrontNeck >= 0) {
    frontNeck.unshift(
      `After the armhole decreases, knit ${evenBeforeFrontNeck} ${rowWord(evenBeforeFrontNeck)} even. Begin the front neckline at ${formatRcColon(necklineStartFront)}. The neckline uses ${result.body.neckline.front.necklineDepthRows} ${rowWord(result.body.neckline.front.necklineDepthRows)} and finishes the armhole at ${formatRcColon(armhole.totalRows)}.`,
    );
  }

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
  const shapingLines = formatDropShoulderSleeveShapingWrittenLines(
    "increase",
    cuffUp.steps,
    shapingRcs,
  );
  const spans = dropShoulderSleeveBodyRowSpans(sleeveChartInput);
  const capRecords = sleeveCapLines(result.sleeveCap, result.sleeve.rowsCuffToUpperArm);
  const checks = validate(result, armholeText, capRecords);
  const finalCapLine = capRecords[capRecords.length - 1]?.text ?? "";
  if (!finalCapLine.includes(`Bind off the remaining ${result.sleeveCap.totals.finalStitches}`)) {
    checks.errors.push("The final sleeve-cap bind-off does not match the calculation.");
    checks.ok = false;
  }
  if ([...backNeck, ...frontNeck].some((line) => line.includes("do not fit in the neckline rows"))) {
    checks.errors.push("Shoulder bind-offs do not fit in the neckline rows.");
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
      { heading: "HEM AND BODY", lines: bodyLines(result).map((line) => line.text) },
      { heading: "ARMHOLE", lines: backArmhole },
      { heading: "NECKLINE AND SHOULDERS", lines: backNeck },
    ],
  };
  const front: SetInInstructionSection = {
    id: "front",
    title: "Front",
    blocks: [
      { heading: "HEM AND BODY", lines: bodyLines(result).map((line) => line.text) },
      { heading: "ARMHOLE", lines: frontArmhole },
      { heading: "NECKLINE AND SHOULDERS", lines: frontNeck },
    ],
  };

  const sleeveBodyLines = [
    "Make 2.",
    `${formatRcColon(0)} Cast on ${result.sleeve.wristStitches} ${stitchWord(result.sleeve.wristStitches)} for the sleeve cuff.`,
    `${formatRcColon(0)} Knit ${result.sleeve.cuffRows} ${rowWord(result.sleeve.cuffRows)} even for the cuff (${inches(result.sleeve.cuffInches)}).`,
    CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET,
    `${formatRcColon(0)} Sleeve body. ${result.sleeve.wristStitches} ${stitchWord(result.sleeve.wristStitches)} remain.`,
  ];
  if (spans.rowsBeforeShaping > 0) {
    sleeveBodyLines.push(
      `${formatRcColon(0)} Knit ${spans.rowsBeforeShaping} ${rowWord(spans.rowsBeforeShaping)} even.`,
    );
  }
  sleeveBodyLines.push(...shapingLines);
  if (spans.rowsAfterShaping > 0) {
    sleeveBodyLines.push(
      `After the final increase, knit ${spans.rowsAfterShaping} ${rowWord(spans.rowsAfterShaping)} even. The sleeve-body row counter will read ${formatRcColon(result.sleeve.rowsCuffToUpperArm)}. ${remain(result.sleeve.upperArmStitches)}`,
    );
  } else {
    sleeveBodyLines.push(
      `${formatRcColon(result.sleeve.rowsCuffToUpperArm)} ${remain(result.sleeve.upperArmStitches)}`,
    );
  }

  const sleeves: SetInInstructionSection = {
    id: "sleeves",
    title: "Sleeves",
    blocks: [
      { heading: "CUFF AND SLEEVE BODY", lines: sleeveBodyLines },
      { heading: "SLEEVE CAP", lines: capRecords.map((line) => line.text) },
    ],
  };

  const finishing: SetInInstructionSection = {
    id: "finishing",
    title: "Finishing",
    blocks: [
      {
        lines: [
          "Block the pieces if you want to set the measurements before seaming.",
          "Join the shoulder seams. Machine seaming is recommended.",
          `Finish the round neckline from the ${result.body.neckline.openingStitches}-stitch neck opening.`,
          "Set the sleeves into the armholes. Match the underarm bind-offs and match the top of the sleeve cap to the shoulder seam.",
          "Join the side seams and the sleeve seams.",
          "Give the sweater a final press.",
        ],
      },
    ],
  };

  return {
    sections: [overview, back, front, sleeves, finishing],
    checks,
  };
}
