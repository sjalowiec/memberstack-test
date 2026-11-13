/**
 * Point-to-point triangle scarf.
 *
 * One construction: cast on 3 stitches at the far right of the needlebed,
 * keep that right edge straight, increase at the left edge to the widest
 * section, then decrease at the left edge until 3 stitches remain.
 *
 * Point-to-point length runs in the knitting direction and sets the row count.
 * Scarf depth, perpendicular to the straight edge at the widest section, sets
 * the maximum stitch count. That rounded count must fit on the needle bed.
 * A saved `method` or `construction` query value is ignored.
 */
import videosPublic from "../../data/videos-public.json";
import type { PublicVideoRow } from "../lessonVideo";
import { buildPatternQuickTipInnerHtml } from "./patternQuickTip";
import { sleevelessHelpVideoFromCatalog } from "./sleevelessCatalogHelpVideo";

export type TriangleUnit = "in" | "cm";

/** Shown beside the cast-on. Gauge and stitch counts stay as entered. */
export const TRIANGLE_SCARF_NEEDLE_ARRANGEMENT_GUIDANCE =
  "You can knit this scarf on every needle or every other needle, in your chosen stitch pattern. Enter the gauge measured from your swatch. Stitch counts always mean actual stitches. If using every other needle, check that your working stitches fit across your needlebed.";

export const TRIANGLE_SCARF_EVERY_OTHER_NEEDLE_HELP_HREF = "/help-hub/swatching-every-other-needle";

export const TRIANGLE_SCARF_START_STITCHES = 3;

export const TRIANGLE_SCARF_CONSTRUCTION_SUMMARY =
  "Cast on 3 stitches at the far right of the needlebed. Increase as instructed until you reach the specified number of stitches. Then decrease as instructed until 3 stitches remain. Bind off the remaining 3 stitches.";

/** Learning Library “Basic Increasing and Decreasing”. */
export const TRIANGLE_SCARF_SHAPING_VIDEO_CONTENT_ID = 525;

/** Learning Library “Knit-in I-Cord”. Optional edge. Its stitches are already inside the stitch count. */
export const TRIANGLE_SCARF_ICORD_VIDEO_CONTENT_ID = 679;

export const TRIANGLE_SCARF_THUMBNAIL_SRC = "/images/patterns/triangle-scarf.png";

export interface TriangleScarfInputs {
  /** Scarf depth, perpendicular to the straight edge. Share param `w`. */
  depth: number;
  /** Point-to-point length in the knitting direction. Share param `l`. */
  length: number;
  stitchGauge: number;
  rowGauge: number;
  /** Full needle-bed count. Share param `n`. */
  needles: number;
  unit: TriangleUnit;
}

export interface ShapingPhaseResult {
  action: "increase" | "decrease";
  stitches: number;
  /** Rows between shaping actions, including the action row. */
  rows: number;
  times: number;
  side: "left edge";
}

export interface TriangleScarfOk {
  ok: true;
  construction: "point-to-point";
  startStitches: 3;
  endStitches: 3;
  maxStitches: number;
  totalRows: number;
  increaseRows: number;
  decreaseRows: number;
  /** Increase count and decrease count. Both equal maxStitches - 3. */
  shapingTimes: number;
  requestedDepth: number;
  requestedLength: number;
  knittedDepth: number;
  knittedLength: number;
  unit: TriangleUnit;
  /** Full needle-bed count. The maximum stitch count is checked against this. */
  needles: number;
  phases: ShapingPhaseResult[];
}

export interface TriangleScarfErr {
  ok: false;
  message: string;
}

export type TriangleScarfResult = TriangleScarfOk | TriangleScarfErr;

const LEGACY_METHOD_KEYS = ["method", "construction", "na"];

