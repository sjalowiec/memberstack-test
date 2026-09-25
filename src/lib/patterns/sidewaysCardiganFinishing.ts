/**
 * Sideways sweater folded hem, cardigan front-and-neck band, and finishing.
 * Body hem stitch counts use even rounding. The band cast-on uses the nearest odd count.
 * Row counts use inchesToRows.
 * The band edge is the knitted front and neck opening, not the bust or body length.
 */

import { evenPositiveBodyStitches } from "./sleevelessBodyStitchMath";
import { inchesToRows } from "./sleevelessRowAccounting";
import type { SidewaysCardiganBodyCalc } from "./sidewaysCardiganBodyCalc";
import type { SidewaysCardiganGarmentStyle } from "./sidewaysCardiganConstructionIdentity";
import { formatRowsCount, formatStitchesCount } from "./sidewaysCardiganDisplayFormat";
import {
  formatMeasurementDisplayFromInches,
  type MeasurementDisplayUnit,
} from "./patternMeasurementDisplayUnit";

export const SIDEWAYS_FOLDED_HEM_OFFSET_INCHES = 1;
export const SIDEWAYS_CARDIGAN_BAND_FINISHED_WIDTH_INCHES = 2;
export const SIDEWAYS_CARDIGAN_BAND_CAST_ON_WIDTH_INCHES = 4;

export type SidewaysBandGauge = {
  stitchesPerInch?: number;
  rowsPerInch?: number;
};

export type SidewaysCardiganFrontNeckOpening = {
  /** Straight center-front edges, hem to the start of each V, in inches. */
  frontEdgeInches: number;
  /** One V slope, from the center-front corner to the full neck edge. */
  vSlopeInches: number;
  /** Back-neck width along the knitted opening. */
  backNeckWidthInches: number;
  /** One short end of the back-neck notch. */
  backNeckDepthInches: number;
  /** Both fronts, both V slopes, and the back-neck notch. */
  totalInches: number;
};

function positiveGauge(value: number | undefined, fallback: number): number {
  return value !== undefined && value > 0 ? value : fallback;
}

/** Nearest odd stitch count. An exact even count rounds up, so 28 becomes 29. */
export function nearestOddPositiveStitches(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 1;
  const rounded = Math.round(n);
  if (rounded % 2 !== 0) return Math.max(1, rounded);
  return Math.max(1, n >= rounded ? rounded + 1 : rounded - 1);
}

export type SidewaysBandMarker = {
  id: "first-v" | "first-shoulder" | "second-shoulder" | "second-v";
  label: string;
  inches: number;
  rows: number;
};

/** Distances along the opening from the starting front edge. */
export function sidewaysCardiganBandMarkers(
  opening: SidewaysCardiganFrontNeckOpening,
  rowsPerInch: number,
): SidewaysBandMarker[] {
  const firstShoulderInches = opening.frontEdgeInches + opening.vSlopeInches;
  const positions: Array<Omit<SidewaysBandMarker, "rows">> = [
    { id: "first-v", label: "Start of the first V-neck slope", inches: opening.frontEdgeInches },
    { id: "first-shoulder", label: "First shoulder seam", inches: firstShoulderInches },
    {
      id: "second-shoulder",
      label: "Second shoulder seam",
      inches: opening.totalInches - firstShoulderInches,
    },
    {
      id: "second-v",
      label: "Start of the second V-neck slope",
      inches: opening.totalInches - opening.frontEdgeInches,
    },
  ];
  return positions.map((position) => ({
    ...position,
    rows: inchesToRows(position.inches, rowsPerInch),
  }));
}

/** Needle count about 1 inch from the hem edge, using even stitch rounding. */
export function sidewaysFoldedHemTurningNeedle(stitchesPerInch: number): number {
  return evenPositiveBodyStitches(SIDEWAYS_FOLDED_HEM_OFFSET_INCHES * stitchesPerInch);
}

/**
 * Complete cardigan opening the band is sewn to.
 * Uses the knitted stitch and row counts, converted with the sweater gauge.
 */
