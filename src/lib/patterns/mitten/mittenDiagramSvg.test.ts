import { describe, expect, it } from "vitest";
import { mittenSizingRow } from "./mittenSizingChart";
import {
  buildMittenDiagramSvg,
  formatMittenDiagramInches,
  formatMittenDiagramLength,
  MITTEN_SUMMARY_CHIP,
  MITTEN_SUMMARY_TARGETS,
  mittenDiagramMeasurements,
  mittenSummaryMinPxPerUnit,
} from "./mittenDiagramSvg";
import {
  calculateMittenPattern,
  measurementsFromSizingRow,
  womanSmallPreviewCalc,
} from "./mittenMath";

function attr(svg: string, name: string): number {
  const match = svg.match(new RegExp(`data-${name}="([^"]+)"`));
  expect(match, name).toBeTruthy();
  return Number(match?.[1]);
}

function calcFor(size: string) {
  const row = mittenSizingRow(size);
  expect(row, size).toBeTruthy();
  const result = calculateMittenPattern({
    ...measurementsFromSizingRow(row!),
    stitchGaugePerInch: 7,
    rowGaugePerInch: 10,
  });
  expect(result.ok, size).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return result.calc;
}

function expectSketch(size: string) {
  const calc = calcFor(size);
  const measures = mittenDiagramMeasurements(calc);
  for (const edge of ["right", "left"] as const) {
    const svg = buildMittenDiagramSvg(calc, edge);
    expect(svg).toContain('data-diagram="mitten-sketch"');
    expect(svg).toContain(`data-slot-edge="${edge}"`);
    expect(svg).toContain('data-opening="hand"');
    expect(svg).toContain('data-opening="thumb"');
    expect(svg).toContain('data-separation="inner"');
    expect(svg).toContain('data-separation="outer"');
    expect(svg).toContain(`Fingertip ${formatMittenDiagramLength(measures.fingertipDepthIn)} in`);
    expect(svg).toContain(`Cuff ${formatMittenDiagramLength(measures.cuffLengthIn)} in`);
    expect(svg).toContain(`Hand 1 ${formatMittenDiagramLength(measures.hand1LengthIn)} in`);
    expect(svg).toContain(`Hand 2 ${formatMittenDiagramLength(measures.slotToFingertipIn)} in`);
    expect(svg).toContain(`Total ${formatMittenDiagramLength(measures.totalLengthIn)} in`);
    expect(svg).toContain(`Thumb length`);
    expect(svg).toContain(`${formatMittenDiagramLength(measures.thumbLengthIn)} in`);
    expect(svg).toContain("Hand circumference");
    expect(svg).toContain(`${formatMittenDiagramInches(measures.handCircumferenceIn)} in`);
    expect(svg).toContain("Thumb circumference");
    expect(svg).toContain(`${formatMittenDiagramInches(measures.thumbCircumferenceIn)} in`);
    expect(svg).not.toContain("Hand width");
    expect(svg).not.toContain("Thumb width");
    expect(svg).not.toContain("not included in the length");
    expect(svg).not.toContain("setup row");
    expect(svg).not.toContain("Fingertip pocket");
    expect(svg).not.toContain("Gathered top");
    expect(svg).not.toContain(`${calc.fingertip.shortRowKnittingRows} rows`);
    expect(attr(svg, "fingertip-depth-rows")).toBe(calc.fingertip.shortRowDepthRows);
    const thumbX = attr(svg, "thumb-base-x");
    const handMid = attr(svg, "hand-mid-x");
    if (edge === "right") expect(thumbX).toBeGreaterThan(handMid);
    else expect(thumbX).toBeLessThan(handMid);
    const bodyIn =
      measures.cuffLengthIn +
      measures.hand1LengthIn +
      measures.straightLengthIn +
      measures.setupRowIn +
      measures.fingertipDepthIn;
    expect(attr(svg, "hand-width-px") / attr(svg, "total-height-px")).toBeCloseTo(
      measures.handDisplayIn / bodyIn,
      2,
    );
    expect(attr(svg, "fingertip-depth-px") / attr(svg, "hand-width-px")).toBeCloseTo(
      measures.fingertipDepthIn / measures.handDisplayIn,
      2,
    );
    expect(attr(svg, "thumb-width-px") / attr(svg, "thumb-length-px")).toBeCloseTo(
      measures.thumbDisplayIn / measures.thumbLengthIn,
      2,
    );
    expect(attr(svg, "cuff-width-px") / attr(svg, "hand-width-px")).toBeCloseTo(
      measures.cuffDisplayIn / measures.handDisplayIn,
      2,
    );
    const view = svg.match(/viewBox="([^"]+)"/)?.[1]?.split(/[\s,]+/).map(Number) ?? [];
    const viewW = view[2] ?? 0;
    expect(viewW, `${size} ${edge} viewBox`).toBeGreaterThan(0);
    expect(viewW).toBeLessThan(640);
    expect(attr(svg, "hand-width-px") / viewW).toBeGreaterThan(0.28);
  }
}

