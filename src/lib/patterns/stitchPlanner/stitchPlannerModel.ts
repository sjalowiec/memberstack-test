/**
 * Printable stitch-planner geometry for Basic Socks and Christmas Stocking.
 *
 * The unfolded layout matches the construction diagram: toe above, foot, heel,
 * then leg below. Cell size comes from the pattern gauge already stored on
 * {@link BasicSockCalc}. Column and row counts come from that same calc.
 * This does not resize the presentation diagram and does not recalculate shaping.
 */

import { sockHoldOrientation, type SockOfPair } from "../sock/sockInstructionModel";
import type { BasicSockCalc } from "../sock/sockMath";

export type StitchPlannerFamily = "socks" | "christmas-stocking";

export type StitchPlannerMeta = {
  family: StitchPlannerFamily;
  patternName: string;
  /** Saved project title. Empty when the pattern still has its generic name. */
  projectName: string;
  sizeLabel: string;
  constructionLabel: string;
  gaugeLabel: string;
  displayUnit: "inches" | "cm";
  sock: SockOfPair;
};

export type StitchPlannerSectionId = "toe" | "foot" | "heel" | "ankle" | "leg";

export type StitchPlannerSection = {
  id: StitchPlannerSectionId;
  kind: "grid" | "plain";
  title: string;
  xIn: number;
  yIn: number;
  widthIn: number;
  heightIn: number;
  /** Widest row. Plain heel and toe use the tube stitch count and are not gridded. */
  columns: number;
  /** Knitted grid rows. Zero for the plain heel and toe. */
  rows: number;
  stitchesTopToBottom: number[];
  /** Row-counter reading after each knitted row, top to bottom. */
  rcTopToBottom: number[];
  /** Knitting proceeds toward the toe (up the page) or toward the cuff (down the page). */
  knitDirection: "up" | "down";
  /** Edge where this section's row counter is still 000. */
  rcOriginEdge: "top" | "bottom" | null;
  heldStitches: number;
  workingStitches: number;
  remainingStitches: number;
};

export type PlannerGridLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  weight: "fine" | "fifth" | "outline";
};

export type StitchPlannerModel = {
  meta: StitchPlannerMeta;
  cellWidthIn: number;
  cellHeightIn: number;
  soleOnRight: boolean;
  /** Rows drawn beyond the pattern's calculated totals. Always zero. */
  addedRows: 0;
  edgingIncludedInLegTotal: true;
  edgingNote: string;
  sections: StitchPlannerSection[];
  /** Sole / instep split through the toe, foot, and heel. */
  divider: { xIn: number; y1In: number; y2In: number } | null;
  footLabelBand: { yIn: number; heightIn: number };
  cuffBand: { yIn: number; heightIn: number };
  drawingWidthIn: number;
  drawingHeightIn: number;
  leftGutterIn: number;
  axisXIn: number;
};

export const STITCH_PLANNER_EDGING_NOTE =
  "Cuff edging is included in the leg total. Do not add extra rows.";

const LEFT_GUTTER_IN = 0.9;
const RIGHT_GUTTER_IN = 0.52;
const TOP_PAD_IN = 0.08;
/** Label space between the plain toe and the foot grid. Not knitted rows. */
const FOOT_LABEL_BAND_IN = 0.36;
/** Stitch numbers and the edging note under the cuff. Not knitted rows. */
const CUFF_BAND_IN = 0.62;

type RowEvent = { rowNumber: number; stitchesAfter: number };

function knitRowStitches(start: number, rows: number, events: readonly RowEvent[]): number[] {
  const afterRow = new Map<number, number>();
  for (const event of events) afterRow.set(event.rowNumber, event.stitchesAfter);
  const counts: number[] = [];
  let current = start;
  for (let row = 1; row <= rows; row += 1) {
    const after = afterRow.get(row);
    if (after != null) current = after;
    counts.push(current);
  }
  return counts;
}

function orientTopToBottom<T>(knitOrder: readonly T[], knitDirection: "up" | "down"): T[] {
  const copy = knitOrder.slice();
  return knitDirection === "up" ? copy.reverse() : copy;
}