/** Parse a shareable URL. `w` is depth, `l` is point-to-point length. Legacy method keys are ignored. */
export function parseTriangleScarfSearchParams(searchParams: URLSearchParams): TriangleScarfInputs | null {
  const depth = parseFloat(String(searchParams.get("w") ?? ""));
  const length = parseFloat(String(searchParams.get("l") ?? ""));
  const stitchGauge = parseFloat(String(searchParams.get("sg") ?? ""));
  const rowGauge = parseFloat(String(searchParams.get("rg") ?? ""));
  const needles = parseInt(String(searchParams.get("n") ?? ""), 10);
  const uRaw = String(searchParams.get("u") ?? "in").toLowerCase();
  const unit: TriangleUnit = uRaw === "cm" ? "cm" : "in";

  if (
    !Number.isFinite(depth) ||
    !Number.isFinite(length) ||
    !Number.isFinite(stitchGauge) ||
    !Number.isFinite(rowGauge)
  ) {
    return null;
  }
  if (!Number.isFinite(needles)) return null;
  return { depth, length, stitchGauge, rowGauge, needles, unit };
}

/** Drop a saved construction flag or every-other-needle choice from a share URL. */
export function triangleScarfShareParams(input: TriangleScarfInputs): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set("w", String(input.depth));
  sp.set("l", String(input.length));
  sp.set("sg", String(input.stitchGauge));
  sp.set("rg", String(input.rowGauge));
  sp.set("n", String(input.needles));
  sp.set("u", input.unit);
  return sp;
}

export function stripLegacyTriangleScarfMethodParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  for (const key of LEGACY_METHOD_KEYS) next.delete(key);
  return next;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stitchesPerUnit(stitchGauge: number, unit: TriangleUnit): number {
  return stitchGauge / (unit === "cm" ? 10 : 4);
}

function rowsPerUnit(rowGauge: number, unit: TriangleUnit): number {
  return rowGauge / (unit === "cm" ? 10 : 4);
}

/**
 * Yarn area for this scarf, in square inches.
 * A point-to-point triangle's fabric is half the rectangle of its length and depth.
 */
export function triangleScarfYarnAreaSquareInches(
  length: number,
  depth: number,
  unit: TriangleUnit,
): number {
  if (!(length > 0) || !(depth > 0)) return 0;
  const toInches = (value: number) => (unit === "cm" ? value / 2.54 : value);
  return (toInches(length) * toInches(depth)) / 2;
}

export function formatTriangleMeasure(value: number, unit: TriangleUnit): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return unit === "cm" ? `${text} cm` : `${text} in`;
}

/** Yarn drawer heading for the size the knitter is making. */
export function triangleScarfYarnHeading(length: number, depth: number, unit: TriangleUnit): string {
  if (!(length > 0) || !(depth > 0)) return "How much yarn do I need?";
  const mark = unit === "cm" ? " cm" : "″";
  const format = (value: number) => {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  };
  return `How much yarn do I need for my ${format(length)}${mark} × ${format(depth)}${mark} project?`;
}

/**
 * One interval per left-edge shaping row, mixed through the half.
 * When two intervals are needed, the longer gaps are spread among the shorter
 * ones. They are not worked as one block of each rate.
 * The intervals add up to `phaseRows`, and there is one entry per shaping.
 */
export function triangleScarfShapingIntervals(phaseRows: number, times: number): number[] {
  if (times <= 0 || phaseRows <= 0 || times > phaseRows) return [];
  const base = Math.floor(phaseRows / times);
  const extra = phaseRows - base * times;
  const intervals: number[] = [];
  let debt = 0;
  for (let index = 0; index < times; index++) {
    debt += extra;
    if (debt >= times) {
      intervals.push(base + 1);
      debt -= times;
    } else {
      intervals.push(base);
    }
  }
  return intervals;
}

function phaseSegments(
  action: "increase" | "decrease",
  phaseRows: number,
  times: number,
): ShapingPhaseResult[] {
  const phases: ShapingPhaseResult[] = [];
  for (const interval of triangleScarfShapingIntervals(phaseRows, times)) {
    const last = phases[phases.length - 1];
    if (last && last.rows === interval) {
      last.times += 1;
    } else {
      phases.push({
        action,
        stitches: 1,
        rows: interval,
        times: 1,
        side: "left edge",
      });
    }
  }
  return phases;
}

function rowsInPhases(phases: ShapingPhaseResult[]): number {
  return phases.reduce((sum, phase) => sum + phase.rows * phase.times, 0);
}

