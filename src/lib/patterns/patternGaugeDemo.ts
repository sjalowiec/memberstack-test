/**
 * Marketing gauge demonstration on `/patterns`.
 * A fixed Drop Shoulder sleeve at three sample gauges. These gauges are not Pattern Builder limits.
 */
import { calculateDropShoulderSleevePieceNumbers } from "./dropShoulderSleevePieceNumbers";
import {
  dropShoulderSleeveBodyRowSpans,
  dropShoulderSleeveShapingRcSequence,
} from "./dropShoulderSleeveShapingChart";
import {
  dropShoulderSleeveShapingBreakdown,
  dropShoulderSleeveShapingPlan,
  formatDropShoulderSleeveShapingWrittenLines,
} from "./dropShoulderSleeveShaping";
import { buildDropShoulderSleeveDisplayRows } from "./dropShoulderPatternOutput";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { sleeveShapingPerSide } from "./evenShapingSchedule";
import {
  resolveDropShoulderFinishedUpperArmInches,
  resolveDropShoulderFinishedWristInches,
} from "./dropShoulderSleeveEase";
import { getDefaultCuffLengthInches } from "./hemDefaults";
import { rawSwatchToPerInch } from "./rawSwatchGauge";

export const GAUGE_DEMO_WIDTH_INCHES = 4;
export const GAUGE_DEMO_LENGTH_INCHES = 4;

export const GAUGE_DEMO_STITCH_MIN = 12;
export const GAUGE_DEMO_STITCH_DEFAULT = 20;
export const GAUGE_DEMO_STITCH_MAX = 48;

export const GAUGE_DEMO_ROW_MIN = 16;
export const GAUGE_DEMO_ROW_DEFAULT = 28;
export const GAUGE_DEMO_ROW_MAX = 64;

/** Square SVG drawing box. The on-screen size stays constant; only the tile size changes. */
export const GAUGE_DEMO_FABRIC_WIDTH = 360;
export const GAUGE_DEMO_FABRIC_HEIGHT = 360;

/** Below this stitch width, draw a straight V so fine gauges stay a texture, not a blob. */
export const GAUGE_DEMO_SIMPLIFY_STITCH_WIDTH = 9;

/** The only gauges the demonstration offers. The middle sample is the default. */
export const GAUGE_DEMO_SAMPLES = [
  { stitches: 16, rows: 24, label: "16 stitches / 24 rows" },
  { stitches: 20, rows: 28, label: "20 stitches / 28 rows" },
  { stitches: 32, rows: 44, label: "32 stitches / 44 rows" },
] as const;

export type GaugeDemoState = {
  stitchesPer4: number;
  rowsPer4: number;
  castOn: number;
  knitRows: number;
};

export type GaugeDemoFabric = {
  svgWidth: number;
  svgHeight: number;
  stitchWidth: number;
  rowHeight: number;
  patternWidth: number;
  patternHeight: number;
  simplified: boolean;
  stitchPath: string;
  strokeWidth: number;
};

