/**
 * Cumulative row-counter landmarks for Shaping Notation diagrams.
 *
 * Labels use the written-instruction form (`RC: 000`). Positions come from the
 * same event lists as the written schedule. Repeated intervals stay as compact
 * notation; only the start, each schedule change, the last action, and the
 * section end are marked.
 */

import { compressSlopeSequence } from "./legoBlocks/slopeShaping";
import {
  dropShoulderSleeveShapingPlanForDirection,
} from "./dropShoulderSleeveShaping";
import {
  dropShoulderSleeveShapingRcSequence,
  type DropShoulderSleeveShapingChartInput,
} from "./dropShoulderSleeveShapingChart";
import { formatRcColon } from "./sleevelessPatternOutput";
import { formatRcNotation } from "./sleevelessBackJapaneseNotation";
import type { RowBasedShapingNotation } from "./shapingNotationCompress";
import {
  shortRowActionRowCounters,
  sidewaysBodyRowLandmarks,
  type SidewaysCardiganGarmentStyle,
  type SidewaysCardiganSectionRowCounts,
} from "./sidewaysCardiganBodyInstructions";
import type { SidewaysCardiganBodyCalc } from "./sidewaysCardiganBodyCalc";

export type ShapingNotationRcDirection = "cuff-up" | "top-down" | "bottom-up";

export type ShapingNotationRcLandmark = {
  rowCounter: number;
  /** Action at this counter: cast-on, cuff, first shaping, schedule change, final shaping, armhole, back-neck, bind-off. */
  label: string;
  /** 0 at the knitting start, 1 at the knitting end. */
  position: number;
  direction: ShapingNotationRcDirection;
  /** Lower numbers stay when two landmarks would otherwise stack on one row. */
  priority: number;
  /**
   * Diagram feature this counter belongs to. Sideways uses section anchors because
   * the silhouette is scaled in inches, not rows.
   */
  anchor?: string;
  /** 0 at the start of `anchor`, 1 at its end. */
  sectionPosition?: number;
};

const RC_REQUIRED = "Row-based shaping notation requires a starting RC and a final RC.";

/** Written-instruction row counter: `RC: 000`, `RC: 020`, `RC: 119`. */
export function formatShapingNotationRcLabel(rc: number): string {
  return formatRcColon(rc);
}

/**
 * Sleeveless and Socks already draw cumulative counters with {@link formatRcNotation}
 * (`rc000`). That is the same zero-padded counter, kept on those diagrams.
 */
export function formatEstablishedDiagramRcLabel(rc: number): string {
  return formatRcNotation(rc);
}

export function requireShapingRcLandmarks(
  landmarks: readonly ShapingNotationRcLandmark[],
): ShapingNotationRcLandmark[] {
  const start = landmarks.some((mark) => mark.label === "cast-on");
  const end = landmarks.some((mark) => mark.label === "bind-off");
  if (!start || !end) throw new Error(RC_REQUIRED);
  const startRc = landmarks.find((mark) => mark.label === "cast-on")!;
  const endRc = landmarks.find((mark) => mark.label === "bind-off")!;
  if (!Number.isFinite(startRc.rowCounter) || !Number.isFinite(endRc.rowCounter)) {
    throw new Error(RC_REQUIRED);
  }
  return [...landmarks];
}

/** Reject a row-based section whose landmarks cannot name the start and the end. */
export function assertRowBasedShapingRcLandmarks(
  section: RowBasedShapingNotation,
  landmarks: readonly ShapingNotationRcLandmark[],
): ShapingNotationRcLandmark[] {
  if (section.kind !== "row-based" || !Number.isFinite(section.totalRows)) {
    throw new Error(RC_REQUIRED);
  }
  return requireShapingRcLandmarks(landmarks);
}

function positionOf(rc: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.max(0, Math.min(1, rc / total));
}

function mark(
  rowCounter: number,
  label: string,
  total: number,
  direction: ShapingNotationRcDirection,
  priority: number,
): ShapingNotationRcLandmark {
  return {
    rowCounter,
    label,
    position: positionOf(rowCounter, total),
    direction,
    priority,
  };
}

function dedupeByCounter(landmarks: readonly ShapingNotationRcLandmark[]): ShapingNotationRcLandmark[] {
  const byRc = new Map<number, ShapingNotationRcLandmark>();
  for (const landmark of landmarks) {
    const prev = byRc.get(landmark.rowCounter);
    if (!prev || landmark.priority < prev.priority) byRc.set(landmark.rowCounter, landmark);
  }
  return [...byRc.values()].sort((a, b) => a.rowCounter - b.rowCounter || a.priority - b.priority);
}

/**
 * Sleeve landmarks from {@link dropShoulderSleeveShapingRcSequence} and the
 * written cuff / bind-off counters. Does not add interval spans.
 */
