/**
 * Written instructions for an adult set-in sleeve pullover.
 *
 * Armhole and sleeve-cap numbers come from the approved Step 4 calculations.
 * Neckline and shoulder lines come from the sleeveless timeline and its
 * instruction functions. Hem, cuff, and finishing wording follow the existing
 * sweater pattern lines. Cardigan fronts, V-necklines, and top-down sleeve
 * wording are not written here.
 */

import { CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET } from "../legoBlocks/cuffUpSleeveRowCounter";
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
  dropShoulderSleeveShapingRcSequence,
} from "../dropShoulderSleeveShapingChart";
import { dropShoulderSleeveShapingPlan } from "../dropShoulderSleeveShaping";
import { shapingActionRowNumbers } from "../evenShapingSchedule";
import { buildNeckShoulderTimelineAndChartRows } from "../neckShoulderShapingChartRows";
import { roundNeckBackShallowSleevelessSummaryWrittenLines } from "../roundNeckPlanPresentation";
import {
  ARMHOLE_RC_FROM_RESET_NOTE,
  formatCenterNecklineBindOffShapingExecution,
  formatCenterNecklineHoldShapingExecution,
  formatRcColon,
} from "../sleevelessPatternOutput";
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
  armhole: SetInSleeveCapSuccess["armhole"],
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

function sleeveCapLines(cap: SetInSleeveCapSuccess, capStartRc: number): CountLine[] {
  const lines: CountLine[] = [];
  let rc = capStartRc;
  let stitches = cap.sleeve.upperArmStitches;
  lines.push({
    text: `${formatRcColon(rc)} Begin the sleeve cap. The counter reads ${formatRcColon(rc)} before the next row. ${remain(stitches)}`,
    stitches,
    rows: 0,
  });

  const bindOffs = groupedBindOffLines(rc, stitches, [
    cap.sleeve.initialBindOffStitchesEachSide,
    ...cap.sleeve.stairStepBindOffsEachSide,
  ]);
  for (const text of bindOffs.lines) lines.push({ text, rows: 0 });
  const bindOffRowTotal = bindOffs.rows;
  if (lines.length > 1) {
    lines[lines.length - 1]!.rows = bindOffRowTotal;
    lines[lines.length - 1]!.stitches = bindOffs.stitches;
  }
  rc = bindOffs.rc;
  stitches = bindOffs.stitches;

  for (const zone of [
    cap.workingCap.zones.lower,
    cap.workingCap.zones.middle,
    cap.workingCap.zones.upper,
  ]) {
    for (const step of zone.steps) {
      const written = pairedDecreaseLine(
        rc,
        stitches,
        step.stitchesEachSide,
        step.everyRows,
        step.times,
        "sleeve-cap",
      );
      const zoneLabel = `${zone.name[0]!.toUpperCase()}${zone.name.slice(1)} cap`;
      lines.push({
        text: written.text.replace("Decrease", `${zoneLabel}: decrease`),
        stitches: written.stitches,
        rows: written.rows,
      });
      rc = written.rc;
      stitches = written.stitches;
    }
  }

  const slopeAmounts: number[] = [];
  for (const step of cap.upperSlope.steps) slopeAmounts.push(step.stitchesEachSide);
  if (slopeAmounts.length > 0) {
    const slope = groupedBindOffLines(rc, stitches, slopeAmounts);
    slope.lines[0] = `${slope.lines[0]} Upper slope.`;
    for (const text of slope.lines) lines.push({ text, rows: 0 });
    lines[lines.length - 1]!.rows = slope.rows;
    lines[lines.length - 1]!.stitches = slope.stitches;
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
  return lines;
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

  const sleeveBodyLines = [
    "Make 2.",
    `${formatRcColon(0)} Cast on ${result.sleeve.wristStitches} ${stitchWord(result.sleeve.wristStitches)} for the sleeve cuff.`,
    knitInPatternTo(0, result.sleeve.cuffRows) + ` Cuff, ${inches(result.sleeve.cuffInches)}.`,
    CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET,
    `${formatRcColon(0)} Sleeve body. ${remain(result.sleeve.wristStitches)}`,
  ];
  if (shapingRcs.length === 0) {
    sleeveBodyLines.push(
      `${knitInPatternTo(0, result.sleeve.rowsCuffToUpperArm)} ${remain(result.sleeve.upperArmStitches)}`,
    );
  } else {
    const first = shapingRcs[0]!;
    const last = shapingRcs[shapingRcs.length - 1]!;
    if (first > 0) {
      sleeveBodyLines.push(
        `${knitInPatternTo(0, first)} The counter reads ${formatRcColon(first)} before the next row.`,
      );
    }
    const stepPhrase = cuffUp.steps
      .filter((step) => step.times > 0 && step.rows > 0)
      .map((step) => `every ${step.rows} ${rowWord(step.rows)} ${step.times} ${step.times === 1 ? "time" : "times"}`)
      .join(", then ");
    sleeveBodyLines.push(
      `${formatRcColon(first)} Increase 1 stitch at each side ${stepPhrase}. Work each increase when the counter reads ${rcList(shapingRcs)}, before knitting that row. Knit the rows between those readings even.`,
    );
    const afterStart = last + 1;
    const afterRows = result.sleeve.rowsCuffToUpperArm - afterStart;
    if (afterRows > 0) {
      sleeveBodyLines.push(
        `${knitInPatternTo(afterStart, afterRows)} ${remain(result.sleeve.upperArmStitches)}`,
      );
    } else {
      sleeveBodyLines.push(
        `${formatRcColon(result.sleeve.rowsCuffToUpperArm)} ${remain(result.sleeve.upperArmStitches)}`,
      );
    }
  }

  const sleeves: SetInInstructionSection = {
    id: "sleeves",
    title: "Sleeves",
    blocks: [
      { heading: "CUFF", lines: sleeveBodyLines },
      { heading: "SLEEVE CAP", lines: capRecords.map((line) => line.text) },
    ],
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
