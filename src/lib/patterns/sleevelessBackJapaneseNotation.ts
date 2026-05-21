/**
 * Live Japanese notation tokens for the back pullover round-neck SVG (PoC).
 * Reads finalized {@link SleevelessBackPatternResult} data only — no pattern regeneration.
 */

import type { ArmholeResult } from "./legoBlocks/armholeShaping";
import { collectInnerNeckDecreasePointsFromTimeline } from "./notationOverlaySvg";
import { isSleevelessCardiganGarmentStyle, isSleevelessVNeckChoice } from "./sleevelessFrontDiagramSrc";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import {
  compressStitchDecreasePointsToNotationLines,
  type StitchDecreasePoint,
} from "./shapingNotationCompress";
import type { RowEntry } from "./shapingTimeline";

/** Diagram side for back neckline/shoulder notation (matches shoulder overlay convention). */
const BACK_NOTATION_DIAGRAM_SIDE: "left" | "right" = "right";

/**
 * Placeholders in `jp-back-notation.svg` `#draft` / Japanese overlay (not `#sts-rows`, which stays hidden).
 * Stitches/rows measurement tokens (`{{BUST_STS}}`, etc.) are intentionally excluded.
 */
/** Token names inside `{{…}}` in `jp-back-notation.svg` (concatenated across Illustrator tspans). */
export const JP_BACK_NOTATION_SVG_TOKEN_KEYS = [
  "jp-caston",
  "jp-body-rows",
  "jp-armhole-bo",
  "jp-armhole-shaping",
  "jp-neckline-bo",
  "jp-neckline-shaping",
  "jp-shoulder-shaping",
  "rc-caston",
  "rc-hem",
  "rc-neckline-start",
  "rc-armhole-bo",
  "rc_reset",
] as const;

export type JpBackNotationSvgTokenKey = (typeof JP_BACK_NOTATION_SVG_TOKEN_KEYS)[number];

export function formatCastOnNotation(stitches: number): string {
  const n = Math.max(0, Math.round(stitches));
  return n > 0 ? `co${n}` : "";
}

export function formatBodyRowsNotation(rows: number): string {
  const n = Math.max(0, Math.round(rows));
  return n > 0 ? `${n}r` : "";
}

/** Garment or armhole-local row counter label for the notation margin (`rc014`). */
export function formatRcNotation(rc: number): string {
  const n = Math.max(0, Math.floor(rc));
  return `rc${String(n).padStart(3, "0")}`;
}

/** Per-edge bind-off label (e.g. `bo10` — one working edge, not summed across both sides). */
export function formatBindOffNotation(totalStitches: number): string {
  const n = Math.max(0, Math.round(totalStitches));
  return n > 0 ? `bo${n}` : "";
}

export function formatShapingSegment(stitches: number, rows: number, times: number): string {
  const s = Math.max(1, Math.round(stitches));
  const r = Math.max(1, Math.round(rows));
  const t = Math.max(1, Math.round(times));
  return `${s}s-${r}r-${t}x`;
}

export function formatDecreaseNotationLines(points: readonly StitchDecreasePoint[]): string[] {
  return compressStitchDecreasePointsToNotationLines(points);
}

export function formatBindOffNotationLines(points: readonly StitchDecreasePoint[]): string[] {
  return compressStitchDecreasePointsToNotationLines(points).map((line) => `bo${line}`);
}

/**
 * Split per-side armhole stitch removal into bind-off vs decrease counts
 * (same distribution as {@link calculateArmholeShaping}, using stored per-side total only).
 */
export function armholeBindOffDecreaseFromEachSide(stitchesPerSide: number): Pick<
  ArmholeResult,
  "bindOffSts" | "decreaseSts"
> {
  const side = Math.max(0, Math.floor(stitchesPerSide));
  if (side <= 0) return { bindOffSts: 0, decreaseSts: 0 };
  const bindOffSts = Math.round(side / 2);
  const decreaseSts = side - bindOffSts;
  return { bindOffSts, decreaseSts };
}

function collectOuterShoulderBindOffPoints(
  timeline: readonly RowEntry[],
  side: "left" | "right",
): StitchDecreasePoint[] {
  return [...timeline]
    .sort((a, b) => a.row - b.row)
    .map((entry) => {
      let amount = 0;
      for (const ev of entry.events) {
        if (ev.kind !== "bindOff" || ev.edge !== "outer") continue;
        if (side === "left" ? ev.side !== "left" : ev.side !== "right") continue;
        amount += ev.amount;
      }
      return { row: entry.row, amount };
    })
    .filter((p) => p.amount > 0);
}

function joinNotationLines(lines: readonly string[]): string {
  return lines.filter((line) => line.length > 0).join("\n");
}

