/**
 * Circle Calculator plans.
 *
 * Wedge construction follows the reviewed 8-wedge example.
 * Flat short-row construction is a 6- or 8-sided polygon with a center-to-corner cast-on.
 * It is awaiting a knitted sample.
 * Knitter-facing pattern text stays separate from review notes.
 */

import { AVAILABLE_NEEDLES_REQUIRED_MESSAGE } from "../patterns/sleevelessExpressAvailableNeedles";

export const CIRCLE_CM_PER_INCH = 2.54;

export type CircleConstruction = "wedges" | "short-row";
export type WedgeDirection = "increase" | "decrease";
export type CircleWedgeCount = 6 | 8;
export type CircleLengthUnit = "in" | "cm";

export type CircleCalculatorInput = {
  construction: CircleConstruction;
  direction: WedgeDirection;
  wedges: CircleWedgeCount;
  /** Stitch count measured across `gaugeSpanInches`. */
  stitches: number;
  /** Row count measured across `gaugeSpanInches`. */
  rows: number;
  /** 4 for the inch gauge control, 10/2.54 for the centimeter gauge control. */
  gaugeSpanInches: number;
  diameter: number;
  unit: CircleLengthUnit;
  /** Working needles on the machine. A count equal to the piece is allowed. */
  availableNeedles: number;
};

export type CircleShapingRow = {
  row: number;
  stitchesOnNeedle: number;
};

export type CircleWedgePlan = {
  kind: "wedges";
  direction: WedgeDirection;
  wedges: CircleWedgeCount;
  stitchesPerInch: number;
  rowsPerInch: number;
  outerBodyStitches: number;
  outerNeedleStitches: number;
  taperRows: CircleShapingRow[];
  totalRows: number;
  geometricRows: number;
  rowsExtended: boolean;
  outerEdgeInches: number;
  innerEdgeInches: number;
  lengthInches: number;
  sideSeamInches: number;
  /** Assembled size from one flat edge to the opposite flat edge, including the one-stitch inner edges. */
  finishedAcrossFlatsInches: number;
  pointAngleDegrees: number;
  angleSumDegrees: number;
  maxStitchDeviation: number;
  outerStitchTie: boolean;
};

export type CircleShortRowStep = {
  step: number;
  returnNeedles: number;
  needlesWorking: number;
  rowCounterAfter: number;
};

export type CircleShortRowPlan = {
  kind: "short-row";
  wedges: CircleWedgeCount;
  stitchesPerInch: number;
  rowsPerInch: number;
  castOn: number;
  steps: CircleShortRowStep[];
  rowsPerWedge: number;
  /** Main-yarn rows knitted once, before the first section's shaping. */
  setupRows: number;
  /**
   * The piece is a 6- or 8-sided polygon. Each section's last full row runs from the
   * center to a corner, so the cast-on is the center-to-corner distance, and the
   * outermost needle's rows form one straight side. Awaiting a knitted sample.
   */
  cornerRadiusInches: number;
  sideInches: number;
  /** From the rounded stitch and row counts. */
  finishedAcrossFlatsInches: number;
  finishedAcrossCornersInches: number;
  /** Center angles of all sections together. 360 lies flat. */
  angleSumDegrees: number;
  /** Largest gap, in rows, between a needle's rows and a straight outside edge. */
  maxRowDeviation: number;
  centerEdgeInches: number;
  warnings: string[];
};

export type CirclePlan = CircleWedgePlan | CircleShortRowPlan;

export type CircleCalculatorSuccess = {
  ok: true;
  plan: CirclePlan;
  patternHtml: string;
  reviewNotes: string[];
  diagram: {
    wedges: CircleWedgeCount;
    diameterLabel: string;
  };
};

export type CircleCalculatorFailure = {
  ok: false;
  errors: string[];
};

export type CircleCalculatorResult = CircleCalculatorSuccess | CircleCalculatorFailure;