function gridSection(args: {
  id: "foot" | "ankle" | "leg";
  title: string;
  stitchesKnitOrder: number[];
  rcStart: number;
  knitDirection: "up" | "down";
  rcOriginEdge: "top" | "bottom" | null;
}): StitchPlannerSection {
  const rcKnit = args.stitchesKnitOrder.map((_, index) => args.rcStart + index + 1);
  const stitchesTopToBottom = orientTopToBottom(args.stitchesKnitOrder, args.knitDirection);
  const rcTopToBottom = orientTopToBottom(rcKnit, args.knitDirection);
  const columns = stitchesTopToBottom.reduce((max, count) => Math.max(max, count), 0);
  return {
    id: args.id,
    kind: "grid",
    title: args.title,
    xIn: 0,
    yIn: 0,
    widthIn: 0,
    heightIn: 0,
    columns,
    rows: stitchesTopToBottom.length,
    stitchesTopToBottom,
    rcTopToBottom,
    knitDirection: args.knitDirection,
    rcOriginEdge: args.rcOriginEdge,
    heldStitches: 0,
    workingStitches: 0,
    remainingStitches: 0,
  };
}

function plainSection(args: {
  id: "toe" | "heel";
  title: string;
  columns: number;
  heldStitches: number;
  workingStitches: number;
  remainingStitches: number;
  heightIn: number;
}): StitchPlannerSection {
  return {
    id: args.id,
    kind: "plain",
    title: args.title,
    xIn: 0,
    yIn: 0,
    widthIn: 0,
    heightIn: args.heightIn,
    columns: args.columns,
    rows: 0,
    stitchesTopToBottom: [],
    rcTopToBottom: [],
    knitDirection: "up",
    rcOriginEdge: null,
    heldStitches: args.heldStitches,
    workingStitches: args.workingStitches,
    remainingStitches: args.remainingStitches,
  };
}

function sockSections(calc: BasicSockCalc): StitchPlannerSection[] {
  const knitUp = calc.constructionDirection === "cuff-to-toe";
  const knitDirection: "up" | "down" = knitUp ? "up" : "down";
  const tube = calc.totalSockStitches;
  const footCounts = Array.from({ length: calc.straightFootRows }, () => tube);
  const sections: StitchPlannerSection[] = [
    plainSection({
      id: "toe",
      title: "Toe",
      columns: tube,
      heldStitches: calc.toe.heldStitches,
      workingStitches: calc.toe.workingStitches,
      remainingStitches: calc.toe.remainingStitches,
      heightIn: calc.toeDepthInches,
    }),
    {
      ...gridSection({
        id: "foot",
        title: "Foot",
        stitchesKnitOrder: footCounts,
        rcStart: 0,
        knitDirection,
        rcOriginEdge: knitUp ? "bottom" : "top",
      }),
      heightIn: 0,
    },
    plainSection({
      id: "heel",
      title: "Heel",
      columns: tube,
      heldStitches: calc.heel.heldStitches,
      workingStitches: calc.heel.workingStitches,
      remainingStitches: calc.heel.remainingStitches,
      heightIn: calc.heelDepthInches,
    }),
  ];

  const legRows = calc.legShapingRowsAvailable;
  const ankleRows = calc.ankleStraightRows;
  if (ankleRows > 0) {
    sections.push({
      ...gridSection({
        id: "ankle",
        title: "Ankle",
        stitchesKnitOrder: Array.from({ length: ankleRows }, () => calc.ankleStitches),
        rcStart: knitUp ? legRows : 0,
        knitDirection,
        rcOriginEdge: knitUp ? (legRows > 0 ? null : "bottom") : "top",
      }),
      heightIn: 0,
    });
  }
  if (legRows > 0) {
    const schedule = calc.legShapingSchedule.knitOrder;
    sections.push({
      ...gridSection({
        id: "leg",
        title: "Leg",
        stitchesKnitOrder: knitRowStitches(schedule.startStitches, legRows, schedule.events),
        rcStart: 0,
        knitDirection,
        rcOriginEdge: knitUp ? "bottom" : "top",
      }),
      heightIn: 0,
    });
  }
  return sections;
}

