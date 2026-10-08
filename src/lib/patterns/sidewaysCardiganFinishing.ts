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

/**
 * Finishing depths by size family.
 * Baby uses a shallower folded hem and a narrower cardigan band.
 * Misses, Women's (`plus`), Men's, and Kids' keep the original depths.
 */
export type SidewaysCardiganFinishingProportions = {
  foldedHemOffsetInches: number;
  /** Knitted strip before it is folded in half. */
  bandKnittedDepthInches: number;
  /** Finished width after the strip is folded. */
  bandFinishedWidthInches: number;
};

const SIDEWAYS_FINISHING_PROPORTIONS_STANDARD: SidewaysCardiganFinishingProportions = {
  foldedHemOffsetInches: 1,
  bandKnittedDepthInches: 4,
  bandFinishedWidthInches: 2,
};

const SIDEWAYS_FINISHING_PROPORTIONS_BABY: SidewaysCardiganFinishingProportions = {
  foldedHemOffsetInches: 0.75,
  bandKnittedDepthInches: 2,
  bandFinishedWidthInches: 1,
};

/** Standard folded-hem offset (Misses, Women's, Men's, Kids'). Baby uses {@link sidewaysCardiganFinishingProportions}. */
export const SIDEWAYS_FOLDED_HEM_OFFSET_INCHES =
  SIDEWAYS_FINISHING_PROPORTIONS_STANDARD.foldedHemOffsetInches;
/** Standard finished band width. Baby uses {@link sidewaysCardiganFinishingProportions}. */
export const SIDEWAYS_CARDIGAN_BAND_FINISHED_WIDTH_INCHES =
  SIDEWAYS_FINISHING_PROPORTIONS_STANDARD.bandFinishedWidthInches;
/** Standard knitted band depth. Baby uses {@link sidewaysCardiganFinishingProportions}. */
export const SIDEWAYS_CARDIGAN_BAND_CAST_ON_WIDTH_INCHES =
  SIDEWAYS_FINISHING_PROPORTIONS_STANDARD.bandKnittedDepthInches;

export function sidewaysCardiganFinishingProportions(
  chartAudience: unknown,
): SidewaysCardiganFinishingProportions {
  const raw = String(chartAudience ?? "").trim().toLowerCase();
  return raw === "baby"
    ? SIDEWAYS_FINISHING_PROPORTIONS_BABY
    : SIDEWAYS_FINISHING_PROPORTIONS_STANDARD;
}

/** Knitter-facing depth, including the ¾ inch baby hem. */
export function formatSidewaysFinishingInches(inches: number): string {
  if (Math.abs(inches - 0.75) < 0.001) return "¾ inch";
  const whole = Math.round(inches);
  if (Math.abs(inches - whole) < 0.001) {
    return whole === 1 ? "1 inch" : `${whole} inches`;
  }
  return `${inches} inches`;
}

/** Learning Library content_id for “Crisp, Decorative Fold”. */
export const SIDEWAYS_CARDIGAN_FOLD_VIDEO_CONTENT_ID = 1025;

export const SIDEWAYS_CARDIGAN_FOLD_VIDEO_WATCH_LABEL = "Watch: Crisp, decorative fold";

/** Learning Library content_id for “Kitchener Join (Grafting)”. */
export const SIDEWAYS_PULLOVER_GRAFT_VIDEO_CONTENT_ID = 927;

export const SIDEWAYS_PULLOVER_GRAFT_VIDEO_WATCH_LABEL = "Watch: Kitchener Join (Grafting)";

/**
 * Learning Library content_id for “Seam on the Machine” (Vimeo 1234021892).
 * The pattern button resolves this id to the catalog Vimeo id and opens
 * KinCatalogVideoModal. That modal plays `data-vimeo-id` directly, so someone
 * who can already see the finished pattern is not sent through the catalog
 * membership gate (`catalog-video-embed` / GatedVimeoEmbed). The catalog row
 * stays `access_level: member`; this does not unlock the library page.
 */
export const SIDEWAYS_PULLOVER_SHOULDER_SEAM_VIDEO_CONTENT_ID: number | null = 2215;

export const SIDEWAYS_PULLOVER_SHOULDER_SEAM_VIDEO_TITLE = "Seam on the Machine";

export const SIDEWAYS_PULLOVER_SHOULDER_SEAM_VIDEO_PLACEHOLDER_LABEL =
  "VIDEO PLACEHOLDER: Seam on the Machine";

export const SIDEWAYS_PULLOVER_SHOULDER_SEAM_VIDEO_WATCH_LABEL = "Watch: Seam on the Machine";

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

