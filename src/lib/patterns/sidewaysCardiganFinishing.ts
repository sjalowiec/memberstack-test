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
import type { MeasurementDisplayUnit } from "./patternMeasurementDisplayUnit";
import { swatchCountFromPerInchForDisplay } from "./gaugeDisplayFormat";
import { rawSwatchToPerInch } from "./syncExpressWizardToPatternStorage";
import {
  sleevelessHelpVideoFromCatalog,
  type SleevelessHelpVideoMeta,
} from "./sleevelessCatalogHelpVideo";
import type { PublicVideoRow } from "../lessonVideo";
import videosPublic from "../../data/videos-public.json";

export const SIDEWAYS_FOLDED_HEM_OFFSET_INCHES = 1;
export const SIDEWAYS_CARDIGAN_BAND_FINISHED_WIDTH_INCHES = 2;
export const SIDEWAYS_CARDIGAN_BAND_CAST_ON_WIDTH_INCHES = 4;

/** Learning Library content_id for “Crisp, Decorative Fold”. */
export const SIDEWAYS_CARDIGAN_FOLD_VIDEO_CONTENT_ID = 1025;

export const SIDEWAYS_CARDIGAN_FOLD_VIDEO_WATCH_LABEL = "Watch: Crisp, decorative fold";

export function resolveSidewaysCardiganFoldVideo(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): SleevelessHelpVideoMeta | null {
  return sleevelessHelpVideoFromCatalog(SIDEWAYS_CARDIGAN_FOLD_VIDEO_CONTENT_ID, catalog);
}