export function isBackJapaneseNotationSupported(
  patternData: unknown,
  result: SleevelessBackPatternResult,
): boolean {
  if (isSleevelessCardiganGarmentStyle(patternData)) return false;
  if (isSleevelessVNeckChoice(patternData)) return false;
  if (!result.neckShoulderChartUsesLiveRows) return false;
  if (result.neckShoulderShapingChart.sleevelessFullWidthVNeckFront === true) return false;
  return true;
}

export type BackJapaneseNotationDebugPayload = {
  castOnSts: number;
  bodyRows: number;
  hemRows: number;
  armholeStitchesEachSide: number | undefined;
  armholeBindOffSts: number;
  armholeDecreaseSts: number;
  armholeDecreasePoints: StitchDecreasePoint[];
  centerNeckBindOff: number | undefined;
  necklineDecreasePoints: StitchDecreasePoint[];
  shoulderBindOffPoints: StitchDecreasePoint[];
  rcCaston: string;
  rcHem: string;
  rcArmholeBo: string;
  rcReset: string;
  rcNecklineStart: string;
};

/**
 * Build `{{jp-*}}` replacement map for the back Japanese notation SVG from live pattern output.
 */
export function buildBackJapaneseNotationReplacements(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): Record<string, string> {
  const empty = Object.fromEntries(JP_BACK_NOTATION_SVG_TOKEN_KEYS.map((k) => [k, ""])) as Record<
    JpBackNotationSvgTokenKey,
    string
  >;

  if (!isBackJapaneseNotationSupported(patternData, result)) {
    return empty;
  }

  const d = result.debug;
  const castOnSts = d.hemCastOnStitches ?? d.backStitches;
  const bodyRows = d.bodyRows;

  const eachSide = d.armholeStitchesEachSide;
  const { bindOffSts, decreaseSts } =
    eachSide !== undefined ? armholeBindOffDecreaseFromEachSide(eachSide) : { bindOffSts: 0, decreaseSts: 0 };

  const armholeDecreasePoints: StitchDecreasePoint[] =
    decreaseSts > 0
      ? Array.from({ length: decreaseSts }, (_, i) => ({ row: i * 2, amount: 1 }))
      : [];

  const centerNeckBindOff = d.centerNeckBindOffStitches;
  const timeline = result.backNeckShoulderTimeline ?? result.neckShoulderShapingChart.timeline ?? [];

  const necklineDecreasePoints =
    timeline.length > 0
      ? collectInnerNeckDecreasePointsFromTimeline(timeline, BACK_NOTATION_DIAGRAM_SIDE)
      : [];

  const shoulderBindOffPoints =
    timeline.length > 0
      ? collectOuterShoulderBindOffPoints(timeline, BACK_NOTATION_DIAGRAM_SIDE)
      : [];

  const armholeShapingLines = formatDecreaseNotationLines(armholeDecreasePoints);
  const necklineShapingLines = formatDecreaseNotationLines(necklineDecreasePoints);
  const shoulderShapingLines = formatBindOffNotationLines(shoulderBindOffPoints);

  const hemRows = d.hemRows;
  const necklineLocalRc = d.backNecklineStartLocalRC;
  const rcCaston = formatRcNotation(0);
  const rcHem = formatRcNotation(hemRows);
  const rcArmholeBo = formatRcNotation(0);
  const rcReset = formatRcNotation(0);
  const rcNecklineStart =
    necklineLocalRc !== undefined && Number.isFinite(necklineLocalRc)
      ? formatRcNotation(necklineLocalRc)
      : "";

  const replacements: Record<string, string> = {
    "jp-caston": formatCastOnNotation(castOnSts),
    "jp-body-rows": formatBodyRowsNotation(bodyRows),
    "jp-armhole-bo": formatBindOffNotation(bindOffSts),
    "jp-armhole-shaping": joinNotationLines(armholeShapingLines),
    "jp-neckline-bo": formatBindOffNotation(centerNeckBindOff ?? 0),
    "jp-neckline-shaping": joinNotationLines(necklineShapingLines),
    "jp-shoulder-shaping": joinNotationLines(shoulderShapingLines),
    "rc-caston": rcCaston,
    "rc-hem": rcHem,
    "rc-armhole-bo": rcArmholeBo,
    rc_reset: rcReset,
    "rc-neckline-start": rcNecklineStart,
  };

  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    const payload: BackJapaneseNotationDebugPayload = {
      castOnSts,
      bodyRows,
      hemRows,
      armholeStitchesEachSide: eachSide,
      armholeBindOffSts: bindOffSts,
      armholeDecreaseSts: decreaseSts,
      armholeDecreasePoints,
      centerNeckBindOff,
      necklineDecreasePoints,
      shoulderBindOffPoints,
      rcCaston,
      rcHem,
      rcArmholeBo,
      rcReset,
      rcNecklineStart,
    };
    console.log("[sleeveless] Japanese notation shaping sources (back, live):", payload);
    console.log("[sleeveless] Japanese notation strings (back, live):", replacements);
  }

  return replacements;
}