export function resolveSidewaysPulloverGraftVideo(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): SleevelessHelpVideoMeta | null {
  return sleevelessHelpVideoFromCatalog(SIDEWAYS_PULLOVER_GRAFT_VIDEO_CONTENT_ID, catalog);
}

export function sidewaysPulloverGraftVideoLinkHtml(
  video: SleevelessHelpVideoMeta | null = resolveSidewaysPulloverGraftVideo(),
): string {
  if (!video) return "";
  return (
    `<button type="button" class="kbm-kin-catalog-video pattern-help-link__button"` +
    ` data-vimeo-id="${escapeHtml(video.id)}"` +
    ` data-video-title="${escapeHtml(video.title)}"` +
    ` data-content-id="${SIDEWAYS_PULLOVER_GRAFT_VIDEO_CONTENT_ID}"` +
    ` data-video-autoplay="false"` +
    ` data-sideways-pullover-graft-video` +
    ` aria-haspopup="dialog">` +
    `${escapeHtml(SIDEWAYS_PULLOVER_GRAFT_VIDEO_WATCH_LABEL)}</button>`
  );
}

export function resolveSidewaysPulloverShoulderSeamVideo(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): SleevelessHelpVideoMeta | null {
  const contentId = SIDEWAYS_PULLOVER_SHOULDER_SEAM_VIDEO_CONTENT_ID;
  if (contentId == null) return null;
  return sleevelessHelpVideoFromCatalog(contentId, catalog);
}

/**
 * Standard catalog-video button once a content_id is set.
 * Until then, a visible placeholder with the same data hook and title.
 */
export function sidewaysPulloverShoulderSeamVideoLinkHtml(
  video: SleevelessHelpVideoMeta | null = resolveSidewaysPulloverShoulderSeamVideo(),
  contentId: number | null = SIDEWAYS_PULLOVER_SHOULDER_SEAM_VIDEO_CONTENT_ID,
): string {
  if (video && contentId != null) {
    return (
      `<button type="button" class="kbm-kin-catalog-video pattern-help-link__button"` +
      ` data-vimeo-id="${escapeHtml(video.id)}"` +
      ` data-video-title="${escapeHtml(video.title)}"` +
      ` data-content-id="${contentId}"` +
      ` data-video-autoplay="false"` +
      ` data-sideways-pullover-shoulder-seam-video` +
      ` aria-haspopup="dialog">` +
      `${escapeHtml(SIDEWAYS_PULLOVER_SHOULDER_SEAM_VIDEO_WATCH_LABEL)}</button>`
    );
  }
  return (
    `<span class="pattern-help-link__pending"` +
    ` data-sideways-pullover-shoulder-seam-video` +
    ` data-video-pending="true"` +
    ` data-video-title="${escapeHtml(SIDEWAYS_PULLOVER_SHOULDER_SEAM_VIDEO_TITLE)}">` +
    `${escapeHtml(SIDEWAYS_PULLOVER_SHOULDER_SEAM_VIDEO_PLACEHOLDER_LABEL)}</span>`
  );
}