export function sidewaysCardiganFoldVideoLinkHtml(
  video: SleevelessHelpVideoMeta | null = resolveSidewaysCardiganFoldVideo(),
): string {
  if (!video) return "";
  return (
    `<button type="button" class="kbm-kin-catalog-video pattern-help-link__button"` +
    ` data-vimeo-id="${escapeHtml(video.id)}"` +
    ` data-video-title="${escapeHtml(video.title)}"` +
    ` data-content-id="${SIDEWAYS_CARDIGAN_FOLD_VIDEO_CONTENT_ID}"` +
    ` data-video-autoplay="false"` +
    ` data-sideways-band-fold-video` +
    ` aria-haspopup="dialog">` +
    `${escapeHtml(SIDEWAYS_CARDIGAN_FOLD_VIDEO_WATCH_LABEL)}</button>`
  );
}

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
    { id: "first-v", label: "first V-neck start", inches: opening.frontEdgeInches },
    { id: "first-shoulder", label: "first shoulder seam", inches: firstShoulderInches },
    {
      id: "second-shoulder",
      label: "second shoulder seam",
      inches: opening.totalInches - firstShoulderInches,
    },
    {
      id: "second-v",
      label: "second V-neck start",
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
    .map(
      (marker) =>
        `<li>${escapeHtml(marker.label)}: approximately row ${marker.rows}</li>`,
    )
    .join("");
  const basis = bandSwatchBasis(args.displayUnit);
  const stitchLabel = basis === "cm" ? "Band stitches per 10 cm" : "Band stitches per 4 inches";
  const rowLabel = basis === "cm" ? "Band rows per 10 cm" : "Band rows per 4 inches";
  const used =
    band.stitchGaugeSource === "band" && band.rowGaugeSource === "band"
      ? `The following instructions use your band gauge (${swatchCountFromPerInchForDisplay(band.stitchGauge, basis)} stitches and ${swatchCountFromPerInchForDisplay(band.rowGauge, basis)} rows ${basis === "cm" ? "per 10 cm" : "per 4 inches"}).`
      : band.stitchGaugeSource === "band"
        ? `The following instructions use your band gauge (${bandSwatchCount(band.stitchGauge, args.displayUnit, "stitches")}) and your sweater gauge (${band.rowGauge} rows per inch).`
        : band.rowGaugeSource === "band"
          ? `The following instructions use your sweater gauge (${band.stitchGauge} stitches per inch) and your band gauge (${bandSwatchCount(band.rowGauge, args.displayUnit, "rows")}).`
          : `The following instructions use your sweater gauge (${args.stitchesPerInch} stitches and ${args.rowsPerInch} rows per inch).`;
  const stitchValue =
    args.bandGauge?.stitchesPerInch !== undefined && args.bandGauge.stitchesPerInch > 0
      ? swatchCountFromPerInchForDisplay(args.bandGauge.stitchesPerInch, basis)
      : "";
  const rowValue =
    args.bandGauge?.rowsPerInch !== undefined && args.bandGauge.rowsPerInch > 0
      ? swatchCountFromPerInchForDisplay(args.bandGauge.rowsPerInch, basis)
      : "";
  return (
    `<section id="sg-front-neck-band" class="pattern-section pattern-section--garment-piece" data-section-id="sg-front-neck-band">` +
    `<div class="pattern-section__header"><div class="pattern-section__heading"><h2>FRONT AND NECK BAND</h2></div></div>` +
    `<div class="pattern-section__content">` +
    `<p class="sleeveless-pattern-line">Knit a separate band. Sew it up one front edge, around the V-neck, and down the other front edge. Do not hang or pick up the V-neck edge on the machine.</p>` +
    `<p class="sleeveless-pattern-line">For an adult sweater, the finished band is about ${SIDEWAYS_CARDIGAN_BAND_FINISHED_WIDTH_INCHES} inches wide. Knit a separate ${SIDEWAYS_CARDIGAN_BAND_CAST_ON_WIDTH_INCHES}-inch strip, then fold it lengthwise and sew it in place.</p>` +
    `<p class="sleeveless-pattern-line">${escapeHtml(used)}</p>` +
    `<p class="sleeveless-pattern-line">Optional fold line: Before casting on, leave the center needle out of work. Keep it out of work throughout the strip. ${sidewaysCardiganFoldVideoLinkHtml()}</p>` +
    `<p class="sideways-band-counts">` +
    `<span class="sideways-band-counts__action">Cast on ${formatStitchesCount(band.castOnStitches)}</span>` +
    `<span class="sideways-band-counts__action">Knit approximately ${formatRowsCount(band.rows)}</span>` +
    `</p>` +
    `<ol class="sleeveless-pattern-line">` +
    `<li>Cast on the stated stitches and begin knitting the strip.</li>` +
    `<li>As you knit, place markers at the stated cumulative rows. Label each one: first V-neck start, first shoulder seam, second shoulder seam, and second V-neck start.` +
    `<ul data-sideways-band-markers>${markerItems}</ul></li>` +
    `<li>After reaching the approximate total row count, knit a few extra rows and scrap off the live stitches.</li>` +
    `<li>Pin the band around the opening, align the four markers, adjust the fit, remove excess rows, finish the end, and sew the band in place.</li>` +
    `</ol>` +
    `<details class="no-print" data-sideways-band-gauge>` +
    `<summary>Use a different gauge for the band</summary>` +
    `<p class="sleeveless-pattern-line">The cast-on, band length, and marker rows update automatically as you enter your gauge.</p>` +
    `<label>${stitchLabel} <input type="number" min="0" step="any" data-sideways-band-stitches-per-inch value="${escapeHtml(stitchValue)}" /></label>` +
    `<label>${rowLabel} <input type="number" min="0" step="any" data-sideways-band-rows-per-inch value="${escapeHtml(rowValue)}" /></label>` +
    `</details>` +
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
  const items = steps
    .map((step) => {
      const foldLink =
        args.garmentStyle === "cardigan" && step.startsWith("Make and attach the cardigan front and neck band")
          ? ` ${sidewaysCardiganFoldVideoLinkHtml()}`
          : "";
      return `<li>${escapeHtml(step)}${foldLink}</li>`;
    })
    .join("");
  return (
    `<section id="sg-finishing" class="pattern-section pattern-section--garment-piece" data-section-id="sg-finishing">` +
    `<div class="pattern-section__header"><div class="pattern-section__heading"><h2>FINISHING</h2></div></div>` +
    `<div class="pattern-section__content"><ol class="sideways-finishing">${items}</ol></div></section>`
  );
}

/** Visible swatch counts (per 4 inches or per 10 cm) → per-inch rates. Stitch and row stay in their own fields. */
export function sidewaysBandGaugeFromSwatchInputs(
  stitchRaw: string,
  rowRaw: string,
  unit: MeasurementDisplayUnit,
): SidewaysBandGauge {
  const converted = rawSwatchToPerInch(stitchRaw, rowRaw, unit === "cm" ? "cm" : "in");
  const stitches = Number(converted.gaugeStitchesPerInch);
  const rows = Number(converted.gaugeRowsPerInch);
  return {
    ...(Number.isFinite(stitches) && stitches > 0 ? { stitchesPerInch: stitches } : {}),
    ...(Number.isFinite(rows) && rows > 0 ? { rowsPerInch: rows } : {}),
  };
}

function bandSwatchBasis(unit: MeasurementDisplayUnit | undefined): "in" | "cm" {
  return unit === "cm" ? "cm" : "in";
}

function bandSwatchCount(perInch: number, unit: MeasurementDisplayUnit | undefined, kind: "stitches" | "rows"): string {
  const basis = bandSwatchBasis(unit);
  const count = swatchCountFromPerInchForDisplay(perInch, basis);
  const span = basis === "cm" ? "per 10 cm" : "per 4 inches";
  return `${count} ${kind} ${span}`;
}

export function readSidewaysBandGauge(style: Record<string, unknown>): SidewaysBandGauge {
  const stitches = Number(style.sidewaysBandStitchesPerInch);
  const rows = Number(style.sidewaysBandRowsPerInch);
  return {
    ...(Number.isFinite(stitches) && stitches > 0 ? { stitchesPerInch: stitches } : {}),
    ...(Number.isFinite(rows) && rows > 0 ? { rowsPerInch: rows } : {}),
  };
}