function stockingSections(calc: BasicSockCalc): StitchPlannerSection[] {
  const knitUp = calc.constructionDirection === "cuff-to-toe";
  const knitDirection: "up" | "down" = knitUp ? "up" : "down";
  const tube = calc.totalSockStitches;
  return [
    plainSection({
      id: "toe",
      title: "Toe",
      columns: tube,
      heldStitches: calc.toe.heldStitches,
      workingStitches: calc.toe.workingStitches,
      remainingStitches: calc.toe.remainingStitches,
      heightIn: calc.toeDepthInches,
    }),
    {
      ...gridSection({
        id: "foot",
        title: "Foot",
        stitchesKnitOrder: Array.from({ length: calc.straightFootRows }, () => tube),
        rcStart: 0,
        knitDirection,
        rcOriginEdge: knitUp ? "bottom" : "top",
      }),
      heightIn: 0,
    },
    plainSection({
      id: "heel",
      title: "Heel",
      columns: tube,
      heldStitches: calc.heel.heldStitches,
      workingStitches: calc.heel.workingStitches,
      remainingStitches: calc.heel.remainingStitches,
      heightIn: calc.heelDepthInches,
    }),
    {
      ...gridSection({
        id: "leg",
        title: "Leg",
        stitchesKnitOrder: Array.from({ length: calc.legRows }, () => calc.legStitches),
        rcStart: 0,
        knitDirection,
        rcOriginEdge: knitUp ? "bottom" : "top",
      }),
      heightIn: 0,
    },
  ];
}

export function buildStitchPlannerModel(
  calc: BasicSockCalc,
  meta: StitchPlannerMeta,
): StitchPlannerModel {
  const sock: SockOfPair = meta.family === "christmas-stocking" ? 1 : meta.sock;
  const soleOnRight = sockHoldOrientation(sock, "heel").workHalf === "right";
  const cellWidthIn = 1 / calc.stGaugePerInch;
  const cellHeightIn = 1 / calc.rowGaugePerInch;
  const sections =
    meta.family === "christmas-stocking" ? stockingSections(calc) : sockSections(calc);

  let columns = 0;
  for (const section of sections) columns = Math.max(columns, section.columns);
  const axisWidth = columns * cellWidthIn;
  const axisXIn = LEFT_GUTTER_IN;

  let y = TOP_PAD_IN;
  let footLabelBand = { yIn: y, heightIn: FOOT_LABEL_BAND_IN };
  for (const section of sections) {
    if (section.id === "foot") {
      footLabelBand = { yIn: y, heightIn: FOOT_LABEL_BAND_IN };
      y += FOOT_LABEL_BAND_IN;
    }
    section.xIn = axisXIn + (axisWidth - section.columns * cellWidthIn) / 2;
    section.yIn = y;
    section.widthIn = section.columns * cellWidthIn;
    if (section.kind === "grid") section.heightIn = section.rows * cellHeightIn;
    y += section.heightIn;
  }
  const cuffBand = { yIn: y, heightIn: CUFF_BAND_IN };
  y += CUFF_BAND_IN;

  const toe = sections.find((section) => section.id === "toe");
  const heel = sections.find((section) => section.id === "heel");
  const foot = sections.find((section) => section.id === "foot");
  let divider: StitchPlannerModel["divider"] = null;
  if (toe && heel && foot) {
    const leftHalf = soleOnRight ? calc.heel.heldStitches : calc.heel.workingStitches;
    divider = {
      xIn: foot.xIn + leftHalf * cellWidthIn,
      y1In: toe.yIn,
      y2In: heel.yIn + heel.heightIn,
    };
  }

  return {
    meta: { ...meta, sock },
    cellWidthIn,
    cellHeightIn,
    soleOnRight,
    addedRows: 0,
    edgingIncludedInLegTotal: true,
    edgingNote: STITCH_PLANNER_EDGING_NOTE,
    sections,
    divider,
    footLabelBand,
    cuffBand,
    drawingWidthIn: LEFT_GUTTER_IN + axisWidth + RIGHT_GUTTER_IN,
    drawingHeightIn: y,
    leftGutterIn: LEFT_GUTTER_IN,
    axisXIn,
  };
}

