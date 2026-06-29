import { describe, expect, it } from "vitest";
import {
  computeShallowBackNeckNeedleLayout,
  countCrossBedNeedleRange,
  countSameSideNeedleRange,
  formatCenterNeedleHoldPhrase,
  formatFirstSideHoldPhrase,
  formatNeedleRangeHtml,
  formatNeedleRangeThrough,
  formatStitchCountValidation,
  NEEDLE_RANGE_CLASS,
} from "./shallowBackNeckNeedleLayout";

describe("computeShallowBackNeckNeedleLayout", () => {
  it("maps even body width and even center hold (100 sts, hold 18)", () => {
    const layout = computeShallowBackNeckNeedleLayout(100, 18);
    expect(formatNeedleRangeThrough(layout.rightShoulder.start, layout.rightShoulder.end)).toBe(
      "R10 through R50",
    );
    expect(formatNeedleRangeThrough(layout.leftShoulder.start, layout.leftShoulder.end)).toBe(
      "L50 through L10",
    );
    expect(formatCenterNeedleHoldPhrase(layout)).toBe("L9 through R9");
    expect(formatFirstSideHoldPhrase(layout)).toBe("L50 through R9");
    expect(layout.stitchCounts).toEqual({
      leftShoulder: 41,
      rightShoulder: 41,
      center: 18,
      firstSideHold: 59,
    });
    expect(formatStitchCountValidation(layout.stitchCounts.firstSideHold)).toBe(
      " (59 stitches total)",
    );
  });

  it("wraps needle ranges in the needle-range CSS class", () => {
    const layout = computeShallowBackNeckNeedleLayout(100, 18);
    expect(formatNeedleRangeHtml("L50 through R9")).toBe(
      `<span class="${NEEDLE_RANGE_CLASS}">L50 through R9</span>`,
    );
    expect(countCrossBedNeedleRange("L50", "R9")).toBe(59);
    expect(countSameSideNeedleRange("L50", "L10")).toBe(41);
  });

  it("splits odd center hold across L and R needles only (never needle 0)", () => {
    const layout = computeShallowBackNeckNeedleLayout(100, 19);
    expect(formatCenterNeedleHoldPhrase(layout)).toBe("L9 through R10");
    expect(formatFirstSideHoldPhrase(layout)).toBe("L50 through R10");
    expect(formatNeedleRangeThrough(layout.rightShoulder.start, layout.rightShoulder.end)).toBe(
      "R11 through R50",
    );
    expect(layout.stitchCounts).toEqual({
      leftShoulder: 41,
      rightShoulder: 40,
      center: 19,
      firstSideHold: 60,
    });
    expect(formatCenterNeedleHoldPhrase(layout)).not.toMatch(/needle 0/i);
    expect(formatFirstSideHoldPhrase(layout)).not.toMatch(/needle 0/i);
  });

  it("places a single center hold stitch on R1 only", () => {
    const layout = computeShallowBackNeckNeedleLayout(100, 1);
    expect(formatCenterNeedleHoldPhrase(layout)).toBe("R1 through R1");
    expect(formatFirstSideHoldPhrase(layout)).toBe("L50 through R1");
    expect(formatNeedleRangeThrough(layout.rightShoulder.start, layout.rightShoulder.end)).toBe(
      "R2 through R50",
    );
    expect(layout.stitchCounts.center).toBe(1);
    expect(formatCenterNeedleHoldPhrase(layout)).not.toMatch(/needle 0/i);
  });

  it("matches user example proportions (130 sts, hold 22)", () => {
    const layout = computeShallowBackNeckNeedleLayout(130, 22);
    expect(formatFirstSideHoldPhrase(layout)).toBe("L65 through R11");
    expect(formatNeedleRangeThrough(layout.rightShoulder.start, layout.rightShoulder.end)).toBe(
      "R12 through R65",
    );
    expect(formatNeedleRangeThrough(layout.leftShoulder.start, layout.leftShoulder.end)).toBe(
      "L65 through L12",
    );
    expect(formatCenterNeedleHoldPhrase(layout)).toBe("L11 through R11");
  });

  it("never emits needle 0 in any range phrase", () => {
    for (const C of [1, 17, 18, 19, 22, 23]) {
      const layout = computeShallowBackNeckNeedleLayout(100, C);
      const phrases = [
        formatCenterNeedleHoldPhrase(layout),
        formatFirstSideHoldPhrase(layout),
        formatNeedleRangeThrough(layout.leftShoulder.start, layout.leftShoulder.end),
        formatNeedleRangeThrough(layout.rightShoulder.start, layout.rightShoulder.end),
      ];
      for (const phrase of phrases) {
        expect(phrase).not.toMatch(/needle 0/i);
        expect(phrase).not.toMatch(/\b0\b/);
      }
    }
  });
});