describe("slotted mitten diagrams", () => {
  it("draws Woman Small as a flat mitten at half the calculated circumference", () => {
    const calc = womanSmallPreviewCalc();
    const measures = mittenDiagramMeasurements(calc);
    expect(measures.handWidthIn).toBeCloseTo(50 / 7, 5);
    expect(measures.handDisplayIn).toBeCloseTo(50 / 14, 5);
    expect(measures.cuffDisplayIn).toBeCloseTo(46 / 14, 5);
    expect(measures.thumbDisplayIn).toBeCloseTo(19 / 14, 5);
    expect(measures.fingertipDepthIn).toBeCloseTo(1.6, 5);
    expect(measures.cuffLengthIn).toBeCloseTo(2.6, 5);
    expect(measures.thumbLengthIn).toBeCloseTo(2.4, 5);
    expect(measures.totalLengthIn).toBeCloseTo(
      measures.cuffLengthIn + measures.hand1LengthIn + measures.slotToFingertipIn,
      5,
    );
    expect(measures.slotToFingertipIn).toBeCloseTo(
      measures.straightLengthIn + measures.setupRowIn + measures.fingertipDepthIn,
      5,
    );
    expect(measures.setupRowIn).toBeCloseTo(1 / calc.rowGaugePerInch, 5);
    expect(measures.handCircumferenceIn).toBe(7);
    expect(measures.thumbCircumferenceIn).toBe(2.75);
    const svg = buildMittenDiagramSvg(calc, "right");
    expect(svg).toContain("Total 8.7 in");
    expect(svg).toContain("Cuff 2.6 in");
    expect(svg).toContain("Hand 1 2.0 in");
    expect(svg).toContain("Hand 2 4.1 in");
    expect(svg).toContain("Fingertip 1.6 in");
    expect(svg).toContain("Thumb length");
    expect(svg).toContain("2.4 in");
    expect(svg).toContain("Hand circumference");
    expect(svg).toContain("7 in");
    expect(svg).toContain("Thumb circumference");
    expect(svg).toContain("2.75 in");
    expect(svg).not.toContain("Hand width");
    expect(svg).not.toContain("Thumb width");
    expect(svg).not.toContain("3.57");
    expect(svg).not.toContain("1.36");
    expect(svg).not.toContain("setup row");
    expect(svg).not.toContain("32 rows");
    expect(attr(svg, "hand2-px")).toBeCloseTo(
      attr(svg, "fingertip-depth-px") +
        ((measures.straightLengthIn + measures.setupRowIn) / measures.handDisplayIn) *
          attr(svg, "hand-width-px"),
      1,
    );
  });

  it("keeps the smallest and largest sizes to scale and mirrored", () => {
    expectSketch("child_2_4");
    expectSketch("man_lg");
  });

  it("changes the drawing when the gauge changes", () => {
    const row = mittenSizingRow("woman_sm");
    const atSeven = calculateMittenPattern({
      ...measurementsFromSizingRow(row!),
      stitchGaugePerInch: 7,
      rowGaugePerInch: 10,
    });
    const atEight = calculateMittenPattern({
      ...measurementsFromSizingRow(row!),
      stitchGaugePerInch: 8,
      rowGaugePerInch: 10,
    });
    expect(atSeven.ok && atEight.ok).toBe(true);
    if (!atSeven.ok || !atEight.ok) return;
    const seven = buildMittenDiagramSvg(atSeven.calc, "right");
    const eight = buildMittenDiagramSvg(atEight.calc, "right");
    expect(attr(seven, "hand-width-px")).toBeCloseTo(attr(eight, "hand-width-px"), 1);
    expect(attr(seven, "cuff-width-px")).not.toBeCloseTo(attr(eight, "cuff-width-px"), 1);
    expect(seven).not.toContain("Hand width");
    expect(eight).not.toContain("Hand width");
    expect(seven).toContain("Hand circumference");
    expect(seven).toContain("7 in");
    expect(eight).toContain("Hand circumference");
    expect(eight).toContain("7 in");
  });

  it("keeps the printed diagram labels and adds summary anchors only in summary mode", () => {
    const calc = womanSmallPreviewCalc();
    const pattern = buildMittenDiagramSvg(calc, "right");
    const summary = buildMittenDiagramSvg(calc, "right", "summary");
    expect(pattern).toContain("Thumb length");
    expect(pattern).not.toContain('id="target_mitten_thumb_length"');
    expect(summary).toContain('id="target_mitten_thumb_length"');
    expect(summary).toContain('id="target_mitten_cuff_circ"');
    expect(summary).toContain('id="target_mitten_hand_circ"');
    expect(summary).not.toContain("Thumb length");
    expect(summary).not.toContain("Hand circumference");
    expect(summary).toContain('data-diagram-mode="summary"');
    expect(pattern).not.toContain('data-diagram-mode="summary"');
  });
});

function circle(svg: string, id: string): { x: number; y: number } {
  const match = svg.match(new RegExp(`id="${id}"[^>]*cx="([^"]+)" cy="([^"]+)"`));
  expect(match, id).toBeTruthy();
  return { x: Number(match?.[1]), y: Number(match?.[2]) };
}