const SHORT_ROW_UNRESOLVED = [
  "How to close the center.",
];

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatCircleLength(inches: number, unit: CircleLengthUnit): string {
  const shown = unit === "cm" ? inches * CIRCLE_CM_PER_INCH : inches;
  return `${round2(shown).toFixed(2)} ${unit}`;
}

/** Outside edge of the finished circle. Wedge widths exclude the two seaming stitches. */
export function circleCircumferenceInches(plan: CirclePlan): number {
  return plan.kind === "wedges"
    ? plan.outerEdgeInches * plan.wedges
    : (plan.rowsPerWedge * plan.wedges + plan.setupRows) / plan.rowsPerInch;
}

export function circleCircumferenceText(plan: CirclePlan, unit: CircleLengthUnit): string {
  const inches = circleCircumferenceInches(plan);
  const shown = unit === "cm" ? inches * CIRCLE_CM_PER_INCH : inches;
  return `Approximate circumference: ${(Math.round(shown * 10) / 10).toFixed(1)} ${unit}`;
}

/** Whole-unit diagram label. The plan keeps the unrounded length. */
export function formatApproximateCircleLength(inches: number, unit: CircleLengthUnit): string {
  const shown = unit === "cm" ? inches * CIRCLE_CM_PER_INCH : inches;
  return `Approx ${Math.round(shown)} ${unit}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function trimNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = round2(value);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/**
 * Odd stitch count closest to `exact`.
 * An exact tie uses the larger odd count.
 */
export function nearestOddStitchCount(exact: number): { count: number; tie: boolean } {
  if (!Number.isFinite(exact) || exact <= 0) return { count: 1, tie: false };
  const floor = Math.floor(exact);
  const lowerOdd = floor % 2 === 1 ? floor : floor - 1;
  const candidates = [lowerOdd, lowerOdd + 2].filter((count) => count >= 1);
  const first = candidates[0] ?? 1;
  let best = first;
  let bestDistance = Math.abs(exact - best);
  let tie = false;
  for (const count of candidates.slice(1)) {
    const distance = Math.abs(exact - count);
    if (distance < bestDistance - 1e-9) {
      best = count;
      bestDistance = distance;
      tie = false;
    } else if (Math.abs(distance - bestDistance) <= 1e-9) {
      tie = true;
      if (count > best) best = count;
    }
  }
  return { count: best, tie };
}

/** Half-to-even, matching the reviewed wedge schedule. */
function roundHalfToEven(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (Math.abs(fraction - 0.5) < 1e-9) return floor % 2 === 0 ? floor : floor + 1;
  return Math.round(value);
}

/**
 * Needles one piece occupies.
 * A wedge uses its widest count, including both seaming stitches.
 * Short-row construction uses the full center-to-corner cast-on: stitches in work and stitches on hold.
 */
export function circleRequiredNeedles(plan: CirclePlan): number {
  if (plan.kind === "wedges") return plan.outerNeedleStitches;
  const knitting = plan.steps.reduce((max, step) => Math.max(max, step.needlesWorking), 0);
  const holding = Math.max(0, plan.castOn - knitting);
  return knitting + holding;
}

export function circleNeedleLimitMessage(requiredNeedles: number, availableNeedles: number): string {
  return `This pattern needs ${requiredNeedles} needles. You have ${availableNeedles} available. Try a smaller diameter.`;
}

export function taperRowNumbers(eventCount: number, span: number): number[] {
  const rows: number[] = [];
  for (let event = 1; event <= eventCount; event += 1) {
    rows.push(roundHalfToEven((event * span) / eventCount));
  }
  return rows;
}

function taperRowsFit(rows: number[], span: number): boolean {
  if (rows.length === 0) return span === 0;
  if (rows[0] < 1 || rows[rows.length - 1] !== span) return false;
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index] <= rows[index - 1]) return false;
  }
  return true;
}

function gaugeSpanLabel(spanInches: number, unit: CircleLengthUnit): string {
  if (unit === "cm" && Math.abs(spanInches - 10 / CIRCLE_CM_PER_INCH) < 1e-9) return "10 cm";
  if (Math.abs(spanInches - 4) < 1e-9) return "4 inches";
  if (Math.abs(spanInches - 1) < 1e-9) return "1 inch";
  return formatCircleLength(spanInches, "in");
}

function validateShared(input: CircleCalculatorInput): string[] {
  const errors: string[] = [];
  if (input.construction !== "wedges" && input.construction !== "short-row") {
    errors.push("Choose separate wedges or flat short-row construction.");
  }
  if (input.wedges !== 6 && input.wedges !== 8) {
    errors.push("Choose 6 or 8 wedges.");
  }
  if (!isPositive(input.stitches)) errors.push("Enter a stitch gauge greater than zero.");
  if (!isPositive(input.rows)) errors.push("Enter a row gauge greater than zero.");
  if (!isPositive(input.gaugeSpanInches)) errors.push("Enter a gauge measurement greater than zero.");
  if (!isPositive(input.diameter)) errors.push("Enter a finished size greater than zero.");
  if (input.unit !== "in" && input.unit !== "cm") errors.push("Choose inches or centimeters.");
  if (!Number.isInteger(input.availableNeedles) || input.availableNeedles < 1) {
    errors.push(AVAILABLE_NEEDLES_REQUIRED_MESSAGE);
  }
  return errors;
}

function rejectIfOverNeedleLimit(
  plan: CirclePlan,
  availableNeedles: number,
): CircleCalculatorFailure | null {
  const requiredNeedles = circleRequiredNeedles(plan);
  if (requiredNeedles > availableNeedles) {
    return { ok: false, errors: [circleNeedleLimitMessage(requiredNeedles, availableNeedles)] };
  }
  return null;
}

function perInch(count: number, spanInches: number): number {
  return count / spanInches;
}

function diameterInches(diameter: number, unit: CircleLengthUnit): number {
  return unit === "cm" ? diameter / CIRCLE_CM_PER_INCH : diameter;
}

function buildWedgePlan(input: CircleCalculatorInput): CircleWedgePlan | CircleCalculatorFailure {
  const stitchesPerInch = perInch(input.stitches, input.gaugeSpanInches);
  const rowsPerInch = perInch(input.rows, input.gaugeSpanInches);
  const flatInches = diameterInches(input.diameter, input.unit);
  const halfAngle = Math.PI / input.wedges;
  const chordInches = flatInches * Math.tan(halfAngle);
  const exactOuter = chordInches * stitchesPerInch;
  const outer = nearestOddStitchCount(exactOuter);
  const outerBodyStitches = outer.count;
  const outerNeedleStitches = outerBodyStitches + 2;
  const eventCount = (outerNeedleStitches - 3) / 2;
  if (outerBodyStitches < 3 || eventCount < 1) {
    return {
      ok: false,
      errors: ["This finished size is too small for the stitch gauge. Each wedge needs room to shape from 3 stitches to the outer edge."],
    };
  }

  const widthChangeInches = (outerBodyStitches - 1) / stitchesPerInch;
  const heightInches = widthChangeInches / 2 / Math.tan(halfAngle);
  const geometricRows = Math.round(heightInches * rowsPerInch);
  let totalRows = Math.max(geometricRows, eventCount + 1);
  let span = totalRows - 1;
  let taperEvents = taperRowNumbers(eventCount, span);
  let guard = 0;
  while (!taperRowsFit(taperEvents, span) && guard < 8) {
    totalRows += 1;
    span = totalRows - 1;
    taperEvents = taperRowNumbers(eventCount, span);
    guard += 1;
  }
  if (!taperRowsFit(taperEvents, span)) {
    return {
      ok: false,
      errors: ["These measurements cannot keep one stitch at each edge on every shaping row."],
    };
  }

  const startStitches = input.direction === "increase" ? 3 : outerNeedleStitches;
  const step = input.direction === "increase" ? 2 : -2;
  const taperRows = taperEvents.map((row, index) => ({
    row,
    stitchesOnNeedle: startStitches + step * (index + 1),
  }));
  if (input.direction === "decrease") {
    taperRows.push({ row: totalRows, stitchesOnNeedle: 1 });
  }

  const lengthInches = totalRows / rowsPerInch;
  const outerWidthInches = outerBodyStitches / stitchesPerInch;
  const innerWidthInches = 1 / stitchesPerInch;
  const finishedAcrossFlatsInches = (2 * lengthInches * outerWidthInches) / (outerWidthInches - innerWidthInches);
  const shapedHalfAngle = Math.atan(widthChangeInches / 2 / lengthInches);
  const pointAngleDegrees = (2 * shapedHalfAngle * 180) / Math.PI;
  let maxStitchDeviation = 0;
  taperEvents.forEach((row, index) => {
    const count = 3 + 2 * (index + 1);
    const ideal = 3 + (outerNeedleStitches - 3) * (row / totalRows);
    maxStitchDeviation = Math.max(maxStitchDeviation, Math.abs(count - ideal));
  });

  return {
    kind: "wedges",
    direction: input.direction,
    wedges: input.wedges,
    stitchesPerInch,
    rowsPerInch,
    outerBodyStitches,
    outerNeedleStitches,
    taperRows,
    totalRows,
    geometricRows,
    rowsExtended: totalRows !== geometricRows,
    outerEdgeInches: outerWidthInches,
    innerEdgeInches: innerWidthInches,
    lengthInches,
    sideSeamInches: Math.hypot(lengthInches, widthChangeInches / 2),
    finishedAcrossFlatsInches,
    pointAngleDegrees,
    angleSumDegrees: pointAngleDegrees * input.wedges,
    maxStitchDeviation,
    outerStitchTie: outer.tie,
  };
}

function buildShortRowPlan(input: CircleCalculatorInput): CircleShortRowPlan | CircleCalculatorFailure {
  const stitchesPerInch = perInch(input.stitches, input.gaugeSpanInches);
  const rowsPerInch = perInch(input.rows, input.gaugeSpanInches);
  const halfAngle = Math.PI / input.wedges;
  const requestedFlatsInches = diameterInches(input.diameter, input.unit);
  const requestedCornerInches = requestedFlatsInches / 2 / Math.cos(halfAngle);
  const castOn = Math.round(requestedCornerInches * stitchesPerInch);
  if (castOn < 2) {
    return {
      ok: false,
      errors: [`This circle is too small for the stitch gauge. The cast-on would be ${castOn} stitches.`],
    };
  }
  const cornerRadiusInches = castOn / stitchesPerInch;
  const idealSideRows = 2 * cornerRadiusInches * Math.sin(halfAngle) * rowsPerInch;
  const stepsPerWedge = Math.round(idealSideRows / 2);
  if (stepsPerWedge < 2) {
    return {
      ok: false,
      errors: ["This circle is too small for the row gauge. Each wedge needs at least two shaping steps."],
    };
  }
  if (stepsPerWedge > 1000) {
    return { ok: false, errors: ["This circle is too large for the calculator."] };
  }
  if (stepsPerWedge > castOn) {
    return {
      ok: false,
      errors: [
        `Each wedge needs ${stepsPerWedge} shaping steps and only has ${castOn} stitches. Some steps would return less than one stitch.`,
      ],
    };
  }

  const steps: CircleShortRowStep[] = [];
  let working = 0;
  for (let step = 1; step <= stepsPerWedge; step += 1) {
    const target = Math.floor((step * castOn) / stepsPerWedge);
    const returnNeedles = target - working;
    working = target;
    steps.push({
      step,
      returnNeedles,
      needlesWorking: working,
      rowCounterAfter: 2 * step,
    });
  }

  const rowsFromCenter: number[] = [];
  steps.forEach((step, index) => {
    for (let needle = 0; needle < step.returnNeedles; needle += 1) {
      rowsFromCenter.push(2 * (stepsPerWedge - index));
    }
  });
  rowsFromCenter.reverse();
  const rowsPerWedge = 2 * stepsPerWedge;
  // Within a section, a needle's rows grow in step with its distance from the center.
  let maxRowDeviation = 0;
  rowsFromCenter.forEach((knittedRows, index) => {
    const ideal = ((index + 0.5) / castOn) * rowsPerWedge;
    maxRowDeviation = Math.max(maxRowDeviation, Math.abs(knittedRows - ideal));
  });

  const sideInches = rowsPerWedge / rowsPerInch;
  const halfSideRatio = Math.min(1, sideInches / 2 / cornerRadiusInches);
  const sectionAngle = 2 * Math.asin(halfSideRatio);
  const angleSumDegrees = (sectionAngle * input.wedges * 180) / Math.PI;
  const finishedAcrossFlatsInches = 2 * Math.sqrt(cornerRadiusInches ** 2 - (sideInches / 2) ** 2);
  const flatsDiffPercent = ((finishedAcrossFlatsInches - requestedFlatsInches) / requestedFlatsInches) * 100;
  const warnings: string[] = [];
  if (Math.abs(angleSumDegrees - 360) > 360 * 0.02) {
    warnings.push(
      `The sections meet at ${round2(angleSumDegrees).toFixed(1)}° around the center instead of 360°. The piece may not lie flat.`,
    );
  }
  if (Math.abs(flatsDiffPercent) > 3) {
    warnings.push(
      `Rounding the stitches and rows changes the size across the flats by ${round2(flatsDiffPercent).toFixed(2)}%.`,
    );
  }
  if (stepsPerWedge < 4) {
    warnings.push(`Only ${stepsPerWedge} shaping steps per section. The short-row turns will be widely spaced.`);
  }

  return {
    kind: "short-row",
    wedges: input.wedges,
    stitchesPerInch,
    rowsPerInch,
    castOn,
    steps,
    rowsPerWedge,
    setupRows: 1,
    cornerRadiusInches,
    sideInches,
    finishedAcrossFlatsInches,
    finishedAcrossCornersInches: 2 * cornerRadiusInches,
    angleSumDegrees,
    maxRowDeviation,
    centerEdgeInches: (2 * input.wedges) / rowsPerInch,
    warnings,
  };
}

/** `rowLabel` names each row for the checkbox's accessible label, e.g. "row counter 3". */
function checklistTable(headers: string[], rows: string[][], rowLabel: (row: string[]) => string): string {
  const head = headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr><td class="circle-checklist__check"><label class="circle-checklist__check-label"><input type="checkbox" class="circle-checklist__box ns-shaping-chart__row-check" aria-label="Mark ${escapeHtml(rowLabel(row))} done" /></label></td>${row
          .map((cell) => `<td>${escapeHtml(cell)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<div class="circle-checklist-block"><div class="circle-checklist-actions no-print"><button type="button" class="circle-checklist-clear" data-checklist-clear disabled>Clear checkmarks</button></div><div class="circle-checklist-card"><table class="circle-checklist"><thead><tr><th scope="col" class="circle-checklist__check" aria-label="Done"></th>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`;
}

function wedgePatternHtml(input: CircleCalculatorInput, plan: CircleWedgePlan): string {
  const directionLabel = plan.direction === "increase" ? "Increase" : "Decrease";
  const gauge = `Gauge: ${trimNumber(input.stitches)} stitches and ${trimNumber(input.rows)} rows in ${gaugeSpanLabel(input.gaugeSpanInches, input.unit)}.`;
  const checklist = checklistTable(
    ["Row counter", "Stitches"],
    plan.taperRows.map((row) => [String(row.row), String(row.stitchesOnNeedle)]),
    ([row]) => `row counter ${row}`,
  );
  const shapingGuidance =
    plan.direction === "increase"
      ? "Work increases at least 1 stitch in from the edge for easier seaming."
      : "Work decreases at least 1 stitch in from the edge for easier seaming.";
  const setup =
    plan.direction === "increase"
      ? `<p>Scrap on 3 stitches with waste yarn: 1 seaming stitch, the center stitch, and 1 seaming stitch. Hang a suitable weight. Change to the main yarn and set the row counter to 000.</p>
         <p>Increase 1 stitch at each edge on each listed row.</p>
         <p>${shapingGuidance}</p>`
      : `<p>Cast on ${plan.outerNeedleStitches} stitches using the cast-on method of your choice: 1 seaming stitch, ${plan.outerBodyStitches} body stitches, and 1 seaming stitch. Set the row counter to 000.</p>
         <p>Decrease 1 stitch at each edge on each listed row.</p>
         <p>${shapingGuidance}</p>`;
  const ending =
    plan.direction === "increase"
      ? `<p>After the increase at RC ${plan.totalRows - 1}, knit 1 row across all ${plan.outerNeedleStitches} stitches (RC ${plan.totalRows}). Bind off.</p>`
      : `<p>Break the yarn and pull the tail through the last stitch.</p>`;
  const center =
    plan.direction === "increase"
      ? `<p>Thread a darning needle through the 3 starting stitches before removing the waste yarn. After joining the wedges, draw these stitches together to close the center and fasten securely.</p>`
      : `<p>Fasten the tails where the ${plan.wedges} wedges meet.</p>`;
  return `<div class="circle-pattern">
    <h3>Knit ${plan.wedges} wedges</h3>
    <p>${escapeHtml(gauge)}</p>
    <p>Seaming stitches are on the needles and are not included in the finished widths.</p>
    <p>Knit until the row counter shows the listed number, shape, then continue knitting.</p>
    <h3>${directionLabel}</h3>
    ${setup}
    ${checklist}
    ${ending}
    <p>Knit ${plan.wedges - 1} more wedges.</p>
    <h3>Finishing</h3>
    <p>Join the side edges with <a href="/glossary/mattress-stitch/" class="glossary-link">mattress stitch</a> or <a href="/glossary/sew-as-you-go/" class="glossary-link">sew-as-you-go</a>.</p>
    <p>If you plan to join the seams with Bickford seams, be aware that the pattern includes seaming stitches. <a href="/glossary/bickford-seam/" class="glossary-link">Bickford seam</a></p>
    ${center}
  </div>`;
}

function wedgeReviewNotes(input: CircleCalculatorInput, plan: CircleWedgePlan): string[] {
  const notes = [
    "These notes are not part of the pattern.",
    `Point angle ${round2(plan.pointAngleDegrees).toFixed(2)}°. ${plan.wedges} wedges come to ${round2(plan.angleSumDegrees).toFixed(2)}°.`,
    `After each taper step, the needle count stays within ${round2(plan.maxStitchDeviation).toFixed(2)} stitches of a straight side.`,
    "The fabric has not been tested by knitting this result.",
  ];
  if (plan.outerStitchTie) {
    const exact = diameterInches(input.diameter, input.unit) * Math.tan(Math.PI / input.wedges) * plan.stitchesPerInch;
    notes.push(
      `The outer edge calculated to ${round2(exact).toFixed(2)} stitches, equally close to ${plan.outerBodyStitches - 2} and ${plan.outerBodyStitches}. The pattern uses ${plan.outerBodyStitches}.`,
    );
  }
  if (plan.rowsExtended) {
    notes.push(
      `The rounded wedge height is ${plan.geometricRows} rows. Keeping one stitch at each edge needs ${plan.totalRows} rows, so the pattern uses ${plan.totalRows} rows.`,
    );
  }
  return notes;
}

function shortRowPatternHtml(input: CircleCalculatorInput, plan: CircleShortRowPlan): string {
  const gauge = `Gauge: ${trimNumber(input.stitches)} stitches and ${trimNumber(input.rows)} rows in ${gaugeSpanLabel(input.gaugeSpanInches, input.unit)}.`;
  const checklist = checklistTable(
    ["Needles returned", "Row counter", "Needles in work"],
    plan.steps.map((step) => [
      String(step.returnNeedles),
      String(step.rowCounterAfter),
      String(step.needlesWorking),
    ]),
    ([, rowCounter]) => `row counter ${rowCounter}`,
  );
  const firstReturn = plan.steps[0]?.returnNeedles ?? 1;
  const firstReturnNeedles = `${firstReturn} ${firstReturn === 1 ? "needle" : "needles"}`;
  return `<div class="circle-pattern">
    <h3>Work ${plan.wedges} short-row sections</h3>
    <p>${escapeHtml(gauge)}</p>
    <h3>Start</h3>
    <p><a href="/glossary/scrap-and-ravel-cast-on/" class="glossary-link">Scrap on</a> ${plan.castOn} stitches with waste yarn. Change to the main yarn.</p>
    <p>Knit ${plan.setupRows} row before starting the shaping. After this row, set the row counter to 000.</p>
    <p>Set the carriage to hold. Push all ${plan.castOn} needles to hold position.</p>
    <p>Return ${firstReturnNeedles} to work on the side opposite the carriage. This is the first row of the chart.</p>
    <h3>Short rows</h3>
    <p>Return needles to work in ${plan.steps.length} steps. For each chart row, return the listed number of needles to work on the side opposite the carriage. Knit 2 rows after each return.</p>
    <p>Wrap manually to prevent holes, as shown in the Short-row refresher video.</p>
    <p><a href="/videos/811" class="pattern-video-modal-link no-print" data-video-id="811" data-content-id="811"><i class="fa-solid fa-play" aria-hidden="true"></i> Short-row refresher</a></p>
    ${checklist}
    <p>The last 2 rows are knitted across all ${plan.castOn} stitches. The row counter shows ${plan.rowsPerWedge}.</p>
    <p>For each remaining section, set the row counter to 000, keep the carriage set to hold, push all ${plan.castOn} needles to hold position, and work the chart again. Knit the ${plan.setupRows} main-yarn row only once, at the start. Continue until ${plan.wedges} sections are complete.</p>
    <h3>End</h3>
    <p>After completing all ${plan.wedges} sections, <a href="/glossary/scrap-off/" class="glossary-link">scrap off</a> with waste yarn. Do not bind off the main-yarn stitches.</p>
    <h3>Finishing</h3>
    <p>Graft the starting and finishing live edges together with the <a href="/glossary/kitchener-stitch/" class="glossary-link">Kitchener join</a> to form the circle's single seam. Remove the waste yarn as the live stitches are secured during grafting.</p>
    <p>Close the center separately: thread a darning needle through the edge stitches at the center, draw them together, and fasten securely.</p>
  </div>`;
}

function shortRowReviewNotes(plan: CircleShortRowPlan): string[] {
  const shape = plan.wedges === 6 ? "hexagon" : "octagon";
  const inches = (value: number) => `${round2(value).toFixed(2)} inches`;
  const outsideRows = plan.rowsPerWedge * plan.wedges + plan.setupRows;
  return [
    "These notes are not part of the pattern.",
    `Awaiting a knitted sample. The ${shape} shape and finished size are calculated from the gauge. Only a knitted and measured sample can confirm them.`,
    `Cast-on, center to a corner: ${plan.castOn} stitches, ${inches(plan.cornerRadiusInches)}.`,
    `Outside edge of each section, one straight side: ${plan.rowsPerWedge} rows, ${inches(plan.sideInches)}.`,
    `Outside edge in total: ${outsideRows} rows, including ${plan.setupRows} setup row. No grafting allowance is added.`,
    `Calculated across the flats: ${inches(plan.finishedAcrossFlatsInches)}. Across the corners: ${inches(plan.finishedAcrossCornersInches)}.`,
    `The ${plan.wedges} sections meet at ${round2(plan.angleSumDegrees).toFixed(1)}° around the center. 360° lies flat. More can ripple, and less can cup.`,
    `Each needle's rows stay within ${round2(plan.maxRowDeviation).toFixed(2)} rows of a straight outside edge.`,
    `Center edge: ${inches(plan.centerEdgeInches)} around.`,
    ...plan.warnings,
    "Flat short-row knitting details are still open:",
    ...SHORT_ROW_UNRESOLVED,
    "The separate-wedge decisions do not settle this method.",
  ];
}