export function sleeveShapingRcLandmarks(
  input: DropShoulderSleeveShapingChartInput,
): ShapingNotationRcLandmark[] {
  if (!Number.isFinite(input.sleeveTotalRows) || input.sleeveTotalRows < 0) {
    throw new Error(RC_REQUIRED);
  }
  const total = Math.max(0, Math.floor(input.sleeveTotalRows));
  const direction = input.direction === "top-down" ? "top-down" : "cuff-up";
  const sequence = dropShoulderSleeveShapingRcSequence(input);
  const plan = dropShoulderSleeveShapingPlanForDirection(
    {
      topSts: input.topSts,
      wristSts: input.wristSts,
      sleeveBodyRows: input.sleeveBodyRows,
    },
    direction,
  );
  const steps = plan.steps.filter((step) => step.times > 0 && step.rows > 0);
  const marks: ShapingNotationRcLandmark[] = [
    mark(0, "cast-on", total, direction, 0),
  ];
  if (direction === "cuff-up" && input.cuffRows > 0) {
    marks.push(mark(input.cuffRows, "cuff", total, direction, 1));
  }
  let index = 0;
  steps.forEach((step, stepIndex) => {
    const rc = sequence[index];
    if (rc === undefined) return;
    marks.push(
      mark(
        rc,
        stepIndex === 0 ? "first-shaping" : "schedule-change",
        total,
        direction,
        2,
      ),
    );
    index += step.times;
  });
  const last = sequence[sequence.length - 1];
  const first = sequence[0];
  if (last !== undefined && last !== first) {
    marks.push(mark(last, "final-shaping", total, direction, 2));
  }
  if (direction === "top-down" && input.cuffRows > 0) {
    marks.push(mark(input.sleeveBodyRows, "cuff", total, direction, 1));
  }
  marks.push(mark(total, "bind-off", total, direction, 0));
  return requireShapingRcLandmarks(dedupeByCounter(marks));
}

function phaseMarks(args: {
  sequence: readonly number[];
  actionRcs: readonly number[];
  firstLabel: string;
  changeLabel: string;
  finalLabel: string;
  total: number;
  anchor: string;
  sectionStart: number;
  sectionRows: number;
}): ShapingNotationRcLandmark[] {
  const steps = compressSlopeSequence(args.sequence);
  const marks: ShapingNotationRcLandmark[] = [];
  const withSection = (landmark: ShapingNotationRcLandmark): ShapingNotationRcLandmark => ({
    ...landmark,
    anchor: args.anchor,
    sectionPosition:
      args.sectionRows > 0
        ? Math.max(0, Math.min(1, (landmark.rowCounter - args.sectionStart) / args.sectionRows))
        : 0,
  });
  let index = 0;
  steps.forEach((step, stepIndex) => {
    const rc = args.actionRcs[index];
    if (rc === undefined) return;
    marks.push(
      withSection(
        mark(rc, stepIndex === 0 ? args.firstLabel : args.changeLabel, args.total, "bottom-up", 2),
      ),
    );
    index += step.times;
  });
  const first = args.actionRcs[0];
  const last = args.actionRcs[args.actionRcs.length - 1];
  if (last !== undefined && last !== first) {
    marks.push(withSection(mark(last, args.finalLabel, args.total, "bottom-up", 3)));
  }
  return marks;
}

/**
 * Sideways garment landmarks from the written section counters and V-neck
 * action row counters. Cardigan and pullover each keep only the seams they knit.
 */