type LaidRow = {
  index: number;
  rc: number;
  stitches: number;
  inset: number;
  x: number;
  y: number;
  width: number;
};

function laidRows(
  section: StitchPlannerSection,
  cellWidthIn: number,
  cellHeightIn: number,
): LaidRow[] {
  return section.stitchesTopToBottom.map((stitches, index) => {
    const inset = (section.columns - stitches) / 2;
    const x = section.xIn + inset * cellWidthIn;
    return {
      index,
      rc: section.rcTopToBottom[index] ?? index + 1,
      stitches,
      inset,
      x,
      y: section.yIn + index * cellHeightIn,
      width: stitches * cellWidthIn,
    };
  });
}

/**
 * One line per stitch and row boundary. Straight sections are rectangles.
 * A shaped leg steps in by the stitch counts already on the Magic Formula schedule.
 */
export function stitchPlannerSectionGridLines(
  section: StitchPlannerSection,
  cellWidthIn: number,
  cellHeightIn: number,
): PlannerGridLine[] {
  if (section.kind !== "grid" || section.rows < 1 || section.columns < 1) return [];
  const rows = laidRows(section, cellWidthIn, cellHeightIn);
  const lines: PlannerGridLine[] = [];

  for (let boundary = 0; boundary <= section.columns; boundary += 1) {
    const x = section.xIn + boundary * cellWidthIn;
    let run: { y1: number; y2: number; weight: PlannerGridLine["weight"] } | null = null;
    const flush = () => {
      if (!run) return;
      lines.push({ x1: x, x2: x, y1: run.y1, y2: run.y2, weight: run.weight });
      run = null;
    };
    for (const row of rows) {
      const end = row.inset + row.stitches;
      let weight: PlannerGridLine["weight"] | null = null;
      if (boundary === row.inset || boundary === end) weight = "outline";
      else if (boundary > row.inset && boundary < end) {
        weight = boundary % 5 === 0 ? "fifth" : "fine";
      }
      const y1 = row.y;
      const y2 = row.y + cellHeightIn;
      if (weight == null) {
        flush();
        continue;
      }
      if (run && run.weight === weight && Math.abs(run.y2 - y1) < 1e-6) run.y2 = y2;
      else {
        flush();
        run = { y1, y2, weight };
      }
    }
    flush();
  }

  for (let boundary = 0; boundary <= rows.length; boundary += 1) {
    const above = boundary > 0 ? rows[boundary - 1] : null;
    const below = boundary < rows.length ? rows[boundary] : null;
    const y = section.yIn + boundary * cellHeightIn;
    if (!above || !below) {
      const edge = above ?? below;
      if (!edge) continue;
      lines.push({
        x1: edge.x,
        x2: edge.x + edge.width,
        y1: y,
        y2: y,
        weight: "outline",
      });
      continue;
    }
    const left = Math.min(above.x, below.x);
    const right = Math.max(above.x + above.width, below.x + below.width);
    const innerLeft = Math.max(above.x, below.x);
    const innerRight = Math.min(above.x + above.width, below.x + below.width);
    if (innerLeft > left + 1e-6) {
      lines.push({ x1: left, x2: innerLeft, y1: y, y2: y, weight: "outline" });
    }
    if (right > innerRight + 1e-6) {
      lines.push({ x1: innerRight, x2: right, y1: y, y2: y, weight: "outline" });
    }
    if (innerRight > innerLeft + 1e-6) {
      const endsHere = rows.some((row) => {
        const endBoundary = section.knitDirection === "up" ? row.index : row.index + 1;
        return endBoundary === boundary && row.rc % 5 === 0;
      });
      lines.push({
        x1: innerLeft,
        x2: innerRight,
        y1: y,
        y2: y,
        weight: endsHere ? "fifth" : "fine",
      });
    }
  }

  return lines;
}