function timesInPhases(phases: ShapingPhaseResult[]): number {
  return phases.reduce((sum, phase) => sum + phase.times, 0);
}

export function calculateTriangleScarf(input: TriangleScarfInputs): TriangleScarfResult {
  const { depth, length, stitchGauge, rowGauge, needles, unit } = input;

  if (!Number.isFinite(depth) || depth <= 0) {
    return { ok: false, message: "Enter a scarf depth greater than zero." };
  }
  if (!Number.isFinite(length) || length <= 0) {
    return { ok: false, message: "Enter a point-to-point length greater than zero." };
  }
  if (!Number.isFinite(stitchGauge) || stitchGauge <= 0) {
    return { ok: false, message: "Enter stitch gauge (stitches per 4″ or per 10 cm)." };
  }
  if (!Number.isFinite(rowGauge) || rowGauge <= 0) {
    return { ok: false, message: "Enter row gauge (rows per 4″ or per 10 cm)." };
  }
  if (!Number.isFinite(needles) || needles < 50 || needles > 400) {
    return { ok: false, message: "Enter available needles (50–400), matching your machine bed." };
  }

  const su = stitchesPerUnit(stitchGauge, unit);
  const ru = rowsPerUnit(rowGauge, unit);
  const maxStitches = Math.round(depth * su);
  const totalRows = Math.round(length * ru);

  if (maxStitches <= TRIANGLE_SCARF_START_STITCHES) {
    const noun = maxStitches === 1 ? "stitch" : "stitches";
    return {
      ok: false,
      message: `Scarf depth rounds to ${maxStitches} ${noun}. This pattern starts and ends with 3 stitches and must increase beyond that. Increase the scarf depth. The point-to-point length was not changed.`,
    };
  }

  if (maxStitches > needles) {
    return {
      ok: false,
      message: `Not enough needles to knit this size. Reduce the scarf depth or use a machine with more available needles. Required needles: ${maxStitches}. Available needles: ${needles}.`,
    };
  }

  if (totalRows < 2) {
    const noun = totalRows === 1 ? "row" : "rows";
    return {
      ok: false,
      message: `Point-to-point length rounds to ${totalRows} ${noun}. This construction needs rows in both halves: one half to increase from 3 stitches to the widest section, and one half to decrease back to 3. Increase the point-to-point length. The scarf depth was not changed.`,
    };
  }

  const shapingTimes = maxStitches - TRIANGLE_SCARF_START_STITCHES;
  const increaseRows = Math.floor(totalRows / 2);
  const decreaseRows = totalRows - increaseRows;

  if (shapingTimes > increaseRows || shapingTimes > decreaseRows) {
    return {
      ok: false,
      message: `The scarf depth works out to ${maxStitches} stitches, so this pattern needs ${shapingTimes} increases on the way out and ${shapingTimes} decreases on the way back. The point-to-point length works out to ${totalRows} rows: ${increaseRows} to increase and ${decreaseRows} to decrease. Each shaping needs its own row, and these rows cannot hold that many. Make the scarf longer from point to point, or reduce the scarf depth. These measurements were not changed.`,
    };
  }

  const increasePhases = phaseSegments("increase", increaseRows, shapingTimes);
  const decreasePhases = phaseSegments("decrease", decreaseRows, shapingTimes);
  const phases = [...increasePhases, ...decreasePhases];

  if (
    timesInPhases(increasePhases) !== shapingTimes ||
    timesInPhases(decreasePhases) !== shapingTimes ||
    rowsInPhases(increasePhases) !== increaseRows ||
    rowsInPhases(decreasePhases) !== decreaseRows ||
    increaseRows + decreaseRows !== totalRows
  ) {
    return {
      ok: false,
      message:
        "These measurements could not be turned into one increase half and one decrease half. The scarf depth and point-to-point length were not changed.",
    };
  }

  return {
    ok: true,
    construction: "point-to-point",
    startStitches: TRIANGLE_SCARF_START_STITCHES,
    endStitches: TRIANGLE_SCARF_START_STITCHES,
    maxStitches,
    totalRows,
    increaseRows,
    decreaseRows,
    shapingTimes,
    requestedDepth: depth,
    requestedLength: length,
    knittedDepth: maxStitches / su,
    knittedLength: totalRows / ru,
    unit,
    needles,
    phases,
  };
}