export type CircleDiagramContent = {
  wedges: CircleWedgeCount;
  title: string;
  diameterLabel: string;
  overallCaption: string;
  /** Separate wedges only. Short-row pieces do not use seaming stitches or a wedge direction. */
  wedge: {
    direction: WedgeDirection;
    outerEdgeLabel: string;
    outerStitches: number;
    seamingNote: string;
    heightLabel: string;
    rows: number;
    /** Inner edge is this fraction of the way from the center to the outer edge. */
    innerEdgeRatio: number;
  } | null;
  /** One continuous short-row piece. Counts are for a single section. */
  shortRow: {
    stitches: number;
    stitchMeasure: string;
    rows: number;
    rowMeasure: string;
  } | null;
};

/** Diagram text for one display unit. Stitch and row counts stay on the plan. */
export function circleDiagramContent(plan: CirclePlan, unit: CircleLengthUnit): CircleDiagramContent {
  if (plan.kind === "short-row") {
    return {
      wedges: plan.wedges,
      title: `Work ${plan.wedges} short-row sections`,
      diameterLabel: formatApproximateCircleLength(plan.finishedAcrossFlatsInches, unit),
      overallCaption: "Diameter",
      wedge: null,
      shortRow: {
        stitches: plan.castOn,
        stitchMeasure: formatCircleLength(plan.castOn / plan.stitchesPerInch, unit),
        rows: plan.rowsPerWedge,
        rowMeasure: formatCircleLength(plan.rowsPerWedge / plan.rowsPerInch, unit),
      },
    };
  }
  return {
    wedges: plan.wedges,
    title: `Knit ${plan.wedges} wedges`,
    diameterLabel: formatApproximateCircleLength(plan.finishedAcrossFlatsInches, unit),
    overallCaption: "Diameter",
    shortRow: null,
    wedge: {
      direction: plan.direction,
      outerEdgeLabel: formatCircleLength(plan.outerEdgeInches, unit),
      outerStitches: plan.outerNeedleStitches,
      seamingNote: "including 2 seaming",
      heightLabel: formatApproximateCircleLength(plan.lengthInches, unit),
      rows: plan.totalRows,
      innerEdgeRatio: 1 / plan.outerBodyStitches,
    },
  };
}