export function sidewaysCardiganFrontNeckOpeningInches(args: {
  calc: SidewaysCardiganBodyCalc;
  stitchesPerInch: number;
  rowsPerInch: number;
}): SidewaysCardiganFrontNeckOpening {
  const spi = args.stitchesPerInch;
  const rpi = args.rowsPerInch;
  const frontStitches = Math.max(0, args.calc.garmentLengthStitches - args.calc.vNeckDepthStitches);
  const frontEdgeInches = spi > 0 ? frontStitches / spi : 0;
  const vDepthInches = spi > 0 ? args.calc.vNeckDepthStitches / spi : 0;
  const halfNeckInches = rpi > 0 ? args.calc.halfNeckRows / rpi : 0;
  const vSlopeInches = Math.hypot(vDepthInches, halfNeckInches);
  const backNeckWidthInches = rpi > 0 ? args.calc.backNeckOpeningRows / rpi : 0;
  const backNeckDepthInches = spi > 0 ? args.calc.backNeckDepthStitches / spi : 0;
  const totalInches =
    2 * frontEdgeInches + 2 * vSlopeInches + backNeckWidthInches + 2 * backNeckDepthInches;
  return {
    frontEdgeInches,
    vSlopeInches,
    backNeckWidthInches,
    backNeckDepthInches,
    totalInches,
  };
}