/** Row-by-row check used by tests and the dev assertion. */
export function simulateTriangleScarf(result: TriangleScarfOk): {
  rows: number;
  startStitches: number;
  stitchesAfterIncreases: number;
  endStitches: number;
  maxSeen: number;
} {
  let stitches = result.startStitches;
  let rows = 0;
  let stitchesAfterIncreases = result.startStitches;
  let maxSeen = stitches;
  let increasesDone = false;

  for (const phase of result.phases) {
    if (phase.action === "decrease" && !increasesDone) {
      stitchesAfterIncreases = stitches;
      increasesDone = true;
    }
    for (let time = 0; time < phase.times; time++) {
      rows += phase.rows;
      stitches += phase.action === "increase" ? phase.stitches : -phase.stitches;
      if (stitches > maxSeen) maxSeen = stitches;
    }
  }
  if (!increasesDone) stitchesAfterIncreases = stitches;

  return {
    rows,
    startStitches: result.startStitches,
    stitchesAfterIncreases,
    endStitches: stitches,
    maxSeen,
  };
}

function catalogVideoButton(contentId: number, hook: string): string {
  const video = sleevelessHelpVideoFromCatalog(contentId, videosPublic as PublicVideoRow[]);
  if (!video) return "";
  return (
    `<span class="pattern-help-link">` +
    `<button type="button" class="kbm-kin-catalog-video pattern-help-link__button"` +
    ` data-vimeo-id="${escapeHtml(video.id)}"` +
    ` data-video-title="${escapeHtml(video.title)}"` +
    ` data-content-id="${contentId}"` +
    ` data-video-autoplay="false"` +
    ` data-vimeo-defer` +
    ` ${hook}` +
    ` aria-haspopup="dialog">` +
    `<i class="fa-solid fa-play" aria-hidden="true"></i> ` +
    `${escapeHtml(`Watch: ${video.title}`)}</button></span>`
  );
}

export type TriangleScarfChecklistRow = {
  row: number;
  action: "increase" | "decrease";
  stitchesAfter: number;
  interval: number;
};

/** Row-by-row schedule shared by the written instructions, checklist, and print. */
export function triangleScarfChecklist(result: TriangleScarfOk): TriangleScarfChecklistRow[] {
  const rows: TriangleScarfChecklistRow[] = [];
  let stitches = result.startStitches;
  let cursor = 1;

  const append = (intervals: number[], action: "increase" | "decrease") => {
    for (const interval of intervals) {
      const row = cursor + interval - 1;
      stitches += action === "increase" ? 1 : -1;
      rows.push({ row, action, stitchesAfter: stitches, interval });
      cursor = row + 1;
    }
  };

  append(triangleScarfShapingIntervals(result.increaseRows, result.shapingTimes), "increase");
  append(triangleScarfShapingIntervals(result.decreaseRows, result.shapingTimes), "decrease");
  return rows;
}

function describeRates(intervals: number[]): string {
  const counts = new Map<number, number>();
  for (const interval of intervals) counts.set(interval, (counts.get(interval) ?? 0) + 1);
  return [...counts.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([interval, times]) => {
      const rowClause = interval === 1 ? "every row" : `every ${interval} rows`;
      const timeWord = times === 1 ? "time" : "times";
      return `${rowClause} ${times} ${timeWord}`;
    })
    .join(" and ");
}