/** Pullover shoulder selvages are closed edges. Seam them; do not graft them. */
export function sidewaysPulloverShoulderNecklineFinishingHtml(): string {
  const video = sidewaysPulloverShoulderSeamVideoLinkHtml();
  return (
    `<div class="sideways-finishing-shoulders">` +
    `<h3 class="sideways-finishing-shoulders__title">SHOULDER SEAMS AND NECKLINE</h3>` +
    `<p>The shoulder edges are closed selvage edges. Seam them. Do not graft them.</p>` +
    `<ol>` +
    `<li>Shoulder seam 1. Seam the Second Front Shoulder to the First Back Shoulder. Machine seaming is recommended. ` +
    `<p class="pattern-help-link">${video}</p>` +
    `Hand seaming is an alternative.</li>` +
    `<li>Finish the neckline while the opposite shoulder remains open.` +
    `<p><strong>Machine-knit neckband:</strong> With one shoulder open, pick up stitches around the V-neck and back neckline. Knit the neckband on the machine if enough needles are available.</p>` +
    `<p>Check your available needle count before choosing the machine-knit neckband.</p>` +
    `<p><strong>Other finishing options:</strong> Hand-knit a neckband, crochet an edging, or work an applied I-cord edging.</p>` +
    `</li>` +
    `<li>Shoulder seam 2. Seam the First Front Shoulder to the Second Back Shoulder.</li>` +
    `</ol>` +
    `</div>`
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

/** Needle count for the folded-hem turning line, using even stitch rounding. */
export function sidewaysFoldedHemTurningNeedle(
  stitchesPerInch: number,
  chartAudience?: unknown,
): number {
  const offset = sidewaysCardiganFinishingProportions(chartAudience).foldedHemOffsetInches;
  return evenPositiveBodyStitches(offset * stitchesPerInch);
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
  chartAudience?: unknown;
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
  const knittedDepth =
    sidewaysCardiganFinishingProportions(args.chartAudience).bandKnittedDepthInches;
  const castOnStitches = nearestOddPositiveStitches(knittedDepth * stitchGauge);
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

export function sidewaysFoldedHemCastOnSentence(
  turningNeedle: number,
  chartAudience?: unknown,
): string {
  const depth = formatSidewaysFinishingInches(
    sidewaysCardiganFinishingProportions(chartAudience).foldedHemOffsetInches,
  );
  return (
    `For an optional folded hem, leave needle ${turningNeedle} out of work. ` +
    `That needle is about ${depth} from the hem edge. ` +
    "Keep it out of work for the entire length of the sweater. This creates the turning line."
  );
}

export function renderSidewaysCardiganBandSectionHtml(args: {
  calc: SidewaysCardiganBodyCalc;
  stitchesPerInch: number;
  rowsPerInch: number;
  bandGauge?: SidewaysBandGauge;
  displayUnit?: MeasurementDisplayUnit;
  chartAudience?: unknown;
}): string {
  const proportions = sidewaysCardiganFinishingProportions(args.chartAudience);
  const opening = sidewaysCardiganFrontNeckOpeningInches(args);
  const band = sidewaysCardiganBandNumbers({
    openingInches: opening.totalInches,
    sweaterStitchesPerInch: args.stitchesPerInch,
    sweaterRowsPerInch: args.rowsPerInch,
    bandGauge: args.bandGauge,
    chartAudience: args.chartAudience,
  });
  const markers = sidewaysCardiganBandMarkers(opening, band.rowGauge);
  const markerItems = markers
    .map(
      (marker) =>
        `<li>${escapeHtml(marker.label)}: approximately row ${marker.rows}</li>`,
    )
    .join("");
  const basis = bandSwatchBasis(args.displayUnit);
  const stitchLabel = "Stitches per 4 inches (10 cm)";
  const rowLabel = "Rows per 4 inches (10 cm)";
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
    `<p class="sleeveless-pattern-line">The finished band is about ${formatSidewaysFinishingInches(proportions.bandFinishedWidthInches)} wide. Knit a separate ${proportions.bandKnittedDepthInches}-inch strip, then fold it lengthwise and sew it in place.</p>` +
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
    `<label>${stitchLabel} <input type="text" inputmode="decimal" autocomplete="off" data-sideways-band-stitches-per-inch value="${escapeHtml(stitchValue)}" /></label>` +
    `<label>${rowLabel} <input type="text" inputmode="decimal" autocomplete="off" data-sideways-band-rows-per-inch value="${escapeHtml(rowValue)}" /></label>` +
    `</details>` +
    `</div></section>`
  );
}

export function renderSidewaysFinishingSectionHtml(args: {
  garmentStyle: SidewaysCardiganGarmentStyle;
  turningNeedle: number;
}): string {
  const hem = `If you left needle ${args.turningNeedle} out of work as a turning line, fold the hem along that line and secure the hem edge to the inside.`;
  const steps: Array<string | { trustedHtml: string }> =
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
          "Remove the waste yarn from the initial side-seam stitches. Graft those open stitches to the corresponding side-seam stitches at the opposite end of the body. Graft from the hem to the marker, leaving the armhole opening unseamed.",
          { trustedHtml: sidewaysPulloverShoulderNecklineFinishingHtml() },
          hem,
          "Join the sleeve seams.",
          "Set the sleeves into the armhole openings.",
        ];
  const items = steps
    .map((step) => {
      if (typeof step !== "string") return `<li>${step.trustedHtml}</li>`;
      const foldLink =
        args.garmentStyle === "cardigan" && step.startsWith("Make and attach the cardigan front and neck band")
          ? ` ${sidewaysCardiganFoldVideoLinkHtml()}`
          : "";
      const graftLink =
        args.garmentStyle === "pullover" &&
        step.startsWith("Remove the waste yarn from the initial side-seam stitches.")
          ? ` ${sidewaysPulloverGraftVideoLinkHtml()}`
          : "";
      return `<li>${escapeHtml(step)}${foldLink}${graftLink}</li>`;
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