export function sidewaysGarmentRcLandmarks(args: {
  garmentStyle: SidewaysCardiganGarmentStyle;
  calc: SidewaysCardiganBodyCalc;
  increaseSequence: readonly number[];
  decreaseSequence: readonly number[];
}): ShapingNotationRcLandmark[] {
  const counts: SidewaysCardiganSectionRowCounts = {
    firstVNeck: args.calc.bodyRowSequence.firstFrontVNeckShapingRows,
    firstFrontShoulder: args.calc.bodyRowSequence.firstFrontShoulderRows,
    firstBackShoulder: args.calc.bodyRowSequence.firstBackShoulderRows,
    backNeckOpening: args.calc.bodyRowSequence.backNeckOpeningRows,
    secondBackShoulder: args.calc.bodyRowSequence.secondBackShoulderRows,
    secondFrontShoulder: args.calc.bodyRowSequence.secondFrontShoulderRows,
    secondVNeck: args.calc.bodyRowSequence.secondFrontVNeckShapingRows,
  };
  const landmarks = sidewaysBodyRowLandmarks(args.garmentStyle, counts);
  const total = landmarks.finalBindOff;
  if (!Number.isFinite(total) || total < 0) throw new Error(RC_REQUIRED);
  const pullover = args.garmentStyle === "pullover";
  const firstStart = pullover ? landmarks.startFinalVShaping : 0;
  const secondStart = pullover ? landmarks.endFirstVShaping : landmarks.startFinalVShaping;
  const firstSequence = pullover ? args.decreaseSequence : args.increaseSequence;
  const secondSequence = pullover ? args.increaseSequence : args.decreaseSequence;
  const firstActions = shortRowActionRowCounters(
    firstStart + (pullover ? 0 : 2),
    2,
    firstSequence.length,
  );
  const secondActions = shortRowActionRowCounters(
    secondStart + (pullover ? 2 : 0),
    2,
    secondSequence.length,
  );
  const castOn = mark(0, "cast-on", total, "bottom-up", 0);
  const bindOff = mark(total, "bind-off", total, "bottom-up", 0);
  const marks: ShapingNotationRcLandmark[] = [
    { ...castOn, anchor: "cast-on", sectionPosition: 0 },
    ...phaseMarks({
      sequence: firstSequence,
      actionRcs: firstActions,
      firstLabel: "first-shaping",
      changeLabel: "schedule-change",
      finalLabel: "final-shaping",
      total,
      anchor: "v1",
      sectionStart: firstStart,
      sectionRows: counts.firstVNeck,
    }),
  ];
  if (!pullover && landmarks.firstSideSeam > 0) {
    marks.push({
      ...mark(landmarks.firstSideSeam, "armhole", total, "bottom-up", 1),
      anchor: "armhole-1",
      sectionPosition: 0,
    });
  }
  if (landmarks.firstBackNeckEdge > 0) {
    marks.push({
      ...mark(landmarks.firstBackNeckEdge, "back-neck", total, "bottom-up", 1),
      anchor: "neck-1",
      sectionPosition: 0,
    });
  }
  if (landmarks.secondBackNeckEdge > landmarks.firstBackNeckEdge) {
    marks.push({
      ...mark(landmarks.secondBackNeckEdge, "back-neck", total, "bottom-up", 1),
      anchor: "neck-2",
      sectionPosition: 0,
    });
  }
  if (landmarks.secondSideSeam > 0) {
    marks.push({
      ...mark(landmarks.secondSideSeam, "armhole", total, "bottom-up", 1),
      anchor: "armhole-2",
      sectionPosition: 0,
    });
  }
  marks.push(
    ...phaseMarks({
      sequence: secondSequence,
      actionRcs: secondActions,
      firstLabel: "first-shaping",
      changeLabel: "schedule-change",
      finalLabel: "final-shaping",
      total,
      anchor: "v2",
      sectionStart: secondStart,
      sectionRows: counts.secondVNeck,
    }),
  );
  marks.push({ ...bindOff, anchor: "bind-off", sectionPosition: 1 });
  return requireShapingRcLandmarks(dedupeByCounter(marks));
}

export type ShapingNotationRcPlacement = {
  x: number;
  y: number;
  anchor?: "start" | "middle" | "end";
  size?: number;
};

/** Keep labels at least one line apart along Y. */
/** Place a sleeve counter on the row-scaled cuff-up or top-down frame. */
export function sleeveRcLandmarkY(args: {
  direction: "cuff-up" | "top-down";
  landmark: ShapingNotationRcLandmark;
  wristY: number;
  upperArmY: number;
  cuffJoinY: number;
  cuffRows: number;
  sleeveBodyRows: number;
}): number {
  const { landmark } = args;
  if (landmark.label === "cast-on") {
    return args.direction === "top-down" ? args.upperArmY : args.wristY;
  }
  if (landmark.label === "bind-off") {
    return args.direction === "top-down" ? args.wristY : args.upperArmY;
  }
  if (landmark.label === "cuff") return args.cuffJoinY;
  const bodyRows = Math.max(1, args.sleeveBodyRows);
  if (args.direction === "top-down") {
    const t = Math.max(0, Math.min(1, landmark.rowCounter / bodyRows));
    return args.upperArmY + (args.cuffJoinY - args.upperArmY) * t;
  }
  const t = Math.max(0, Math.min(1, (landmark.rowCounter - args.cuffRows) / bodyRows));
  return args.cuffJoinY + (args.upperArmY - args.cuffJoinY) * t;
}

export function spreadRcLabelYs(
  ys: readonly number[],
  gap: number,
): number[] {
  const out: number[] = [];
  for (const y of ys) {
    const prev = out[out.length - 1];
    out.push(prev === undefined ? y : Math.max(y, prev + gap));
  }
  return out;
}

export function shapingNotationRcText(args: {
  landmark: ShapingNotationRcLandmark;
  x: number;
  y: number;
  size: number;
  anchor?: "start" | "middle" | "end";
  fill: string;
  font: string;
  escape: (text: string) => string;
  formatNumber: (n: number) => string;
}): string {
  const label = formatShapingNotationRcLabel(args.landmark.rowCounter);
  const anchor = args.anchor ?? "end";
  return (
    `<text data-role="rc-landmark" data-rc-label="${args.escape(args.landmark.label)}" ` +
    `data-rc="${args.escape(label)}" data-row-counter="${args.landmark.rowCounter}" ` +
    `data-rc-position="${args.formatNumber(args.landmark.position)}" ` +
    `x="${args.formatNumber(args.x)}" y="${args.formatNumber(args.y)}" ` +
    `text-anchor="${anchor}" dominant-baseline="middle" fill="${args.fill}" ` +
    `font-family="${args.font}" font-size="${args.size}">${args.escape(label)}</text>`
  );
}