function renderHalfSchedule(
  action: "increase" | "decrease",
  intervals: number[],
  phaseRows: number,
  checklistRows: TriangleScarfChecklistRow[],
): string {
  const verb = action === "increase" ? "Increase" : "Decrease";
  const distinct = new Set(intervals);
  const lead =
    distinct.size <= 1
      ? `${verb} 1 stitch on the left edge ${describeRates(intervals)}.`
      : `${verb} 1 stitch on the left edge ${intervals.length} times across these ${phaseRows} rows. Use ${describeRates(intervals)}, spread through the half in the checklist order.`;
  const tableRows = checklistRows
    .map(
      (entry) =>
        `<tr data-ts-shaping-row="${entry.row}" data-ts-shaping-action="${entry.action}" data-ts-shaping-interval="${entry.interval}">` +
        `<td>Row ${entry.row}</td>` +
        `<td>${verb} 1 stitch on the left edge</td>` +
        `<td>${entry.stitchesAfter} stitches</td>` +
        `</tr>`,
    )
    .join("");

  return `
<div class="ts-instructions-block ts-pattern-steps">
  <p>${lead}</p>
  <table class="ts-shaping-checklist">
    <caption>${verb} checklist</caption>
    <thead><tr><th>Row</th><th>Shaping</th><th>Stitches after</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>`;
}

function wrapTriangleScarfSection(id: string, title: string, contentHtml: string): string {
  return `<section id="${id}" class="pattern-section" data-section-id="${id}">
  <div class="pattern-section__header">
    <label class="pattern-section__collapse-label">
      <input type="checkbox" class="pattern-section__collapse" data-section-id="${id}" aria-label="Collapse ${escapeHtml(title)}" />
    </label>
    <div class="pattern-section__heading"><h2>${escapeHtml(title)}</h2></div>
  </div>
  <div class="pattern-section__content">${contentHtml}</div>
</section>`;
}

function triangleScarfPatternTip(id: string, bodyHtml: string): string {
  return `<div class="pattern-tip" data-tip data-tip-id="${id}">${bodyHtml}</div>`;
}

function triangleScarfWiderScarfTip(): string {
  const body =
    `<p>${escapeHtml(TRIANGLE_SCARF_NEEDLE_ARRANGEMENT_GUIDANCE)}</p>` +
    `<p><a href="${TRIANGLE_SCARF_EVERY_OTHER_NEEDLE_HELP_HREF}">Swatching on every other needle</a></p>`;
  return (
    `<div class="pattern-tip pattern-quick-tip" data-tip data-tip-id="triangle-scarf-wider-scarf">` +
    buildPatternQuickTipInnerHtml({
      summaryLabel: "Want a wider scarf?",
      bodyHtml: body,
    }) +
    `</div>`
  );
}

/** Print “At a glance” and the on-screen header use the same facts as the instructions. */
export function buildTriangleScarfAtAGlanceHtml(result: TriangleScarfOk): string {
  const unit = result.unit;
  const rows: Array<[string, string]> = [
    ["Construction", "Point to widest section to point"],
    ["Cast on and bind off", "3 stitches"],
    ["Maximum stitches", `${result.maxStitches} (needle limit ${result.needles})`],
    [
      "Scarf depth",
      `requested ${formatTriangleMeasure(result.requestedDepth, unit)}, knits to ${formatTriangleMeasure(result.knittedDepth, unit)}`,
    ],
    [
      "Point-to-point length",
      `requested ${formatTriangleMeasure(result.requestedLength, unit)}, knits to ${formatTriangleMeasure(result.knittedLength, unit)}`,
    ],
    ["Total rows", String(result.totalRows)],
    [
      "Shaping",
      `${result.increaseRows} increase rows and ${result.decreaseRows} decrease rows at the left edge`,
    ],
  ];
  return `<dl class="print-summary-dl">${rows
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join("")}</dl>`;
}