describe("mitten summary measurement layout", () => {
  it("keeps the mitten proportions and parks the seven anchors outside the outline", () => {
    for (const size of ["child_2_4", "man_lg"]) {
      for (const thumbStyle of ["slotted", "gored"] as const) {
        const row = mittenSizingRow(size);
        const result = calculateMittenPattern({
          ...measurementsFromSizingRow(row!),
          stitchGaugePerInch: 7,
          rowGaugePerInch: 10,
          thumbStyle,
        });
        expect(result.ok, `${size} ${thumbStyle}`).toBe(true);
        if (!result.ok) continue;
        const pattern = buildMittenDiagramSvg(result.calc, "right");
        const summary = buildMittenDiagramSvg(result.calc, "right", "summary");
        expect(attr(summary, "hand-width-px") / attr(summary, "total-height-px")).toBeCloseTo(
          attr(pattern, "hand-width-px") / attr(pattern, "total-height-px"),
          2,
        );
        expect(attr(summary, "thumb-width-px") / attr(summary, "thumb-length-px")).toBeCloseTo(
          attr(pattern, "thumb-width-px") / attr(pattern, "thumb-length-px"),
          2,
        );
        expect(summary).not.toContain('data-separation="inner"');
        expect(summary).not.toContain("Fingertip");
        expect(summary).not.toContain("Starts at two-thirds");

        const handLeft = attr(summary, "hand-mid-x") - attr(summary, "hand-width-px") / 2;
        const handRight = handLeft + attr(summary, "hand-width-px");
        const yTip = attr(summary, "y-tip");
        const yBottom = attr(summary, "y-bottom");
        const thumbBase = attr(summary, "thumb-base-x");
        const targets = MITTEN_SUMMARY_TARGETS;
        const cuffCirc = circle(summary, targets.cuffCircumference);
        const cuffLen = circle(summary, targets.cuffLength);
        const handCirc = circle(summary, targets.handCircumference);
        const handLen = circle(summary, targets.handLength);
        const hand2 = circle(summary, targets.hand2Length);
        const thumbLen = circle(summary, targets.thumbLength);
        const thumbCirc = circle(summary, targets.thumbCircumference);

        expect(handCirc.y).toBeLessThan(yTip);
        expect(cuffCirc.y).toBeGreaterThan(yBottom);
        expect(cuffLen.x).toBeLessThan(handLeft);
        expect(handLen.x).toBeLessThan(handLeft);
        expect(hand2.x).toBeLessThan(handLeft);
        expect(thumbLen.x).toBeGreaterThan(thumbBase);
        expect(thumbCirc.x).toBeGreaterThan(thumbBase);

        const px = mittenSummaryMinPxPerUnit(Number(summary.match(/viewBox="0 0 ([^ ]+)/)?.[1]));
        const minSep =
          (MITTEN_SUMMARY_CHIP.chipHeightPx + MITTEN_SUMMARY_CHIP.chipGapPx) / px - 0.5;
        const leftYs = [hand2.y, handLen.y, cuffLen.y].sort((a, b) => a - b);
        const rightYs = [thumbLen.y, thumbCirc.y].sort((a, b) => a - b);
        expect(leftYs[1]! - leftYs[0]!).toBeGreaterThanOrEqual(minSep);
        expect(leftYs[2]! - leftYs[1]!).toBeGreaterThanOrEqual(minSep);
        expect(rightYs[1]! - rightYs[0]!).toBeGreaterThanOrEqual(minSep);

        const vb = summary.match(/viewBox="0 0 ([^ ]+) ([^"]+)"/);
        const vbW = Number(vb?.[1]);
        const vbH = Number(vb?.[2]);
        const chipW = MITTEN_SUMMARY_CHIP.chipWidthPx / px;
        const chipH = MITTEN_SUMMARY_CHIP.chipHeightPx / px;
        const boxes = [
          { x: cuffLen.x - 10 / px - chipW, y: cuffLen.y - chipH / 2 },
          { x: handLen.x - 10 / px - chipW, y: handLen.y - chipH / 2 },
          { x: hand2.x - 10 / px - chipW, y: hand2.y - chipH / 2 },
          { x: thumbLen.x + 10 / px, y: thumbLen.y - chipH / 2 },
          { x: thumbCirc.x + 10 / px, y: thumbCirc.y - chipH / 2 },
          { x: handCirc.x - chipW / 2, y: handCirc.y - 10 / px - chipH },
          { x: cuffCirc.x - chipW / 2, y: cuffCirc.y + 10 / px },
        ];
        for (const box of boxes) {
          expect(box.x).toBeGreaterThanOrEqual(-0.5);
          expect(box.y).toBeGreaterThanOrEqual(-0.5);
          expect(box.x + chipW).toBeLessThanOrEqual(vbW + 0.5);
          expect(box.y + chipH).toBeLessThanOrEqual(vbH + 0.5);
        }
      }
    }
  });
});