export function sidewaysCardiganBandNumbers(args: {
  openingInches: number;
  sweaterStitchesPerInch: number;
  sweaterRowsPerInch: number;
  bandGauge?: SidewaysBandGauge;
}): {
  castOnStitches: number;
  rows: number;
  turningNeedle: number;
  stitchGauge: number;
  rowGauge: number;
  stitchGaugeSource: "band" | "sweater";
  rowGaugeSource: "band" | "sweater";
} {
  const stitchGauge = positiveGauge(args.bandGauge?.stitchesPerInch, args.sweaterStitchesPerInch);
  const rowGauge = positiveGauge(args.bandGauge?.rowsPerInch, args.sweaterRowsPerInch);
  const castOnStitches = nearestOddPositiveStitches(
    SIDEWAYS_CARDIGAN_BAND_CAST_ON_WIDTH_INCHES * stitchGauge,
  );
  return {
    castOnStitches,
    rows: inchesToRows(args.openingInches, rowGauge),
    turningNeedle: Math.max(1, Math.round(castOnStitches / 2)),
    stitchGauge,
    rowGauge,
    stitchGaugeSource:
      args.bandGauge?.stitchesPerInch !== undefined && args.bandGauge.stitchesPerInch > 0
        ? "band"
        : "sweater",
    rowGaugeSource:
      args.bandGauge?.rowsPerInch !== undefined && args.bandGauge.rowsPerInch > 0
        ? "band"
        : "sweater",
  };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sidewaysFoldedHemCastOnSentence(turningNeedle: number): string {
  return (
    `For an optional folded hem, leave needle ${turningNeedle} out of work. ` +
    `That needle is about ${SIDEWAYS_FOLDED_HEM_OFFSET_INCHES} inch from the hem edge. ` +
    "Keep it out of work for the entire length of the sweater. This creates the turning line."
  );
}

export function renderSidewaysCardiganBandSectionHtml(args: {
  calc: SidewaysCardiganBodyCalc;
  stitchesPerInch: number;
  rowsPerInch: number;
  bandGauge?: SidewaysBandGauge;
  displayUnit?: MeasurementDisplayUnit;
}): string {
  const opening = sidewaysCardiganFrontNeckOpeningInches(args);
  const band = sidewaysCardiganBandNumbers({
    openingInches: opening.totalInches,
    sweaterStitchesPerInch: args.stitchesPerInch,
    sweaterRowsPerInch: args.rowsPerInch,
    bandGauge: args.bandGauge,
  });
  const markers = sidewaysCardiganBandMarkers(opening, band.rowGauge);
  const markerItems = markers
    .map((marker) => `<li>Place a marker at approximately row ${marker.rows}.</li>`)
    .join("");
  const unit = args.displayUnit === "cm" ? "cm" : "in";
  const openingLength = `${formatMeasurementDisplayFromInches(opening.totalInches, unit)} ${unit === "cm" ? "cm" : "inches"}`;
  const used =
    band.stitchGaugeSource === "band" || band.rowGaugeSource === "band"
      ? `Cast-on stitches use the ${band.stitchGaugeSource} stitch gauge (${band.stitchGauge} stitches per inch). Band rows use the ${band.rowGaugeSource} row gauge (${band.rowGauge} rows per inch).`
      : `Cast-on stitches and band rows use the sweater gauge (${args.stitchesPerInch} stitches and ${args.rowsPerInch} rows per inch).`;
  const stitchValue =
    args.bandGauge?.stitchesPerInch !== undefined && args.bandGauge.stitchesPerInch > 0
      ? String(args.bandGauge.stitchesPerInch)
      : "";
  const rowValue =
    args.bandGauge?.rowsPerInch !== undefined && args.bandGauge.rowsPerInch > 0
      ? String(args.bandGauge.rowsPerInch)
      : "";
  return (
    `<section id="sg-front-neck-band" class="pattern-section pattern-section--garment-piece" data-section-id="sg-front-neck-band">` +
    `<div class="pattern-section__header"><div class="pattern-section__heading"><h2>FRONT AND NECK BAND</h2></div></div>` +
    `<div class="pattern-section__content">` +
    `<p class="sleeveless-pattern-line">Knit a separate band. Sew it up one front edge, around the V-neck, and down the other front edge. Do not hang or pick up the V-neck edge on the machine.</p>` +
    `<p class="sleeveless-pattern-line">For an adult sweater, the finished band is about ${SIDEWAYS_CARDIGAN_BAND_FINISHED_WIDTH_INCHES} inches wide. Knit a separate ${SIDEWAYS_CARDIGAN_BAND_CAST_ON_WIDTH_INCHES}-inch strip, then fold it lengthwise and sew it in place.</p>` +
    `<p class="sleeveless-pattern-line">${escapeHtml(used)}</p>` +
    `<p class="sideways-band-counts">` +
    `<span class="sideways-band-counts__action">Cast on ${formatStitchesCount(band.castOnStitches)}</span>` +
    `<span class="sideways-band-counts__action">Knit approximately ${formatRowsCount(band.rows)}</span>` +
    `</p>` +
    `<p class="sleeveless-pattern-line">${formatRowsCount(band.rows)} is an approximate starting length for the complete front and neck opening (${openingLength}).</p>` +
    `<ul class="sleeveless-pattern-line" data-sideways-band-markers>${markerItems}</ul>` +
    `<p class="sleeveless-pattern-line">Knit a few extra rows and scrap off the live stitches. Pin the band around the opening, matching its markers to the V-neck starts and shoulder seams. Adjust the fit before sewing, remove any extra rows, and finish the end.</p>` +
    `<details class="no-print" data-sideways-band-gauge>` +
    `<summary>Use a different gauge for the band</summary>` +
    `<p class="sleeveless-pattern-line">The cast-on, band length, and marker rows update automatically as you enter your gauge.</p>` +
    `<label>Band stitches per inch <input type="number" min="0" step="any" data-sideways-band-stitches-per-inch value="${escapeHtml(stitchValue)}" /></label>` +
    `<label>Band rows per inch <input type="number" min="0" step="any" data-sideways-band-rows-per-inch value="${escapeHtml(rowValue)}" /></label>` +
    `</details>` +
    `<p class="sleeveless-pattern-line">Optional fold line: Keep the center needle out of work throughout the strip.</p>` +
    `</div></section>`
  );
}

export function renderSidewaysFinishingSectionHtml(args: {
  garmentStyle: SidewaysCardiganGarmentStyle;
  turningNeedle: number;
}): string {
  const hem = `If you left needle ${args.turningNeedle} out of work as a turning line, fold the hem along that line and secure the hem edge to the inside.`;
  const steps =
    args.garmentStyle === "cardigan"
      ? [
          "Block the piece as desired.",
          "Join the shoulder seams.",
          hem,
          "Make and attach the cardigan front and neck band. If you left a turning needle out of work in the band, fold the band lengthwise and secure its inner edge.",
          "Join the sleeve seams.",
          "Set the sleeves into the armhole openings.",
        ]
      : [
          "Block the piece as desired.",
          "Join the side seam from the hem toward the underarm, leaving the armhole depth open. The neckline is already knitted into the body, so this pullover does not need a separate neck band.",
          hem,
          "Join the sleeve seams.",
          "Set the sleeves into the armhole openings.",
        ];
  const items = steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  return (
    `<section id="sg-finishing" class="pattern-section pattern-section--garment-piece" data-section-id="sg-finishing">` +
    `<div class="pattern-section__header"><div class="pattern-section__heading"><h2>FINISHING</h2></div></div>` +
    `<div class="pattern-section__content"><ol class="sideways-finishing">${items}</ol></div></section>`
  );
}

export function readSidewaysBandGauge(style: Record<string, unknown>): SidewaysBandGauge {
  const stitches = Number(style.sidewaysBandStitchesPerInch);
  const rows = Number(style.sidewaysBandRowsPerInch);
  return {
    ...(Number.isFinite(stitches) && stitches > 0 ? { stitchesPerInch: stitches } : {}),
    ...(Number.isFinite(rows) && rows > 0 ? { rowsPerInch: rows } : {}),
  };
}
