import { describe, expect, it } from "vitest";
import { mittenSizingRow } from "./mittenSizingChart";
import {
  buildMittenDiagramSvg,
  formatMittenDiagramInches,
  formatMittenDiagramLength,
  mittenDiagramMeasurements,
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
  });
});