export function buildTriangleScarfPatternHtml(result: TriangleScarfOk): string {
  const unit = result.unit;
  const requestedDepth = formatTriangleMeasure(result.requestedDepth, unit);
  const knittedDepth = formatTriangleMeasure(result.knittedDepth, unit);
  const requestedLength = formatTriangleMeasure(result.requestedLength, unit);
  const knittedLength = formatTriangleMeasure(result.knittedLength, unit);
  const checklist = triangleScarfChecklist(result);
  const increaseRows = checklist.filter((entry) => entry.action === "increase");
  const decreaseRows = checklist.filter((entry) => entry.action === "decrease");
  const increaseIntervals = triangleScarfShapingIntervals(result.increaseRows, result.shapingTimes);
  const decreaseIntervals = triangleScarfShapingIntervals(result.decreaseRows, result.shapingTimes);
  const midpointNote =
    result.increaseRows === result.decreaseRows
      ? ""
      : `<p class="ts-midpoint-note">The two halves differ by one row. That extra row is only in the decrease half, so the widest stitch count is shaped once.</p>`;

  const shapingVideo = catalogVideoButton(
    TRIANGLE_SCARF_SHAPING_VIDEO_CONTENT_ID,
    `data-triangle-scarf-video="shaping"`,
  );
  const icordVideo = catalogVideoButton(
    TRIANGLE_SCARF_ICORD_VIDEO_CONTENT_ID,
    `data-triangle-scarf-video="i-cord"`,
  );
  const shapingTip = shapingVideo
    ? triangleScarfPatternTip(
        "triangle-scarf-shaping-video",
        `<p><strong>Tip:</strong> See how increases and decreases are worked on the machine.</p><p class="pattern-tip-media-no-print no-print">${shapingVideo}</p>`,
      )
    : "";
  const icordTip = icordVideo
    ? triangleScarfPatternTip(
        "triangle-scarf-icord-video",
        `<p class="pattern-tip-media-no-print no-print">${icordVideo}</p>`,
      )
    : "";

  const capacity = `needle limit ${result.needles}`;

  return `
<div class="ts-pattern-body">
  ${wrapTriangleScarfSection(
    "construction",
    "Your scarf",
    `<ul class="ts-pattern-summary__list">
      <li><strong>Construction:</strong> Point → widest section → point</li>
      <li><strong>Cast on and bind off:</strong> 3 stitches</li>
      <li><strong>Maximum stitches:</strong> ${result.maxStitches} (${capacity})</li>
      <li><strong>Scarf depth:</strong> requested ${escapeHtml(requestedDepth)}, knits to ${escapeHtml(knittedDepth)}</li>
      <li><strong>Total rows:</strong> ${result.totalRows}</li>
      <li><strong>Point-to-point length:</strong> requested ${escapeHtml(requestedLength)}, knits to ${escapeHtml(knittedLength)}</li>
      <li><strong>Increase half:</strong> ${result.increaseRows} rows, ${result.shapingTimes} increases at the left edge</li>
      <li><strong>Decrease half:</strong> ${result.decreaseRows} rows, ${result.shapingTimes} decreases at the left edge</li>
    </ul>
    <p>${escapeHtml(TRIANGLE_SCARF_CONSTRUCTION_SUMMARY)}</p>
    <p>Cast on <strong>3</strong> stitches at the far right of the needlebed. Keep the right edge straight.</p>
    ${triangleScarfWiderScarfTip()}
    <p>Increase at the <strong>left edge</strong> until you have <strong>${result.maxStitches}</strong> stitches.</p>`,
  )}
  ${wrapTriangleScarfSection(
    "increase",
    "Increase",
    `${renderHalfSchedule("increase", increaseIntervals, result.increaseRows, increaseRows)}${shapingTip}`,
  )}
  ${wrapTriangleScarfSection(
    "decrease",
    "Decrease",
    `<p>Decrease at the <strong>left edge</strong> until <strong>3</strong> stitches remain.</p>
    ${midpointNote}
    ${renderHalfSchedule("decrease", decreaseIntervals, result.decreaseRows, decreaseRows)}`,
  )}
  ${wrapTriangleScarfSection(
    "bind-off",
    "Bind off",
    `<p>Bind off the remaining 3 stitches.</p>`,
  )}
  ${wrapTriangleScarfSection(
    "optional-edge",
    "Optional edge",
    `<p>Optional edge: Knit-in I-cord. The I-cord stitches are included in the stitch count and in the maximum needle requirement. They are not added stitches. When you use the knit-in I-cord, work the increases and decreases a few stitches in from the left edge so those I-cord stitches stay at the edge. The increase total, the decrease total, and the widest stitch count stay the same.</p>
    ${icordTip}`,
  )}
</div>`.trim();
}