function clampWhole(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

export function resolveGaugeDemoState(stitchesPer4: unknown, rowsPer4: unknown): GaugeDemoState {
  const stitchesPer4Inches = clampWhole(
    stitchesPer4,
    GAUGE_DEMO_STITCH_MIN,
    GAUGE_DEMO_STITCH_MAX,
    GAUGE_DEMO_STITCH_DEFAULT,
  );
  const rowsPer4Inches = clampWhole(
    rowsPer4,
    GAUGE_DEMO_ROW_MIN,
    GAUGE_DEMO_ROW_MAX,
    GAUGE_DEMO_ROW_DEFAULT,
  );
  return {
    stitchesPer4: stitchesPer4Inches,
    rowsPer4: rowsPer4Inches,
    castOn: Math.round(stitchesPer4Inches * (GAUGE_DEMO_WIDTH_INCHES / 4)),
    knitRows: Math.round(rowsPer4Inches * (GAUGE_DEMO_LENGTH_INCHES / 4)),
  };
}

/**
 * One stockinette V, centered in its own column.
 * Legs drop, then curve into the point, with space around the stitch
 * so neighboring Vs stay separate.
 */
function stitchMark(stitchWidth: number, rowHeight: number, simplified: boolean): string {
  const insetX = stitchWidth * (simplified ? 0.08 : 0.16);
  const top = rowHeight * (simplified ? 0.08 : 0.18);
  const bottom = rowHeight * (simplified ? 0.94 : 0.86);
  const centerX = stitchWidth / 2;
  const left = insetX;
  const right = stitchWidth - insetX;
  if (simplified) {
    return `M ${left} ${top} L ${centerX} ${bottom} M ${right} ${top} L ${centerX} ${bottom}`;
  }
  const bend = top + (bottom - top) * 0.62;
  return `M ${left} ${top} C ${left} ${bend} ${centerX} ${bend} ${centerX} ${bottom} M ${right} ${top} C ${right} ${bend} ${centerX} ${bend} ${centerX} ${bottom}`;
}

/** One pattern tile: a single knit V. Rows and columns stay aligned. */
export function gaugeDemoKnitTile(stitchWidth: number, rowHeight: number): GaugeDemoFabric {
  const simplified = stitchWidth < GAUGE_DEMO_SIMPLIFY_STITCH_WIDTH;
  return {
    svgWidth: stitchWidth,
    svgHeight: rowHeight,
    stitchWidth,
    rowHeight,
    patternWidth: stitchWidth,
    patternHeight: rowHeight,
    simplified,
    stitchPath: stitchMark(stitchWidth, rowHeight, simplified),
    strokeWidth: Math.max(0.45, Math.min(stitchWidth * 0.1, rowHeight * 0.16, simplified ? 1.1 : 2.8)),
  };
}

export function gaugeDemoFabric(state: GaugeDemoState): GaugeDemoFabric {
  const tile = gaugeDemoKnitTile(
    GAUGE_DEMO_FABRIC_WIDTH / state.castOn,
    GAUGE_DEMO_FABRIC_HEIGHT / state.knitRows,
  );
  return { ...tile, svgWidth: GAUGE_DEMO_FABRIC_WIDTH, svgHeight: GAUGE_DEMO_FABRIC_HEIGHT };
}

/**
 * Misses size 7 from the sweater sizing chart (body upper arm 12", wrist 6", sleeve 17").
 * Finished circumferences add the builder's standard-fit sleeve ease. Cuff depth is the adult default.
 */
const GAUGE_DEMO_SLEEVE_CHART = {
  chartAudience: "misses",
  fit: "standard",
  bodyUpperArmInches: 12,
  bodyWristInches: 6,
  sleeveLengthInches: 17,
} as const;

function requiredInches(value: number | undefined, label: string): number {
  if (value === undefined || !(value > 0)) {
    throw new Error(`Gauge demonstration is missing ${label}.`);
  }
  return value;
}

export const GAUGE_DEMO_SLEEVE_MEASUREMENTS = {
  sleeveLengthInches: GAUGE_DEMO_SLEEVE_CHART.sleeveLengthInches,
  upperArmInches: requiredInches(
    resolveDropShoulderFinishedUpperArmInches({
      chartAudience: GAUGE_DEMO_SLEEVE_CHART.chartAudience,
      fit: GAUGE_DEMO_SLEEVE_CHART.fit,
      bodyUpperArmIn: GAUGE_DEMO_SLEEVE_CHART.bodyUpperArmInches,
    }),
    "finished upper arm",
  ),
  wristInches: requiredInches(
    resolveDropShoulderFinishedWristInches({
      chartAudience: GAUGE_DEMO_SLEEVE_CHART.chartAudience,
      fit: GAUGE_DEMO_SLEEVE_CHART.fit,
      bodyWristIn: GAUGE_DEMO_SLEEVE_CHART.bodyWristInches,
    }),
    "finished wrist",
  ),
  cuffDepthInches: getDefaultCuffLengthInches(GAUGE_DEMO_SLEEVE_CHART.chartAudience),
} as const;

/** Drawing scale for the sleeve outline. The outline uses inches, not stitch counts. */
export const GAUGE_DEMO_SLEEVE_UNITS_PER_INCH = 16;

/**
 * Dimension lines match Drop Shoulder Stitches & Rows:
 * stroke #52682d at 1.4, with 7×1.4 end caps. See `endCap` in
 * dropShoulderPatternDiagramSvgShared.ts.
 */
const GAUGE_DEMO_DIM = "#52682d";
const GAUGE_DEMO_DIM_LABEL = "#4b5563";
const GAUGE_DEMO_DIM_FONT = "Poppins, system-ui, Arial, sans-serif";

export type GaugeDemoSleeveFrame = {
  width: number;
  height: number;
  path: string;
  upperArmWidth: number;
  wristWidth: number;
  sleeveLength: number;
  measurements: string;
};

function fmtDim(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function dimEndCap(x: number, y: number, verticalLine: boolean): string {
  if (verticalLine) {
    return `<rect x="${fmtDim(x - 3.5)}" y="${fmtDim(y - 0.7)}" width="7" height="1.4" fill="${GAUGE_DEMO_DIM}"/>`;
  }
  return `<rect x="${fmtDim(x - 0.7)}" y="${fmtDim(y - 3.5)}" width="1.4" height="7" fill="${GAUGE_DEMO_DIM}"/>`;
}

function horizontalMeasure(
  role: string,
  x1: number,
  x2: number,
  y: number,
  label: string,
  labelY: number,
): string {
  return [
    `<g data-gauge-demo-measure="${role}">`,
    `<line x1="${fmtDim(x1)}" y1="${fmtDim(y)}" x2="${fmtDim(x2)}" y2="${fmtDim(y)}" stroke="${GAUGE_DEMO_DIM}" stroke-width="1.4" fill="none"/>`,
    dimEndCap(x1, y, false),
    dimEndCap(x2, y, false),
    `<text x="${fmtDim((x1 + x2) / 2)}" y="${fmtDim(labelY)}" text-anchor="middle" dominant-baseline="middle" fill="${GAUGE_DEMO_DIM_LABEL}" font-family="${GAUGE_DEMO_DIM_FONT}" font-size="15" font-weight="600">${label}</text>`,
    `</g>`,
  ].join("");
}

function verticalMeasure(x: number, y1: number, y2: number, label: string, labelX: number): string {
  const midY = (y1 + y2) / 2;
  return [
    `<g data-gauge-demo-measure="length">`,
    `<line x1="${fmtDim(x)}" y1="${fmtDim(y1)}" x2="${fmtDim(x)}" y2="${fmtDim(y2)}" stroke="${GAUGE_DEMO_DIM}" stroke-width="1.4" fill="none"/>`,
    dimEndCap(x, y1, true),
    dimEndCap(x, y2, true),
    `<text x="0" y="0" text-anchor="middle" dominant-baseline="middle" fill="${GAUGE_DEMO_DIM_LABEL}" font-family="${GAUGE_DEMO_DIM_FONT}" font-size="15" font-weight="600" transform="translate(${fmtDim(labelX)} ${fmtDim(midY)}) rotate(-90)">${label}</text>`,
    `</g>`,
  ].join("");
}

/** Same finished sleeve at every gauge. Extra canvas space holds the measurement lines. */
export function gaugeDemoSleeveFrame(): GaugeDemoSleeveFrame {
  const { sleeveLengthInches, upperArmInches, wristInches } = GAUGE_DEMO_SLEEVE_MEASUREMENTS;
  const unit = GAUGE_DEMO_SLEEVE_UNITS_PER_INCH;
  const gutterLeft = 62;
  const gutterRight = 16;
  const gutterTop = 52;
  const gutterBottom = 56;
  const upperArmWidth = upperArmInches * unit;
  const wristWidth = wristInches * unit;
  const sleeveLength = sleeveLengthInches * unit;
  const width = gutterLeft + upperArmWidth + gutterRight;
  const height = gutterTop + sleeveLength + gutterBottom;
  const top = gutterTop;
  const bottom = gutterTop + sleeveLength;
  const mid = gutterLeft + upperArmWidth / 2;
  const halfUpper = upperArmWidth / 2;
  const halfWrist = wristWidth / 2;
  const path = [
    `M ${fmtDim(mid - halfUpper)} ${fmtDim(top)}`,
    `L ${fmtDim(mid + halfUpper)} ${fmtDim(top)}`,
    `L ${fmtDim(mid + halfWrist)} ${fmtDim(bottom)}`,
    `L ${fmtDim(mid - halfWrist)} ${fmtDim(bottom)}`,
    "Z",
  ].join(" ");
  const upperY = top - 18;
  const wristY = bottom + 18;
  const lengthX = gutterLeft - 22;
  const measurements = [
    `<g data-gauge-demo-measures="true">`,
    horizontalMeasure(
      "upper-arm",
      mid - halfUpper,
      mid + halfUpper,
      upperY,
      `${upperArmInches}" Upper Arm`,
      upperY - 18,
    ),
    horizontalMeasure(
      "wrist",
      mid - halfWrist,
      mid + halfWrist,
      wristY,
      `${wristInches}" Wrist`,
      wristY + 18,
    ),
    verticalMeasure(lengthX, top, bottom, `${sleeveLengthInches}" Length`, lengthX - 22),
    `</g>`,
  ].join("");
  return { width, height, path, upperArmWidth, wristWidth, sleeveLength, measurements };
}

export type GaugeDemoSleeveLine = {
  role: "section" | "rc" | "text";
  text: string;
};

export type GaugeDemoSleeveInstructions = {
  stitchesPer4: number;
  rowsPer4: number;
  castOn: number;
  cuffRows: number;
  bindOff: number;
  totalRows: number;
  sleeveBodyRows: number;
  increaseCountPerSide: number;
  rowsAfterShaping: number;
  shapingLines: string[];
  lines: GaugeDemoSleeveLine[];
};

function plainInstruction(line: string): string {
  return line.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Short sales excerpt of the generated cuff-up sleeve.
 * Keeps the builder's cast-on count, pre-shaping rows, increase line (with every RC),
 * and the bind-off row and stitch count. Omits cuff choices and finishing commentary.
 */
export function gaugeDemoSleeveExcerptLines(
  rows: readonly SleevelessPatternDisplayRow[],
  shapingLines: readonly string[],
): GaugeDemoSleeveLine[] {
  const generated = gaugeDemoSleeveLinesFromDisplayRows(rows);
  const beforeShaping = generated.find((line) => /^Knit \d+ rows? even\.$/.test(line.text));
  const bindOffIndex = generated.findIndex((line) => line.text.startsWith("Bind off loosely"));
  const bindOffRc = bindOffIndex > 0 ? generated[bindOffIndex - 1]?.text : undefined;
  const bindOff = bindOffRc?.match(/^(RC: \d+) · (\d+) sts$/);
  const lines: GaugeDemoSleeveLine[] = [{ role: "text", text: castOnLine(generated) }];
  if (beforeShaping) lines.push({ role: "text", text: beforeShaping.text });
  for (const text of shapingLines) lines.push({ role: "text", text });
  if (bindOff) lines.push({ role: "text", text: `Bind off ${bindOff[2]} stitches at ${bindOff[1]}.` });
  return lines;
}

function castOnLine(generated: readonly GaugeDemoSleeveLine[]): string {
  const choice = generated.find((line) => line.text.startsWith("1. Cast on "));
  const count = choice?.text.match(/^1\. Cast on (\d+) stitches/)?.[1];
  return count ? `Cast on ${count} stitches.` : "Cast on stitches.";
}

/**
 * Written lines a knitter sees from {@link buildDropShoulderSleeveDisplayRows}.
 * The interactive shaping chart is omitted; its row numbers are already in the written increase line.
 */
export function gaugeDemoSleeveLinesFromDisplayRows(
  rows: readonly SleevelessPatternDisplayRow[],
): GaugeDemoSleeveLine[] {
  const lines: GaugeDemoSleeveLine[] = [];
  let skipSection = false;
  for (const row of rows) {
    if (row.kind === "piece") continue;
    if (row.kind === "section") {
      skipSection = row.title === "SLEEVE SHAPING CHART";
      if (!skipSection) lines.push({ role: "section", text: row.title });
      continue;
    }
    if (row.kind !== "block" || skipSection) continue;
    const trusted = row.trustedParagraphs?.map(plainInstruction).filter(Boolean) ?? [];
    const plain = trusted.length > 0 ? trusted : (row.paragraphs ?? []).map(plainInstruction).filter(Boolean);
    if (plain.length === 0) continue;
    if (row.rc) {
      const count = row.stitchCount !== undefined ? ` · ${row.stitchCount} sts` : "";
      lines.push({ role: "rc", text: `${row.rc}${count}` });
    } else if (row.stitchCount !== undefined) {
      lines.push({ role: "text", text: `${row.stitchCount} sts` });
    }
    for (const text of plain) lines.push({ role: "text", text });
  }
  return lines;
}

/**
 * Cuff-up Drop Shoulder sleeve at one sample gauge.
 * Instructions are the builder's generated sleeve rows, not a separate summary.
 */
export function gaugeDemoSleeveInstructions(
  stitchesPer4: unknown,
  rowsPer4: unknown,
): GaugeDemoSleeveInstructions {
  const gauge = resolveGaugeDemoState(stitchesPer4, rowsPer4);
  const perInch = rawSwatchToPerInch(String(gauge.stitchesPer4), String(gauge.rowsPer4), "in");
  const piece = calculateDropShoulderSleevePieceNumbers({
    finishedUpperArmInches: GAUGE_DEMO_SLEEVE_MEASUREMENTS.upperArmInches,
    finishedWristInches: GAUGE_DEMO_SLEEVE_MEASUREMENTS.wristInches,
    sleeveLengthInches: GAUGE_DEMO_SLEEVE_MEASUREMENTS.sleeveLengthInches,
    stitchesPerInch: Number(perInch.gaugeStitchesPerInch),
    rowsPerInch: Number(perInch.gaugeRowsPerInch),
    cuffDepthInches: GAUGE_DEMO_SLEEVE_MEASUREMENTS.cuffDepthInches,
  });
  const plan = dropShoulderSleeveShapingPlan({
    topSts: piece.topSts,
    wristSts: piece.wristSts,
    sleeveBodyRows: piece.sleeveBodyRows,
  });
  const chartInput = {
    topSts: piece.topSts,
    wristSts: piece.wristSts,
    cuffRows: piece.cuffRows,
    sleeveBodyRows: piece.sleeveBodyRows,
    sleeveTotalRows: piece.sleeveTotalRows,
    direction: "cuff-up" as const,
  };
  const displayRows = buildDropShoulderSleeveDisplayRows({
    ...chartInput,
    valid: true,
  });
  const shapingLines = formatDropShoulderSleeveShapingWrittenLines(
    plan.shapingDirection,
    plan.steps,
    dropShoulderSleeveShapingRcSequence(chartInput),
  ).map(plainInstruction);
  const spans = dropShoulderSleeveBodyRowSpans(chartInput);
  const breakdown = dropShoulderSleeveShapingBreakdown(
    { topSts: piece.topSts, wristSts: piece.wristSts, direction: "cuff-up" },
    plan.steps,
  );
  const lastStitches = breakdown[breakdown.length - 1]?.stitchesAfter;
  if (lastStitches !== undefined && lastStitches !== piece.topSts) {
    throw new Error("Sleeve shaping did not finish on the upper-arm stitch count.");
  }
  return {
    stitchesPer4: gauge.stitchesPer4,
    rowsPer4: gauge.rowsPer4,
    castOn: piece.wristSts,
    cuffRows: piece.cuffRows,
    bindOff: piece.topSts,
    totalRows: piece.sleeveTotalRows,
    sleeveBodyRows: piece.sleeveBodyRows,
    increaseCountPerSide: sleeveShapingPerSide(piece.topSts, piece.wristSts),
    rowsAfterShaping: spans.rowsAfterShaping,
    shapingLines,
    lines: gaugeDemoSleeveExcerptLines(displayRows, shapingLines),
  };
}

/**
 * Illustrative stitch width, in sleeve drawing units, at 16 stitches / 4".
 * Finer gauges use the same outline and smaller tiles. This is not a stitch-for-stitch chart.
 */
const GAUGE_DEMO_SLEEVE_COARSE_STITCH = 22;

/** Knit texture for the sleeve. Stitch size follows the sample gauge; the outline does not. */
export function gaugeDemoSleeveKnitTile(stitchesPer4: number, rowsPer4: number): GaugeDemoFabric {
  const gauge = resolveGaugeDemoState(stitchesPer4, rowsPer4);
  const stitchWidth = GAUGE_DEMO_SLEEVE_COARSE_STITCH * (16 / gauge.stitchesPer4);
  const rowHeight = stitchWidth * (gauge.stitchesPer4 / gauge.rowsPer4);
  return gaugeDemoKnitTile(stitchWidth, rowHeight);
}
