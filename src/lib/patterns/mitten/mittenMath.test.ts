import { describe, expect, it } from "vitest";
import {
  APPROVED_THUMB_LENGTH_INCHES,
  CHILD_THUMB_LENGTH_ASSIGNMENT,
  MITTEN_SIZING_CHART,
} from "./mittenSizingChart";
import {
  calculateMittenPattern,
  calculateThumbCounts,
  gaugePerInchFromPer4Inches,
  goredMarkerPlacement,
  measurementsFromSizingRow,
  mittenPhysicalLengths,
  planGoredThumb,
  roundHalfUp,
  rowsFromCuffToLowerGoredMarkers,
  womanSmallPreviewCalc,
  womanSmallPreviewInput,
} from "./mittenMath";

const THUMB_TABLE = [
  ["child_2_4", 8, 17],
  ["child_4_6", 9, 19],
  ["child_6_8", 9, 19],
  ["woman_sm", 10, 21],
  ["woman_lg", 12, 25],
  ["man_sm", 12, 25],
  ["man_med", 13, 27],
  ["man_lg", 13, 27],
] as const;

describe("slotted mitten math", () => {
  it("matches the Woman Small example at 7 stitches and 10 rows per inch", () => {
    const calc = womanSmallPreviewCalc();
    expect(calc.cuffSts).toBe(46);
    expect(calc.cuffRows).toBe(26);
    expect(calc.handSts).toBe(50);
    expect(calc.increaseSts).toBe(4);
    expect(calc.handLengthRows).toBe(60);
    expect(calc.hand2Rows).toBe(40);
    expect(calc.hand1Rows).toBe(20);
    expect(calc.fingertip.workingStitches).toBe(25);
    expect(calc.fingertip.heldStitches).toBe(25);
    expect(calc.fingertip.remainingStitches).toBe(9);
    expect(calc.fingertip.wrapsEachSide).toBe(8);
    expect(calc.fingertip.shortRowDepthRows).toBe(16);
    expect(calc.fingertip.shortRowKnittingRows).toBe(32);
    expect(calc.straightRows).toBe(24);
    expect(calc.handEndRc).toBe(44);
    expect(calc.slotSts).toBe(10);
    expect(calc.thumbSts).toBe(21);
    expect(calc.thumbRows).toBe(24);
    expect(calc.measurements.thumbLengthInches).toBe(2.4);
    expect(calc.thumbStyle).toBe("slotted");
    expect(calc.gore).toBeNull();
    expect(calc.thumbRows).toBe(Math.round(calc.measurements.thumbLengthInches * calc.rowGaugePerInch));
    expect(calc.targetKnittedThumbStitches).toBeCloseTo(21.25, 5);
    const lengths = mittenPhysicalLengths(calc);
    expect(lengths.setupRowIn).toBeCloseTo(1 / 10, 5);
    expect(lengths.cuffLengthIn).toBeCloseTo(2.6, 5);
    expect(lengths.hand1LengthIn).toBeCloseTo(2, 5);
    expect(lengths.fingertipDepthIn).toBeCloseTo(1.6, 5);
    expect(lengths.hand2LengthIn).toBeCloseTo(4.1, 5);
    expect(lengths.totalLengthIn).toBeCloseTo(8.7, 5);
    expect(calc.measurements.hand2LengthInches).toBe(4);
    expect(calc.measurements.handLengthInches).toBe(6);
  });

  it("sizes the setup row from the entered row gauge", () => {
    const atEight = calculateMittenPattern({
      ...womanSmallPreviewInput(),
      rowGaugePerInch: 8,
    });
    expect(atEight.ok).toBe(true);
    if (!atEight.ok) return;
    const lengths = mittenPhysicalLengths(atEight.calc);
    expect(lengths.setupRowIn).toBeCloseTo(1 / 8, 5);
    expect(lengths.hand2LengthIn).toBeCloseTo(
      lengths.straightLengthIn + lengths.setupRowIn + lengths.fingertipDepthIn,
      5,
    );
    expect(atEight.calc.straightRows).toBe(atEight.calc.hand2Rows - atEight.calc.fingertip.shortRowDepthRows);
    expect(atEight.calc.thumbSts).toBe(21);
    expect(atEight.calc.measurements.hand2LengthInches).toBe(4);
  });

  it("treats 28 stitches and 40 rows per 4 inches as the same Woman Small gauge", () => {
    const perInch = womanSmallPreviewInput();
    const fromSwatch = calculateMittenPattern({
      ...perInch,
      stitchGaugePerInch: gaugePerInchFromPer4Inches(28),
      rowGaugePerInch: gaugePerInchFromPer4Inches(40),
    });
    expect(fromSwatch.ok).toBe(true);
    if (!fromSwatch.ok) return;
    expect(fromSwatch.calc.cuffSts).toBe(46);
    expect(fromSwatch.calc.straightRows).toBe(24);
    expect(fromSwatch.calc.thumbSts).toBe(21);
  });

  it("uses the stitch-count slot formula for every chart size at 7 stitches per inch", () => {
    for (const [size, slotSts, thumbSts] of THUMB_TABLE) {
      const row = MITTEN_SIZING_CHART.find((entry) => entry.size === size);
      expect(row, size).toBeTruthy();
      const thumb = calculateThumbCounts({
        thumbCircumferenceInches: row!.thumbCircumferenceInches,
        thumbLengthInches: row!.thumbLengthInches,
        stitchGaugePerInch: 7,
        rowGaugePerInch: 10,
      });
      expect(thumb?.slotSts, size).toBe(slotSts);
      expect(thumb?.thumbSts, size).toBe(thumbSts);
      expect(thumb?.thumbRows, size).toBe(roundHalfUp(row!.thumbLengthInches * 10));
      expect(row!.thumbLengthInches, size).not.toBe(row!.thumbCircumferenceInches);
      expect(row!.thumbLengthInches, size).not.toBe(row!.thumbOpeningInches);
    }
  });

  it("leaves the old thumb opening out of the stitch count", () => {
    const row = MITTEN_SIZING_CHART.find((entry) => entry.size === "woman_sm")!;
    expect(row.thumbOpeningInches).toBe(1.75);
    expect(row.thumbCircumferenceInches).toBe(2.75);
    const fromOpening = calculateThumbCounts({
      thumbCircumferenceInches: row.thumbOpeningInches,
      thumbLengthInches: row.thumbLengthInches,
      stitchGaugePerInch: 7,
      rowGaugePerInch: 10,
    });
    expect(fromOpening?.thumbSts).not.toBe(21);
  });

  it("uses the approved adult thumb lengths and leaves the unmatched children's labels unchanged", () => {
    const bySize = Object.fromEntries(MITTEN_SIZING_CHART.map((row) => [row.size, row]));
    expect(bySize.woman_sm?.thumbLengthInches).toBe(APPROVED_THUMB_LENGTH_INCHES.women);
    expect(bySize.woman_lg?.thumbLengthInches).toBe(APPROVED_THUMB_LENGTH_INCHES.women);
    expect(bySize.man_sm?.thumbLengthInches).toBe(APPROVED_THUMB_LENGTH_INCHES.men);
    expect(bySize.man_med?.thumbLengthInches).toBe(APPROVED_THUMB_LENGTH_INCHES.men);
    expect(bySize.man_lg?.thumbLengthInches).toBe(APPROVED_THUMB_LENGTH_INCHES.men);
    expect(bySize.child_2_4?.label).toBe("Child 2–4");
    expect(bySize.child_4_6?.label).toBe("Child 4–6");
    expect(bySize.child_6_8?.label).toBe("Child 6–8");
    expect(bySize.child_2_4?.thumbLengthInches).toBe(1.8);
    expect(bySize.child_4_6?.thumbLengthInches).toBe(1.8);
    expect(bySize.child_6_8?.thumbLengthInches).toBe(2);
    expect(CHILD_THUMB_LENGTH_ASSIGNMENT).toContain("Child 6–8 uses 2.0 inches");
    expect(CHILD_THUMB_LENGTH_ASSIGNMENT).toContain("2.2 inches is not assigned");
    expect(bySize.child_2_4?.handLengthInches).toBe(4);
    expect(bySize.woman_sm?.handCircumferenceInches).toBe(7);
  });
});