export function circleInstructionsHtml(
  input: CircleCalculatorInput,
  plan: CirclePlan,
  displayUnit: CircleLengthUnit = input.unit,
): string {
  return plan.kind === "short-row" ? shortRowPatternHtml(input, plan) : wedgePatternHtml(input, plan);
}

export function buildCircleCalculator(input: CircleCalculatorInput): CircleCalculatorResult {
  const errors = validateShared(input);
  if (input.construction === "wedges" && input.direction !== "increase" && input.direction !== "decrease") {
    errors.push("Choose increase or decrease wedges.");
  }
  if (errors.length > 0) return { ok: false, errors };

  if (input.construction === "short-row") {
    const plan = buildShortRowPlan(input);
    if ("ok" in plan) return plan;
    const overLimit = rejectIfOverNeedleLimit(plan, input.availableNeedles);
    if (overLimit) return overLimit;
    return {
      ok: true,
      plan,
      patternHtml: circleInstructionsHtml(input, plan),
      reviewNotes: shortRowReviewNotes(plan),
      diagram: {
        wedges: plan.wedges,
        diameterLabel: formatCircleLength(plan.finishedAcrossFlatsInches, input.unit),
      },
    };
  }

  const plan = buildWedgePlan(input);
  if ("ok" in plan) return plan;
  const overLimit = rejectIfOverNeedleLimit(plan, input.availableNeedles);
  if (overLimit) return overLimit;
  return {
    ok: true,
    plan,
    patternHtml: circleInstructionsHtml(input, plan),
    reviewNotes: wedgeReviewNotes(input, plan),
    diagram: {
      wedges: plan.wedges,
      diameterLabel: formatCircleLength(plan.finishedAcrossFlatsInches, input.unit),
    },
  };
}

export { SHORT_ROW_UNRESOLVED };