describe("gored thumb math", () => {
  it("uses circumference times stitch gauge plus 2 seam stitches once", () => {
    const gore = planGoredThumb({
      thumbCircumferenceInches: 2,
      thumbLengthInches: 2,
      stitchGaugePerInch: 7,
      rowGaugePerInch: 10,
    });
    expect(gore?.pickupNeedles).toBe(16);
    expect(gore?.targetKnittedThumbStitches).toBe(16);
    expect(gore?.firstEdgeStitches).toBe(8);
    expect(gore?.otherEdgeStitches).toBe(8);
    expect(gore?.firstEdgeStitches! + gore?.otherEdgeStitches!).toBe(16);
    expect(gore?.markerRows).toBe(10);
    expect(gore?.startWorkingNeedles).toBe(4);
    expect(gore?.heldEachSide).toBe(6);
    expect(gore?.thumbRows).toBe(20);
    const slotted = calculateThumbCounts({
      thumbCircumferenceInches: 2,
      thumbLengthInches: 2,
      stitchGaugePerInch: 7,
      rowGaugePerInch: 10,
      thumbStyle: "slotted",
    });
    expect(slotted?.thumbSts).not.toBe(16);
    expect(gore?.returns).toEqual([
      { needles: 2, wrap: true },
      { needles: 2, wrap: true },
      { needles: 2, wrap: true },
      { needles: 2, wrap: true },
      { needles: 2, wrap: false },
      { needles: 2, wrap: false },
    ]);
  });

  it("does not subtract the gore short rows from the thumb-length rows", () => {
    const result = calculateMittenPattern({
      ...womanSmallPreviewInput(),
      thumbCircumferenceInches: 2,
      thumbLengthInches: 2,
      thumbStyle: "gored",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.thumbRows).toBe(20);
    expect(result.calc.gore?.returns).toHaveLength(6);
    expect(result.calc.thumbRows).toBeGreaterThan(result.calc.gore?.returns.length ?? 0);
    expect(result.calc.slotSts).toBe(0);
  });

  it("places the lower markers at 15% of the thumb circumference and keeps the mitten length", () => {
    const gauges = [6, 8, 10, 12];
    const sizes = ["child_2_4", "child_6_8", "woman_sm", "woman_lg", "man_sm", "man_lg"] as const;
    for (const size of sizes) {
      const row = MITTEN_SIZING_CHART.find((entry) => entry.size === size);
      expect(row, size).toBeTruthy();
      for (const rowGaugePerInch of gauges) {
        const slotted = calculateMittenPattern({
          ...measurementsFromSizingRow(row!),
          stitchGaugePerInch: 7,
          rowGaugePerInch,
        });
        const gored = calculateMittenPattern({
          ...measurementsFromSizingRow(row!),
          stitchGaugePerInch: 7,
          rowGaugePerInch,
          thumbStyle: "gored",
        });
        expect(slotted.ok, `${size} ${rowGaugePerInch}`).toBe(true);
        expect(gored.ok, `${size} ${rowGaugePerInch}`).toBe(true);
        if (!slotted.ok || !gored.ok) continue;
        const place = goredMarkerPlacement(gored.calc);
        expect(place, `${size} ${rowGaugePerInch}`).toBeTruthy();
        if (!place) continue;
        const rowsFromCuff = rowsFromCuffToLowerGoredMarkers(row!.thumbCircumferenceInches, rowGaugePerInch);
        expect(place.rowsFromCuff).toBe(rowsFromCuff);
        expect(place.lowerAt).toBe(rowsFromCuff);
        expect(place.markerRows).toBe(gored.calc.gore?.markerRows);
        expect(place.upperAt).toBe(place.lowerAt + place.markerRows);
        expect(place.lowerAt + place.markerRows + place.straightRowsAfterUpper).toBe(gored.calc.handEndRc);
        expect(gored.calc.handEndRc).toBe(slotted.calc.handEndRc);
        expect(gored.calc.hand1Rows).toBe(slotted.calc.hand1Rows);
        expect(gored.calc.straightRows).toBe(slotted.calc.straightRows);
        expect(gored.calc.fingertip).toEqual(slotted.calc.fingertip);
        expect(gored.calc.thumbRows).toBe(slotted.calc.thumbRows);
        expect(gored.calc.thumbSts).toBe(gored.calc.gore?.pickupNeedles);
        expect(slotted.calc.gore).toBeNull();
        expect(mittenPhysicalLengths(gored.calc).totalLengthIn).toBeCloseTo(
          mittenPhysicalLengths(slotted.calc).totalLengthIn,
          5,
        );
      }
    }
  });

  it("uses 15% of a custom thumb circumference for every gauge", () => {
    const result = calculateMittenPattern({
      ...womanSmallPreviewInput(),
      thumbCircumferenceInches: 3.1,
      rowGaugePerInch: 9,
      thumbStyle: "gored",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const place = goredMarkerPlacement(result.calc);
    expect(place?.rowsFromCuff).toBe(roundHalfUp(3.1 * 0.15 * 9));
    expect(place?.markerRows).toBe(roundHalfUp((3.1 / 2) * 9));
    expect(place?.upperAt).toBe((place?.lowerAt ?? 0) + (place?.markerRows ?? 0));
    expect((place?.lowerAt ?? 0) + (place?.markerRows ?? 0) + (place?.straightRowsAfterUpper ?? 0)).toBe(
      result.calc.handEndRc,
    );
  });

  it("uses a smaller final group and does not wrap after the last held needle", () => {
    const gore = planGoredThumb({
      thumbCircumferenceInches: 12 / 7,
      thumbLengthInches: 2,
      stitchGaugePerInch: 7,
      rowGaugePerInch: 10,
    });
    expect(gore?.pickupNeedles).toBe(14);
    expect(gore?.startWorkingNeedles).toBe(4);
    expect(gore?.heldEachSide).toBe(5);
    expect(gore?.returns.filter((pass) => pass.needles === 1)).toEqual([
      { needles: 1, wrap: false },
      { needles: 1, wrap: false },
    ]);
    expect(gore?.returns.at(-1)?.wrap).toBe(false);
  });
});
