import { describe, expect, it } from "vitest";
import { formatShapingSegment } from "../shapingNotationCompress";
import { goredThumbReturns } from "./mittenMath";
import {
  buildMittenShapingNotation,
  mittenFingertipShortRowNotation,
  mittenGoreShortRowNotation,
  mittenHandIncreaseNotation,
} from "./mittenShapingNotation";
import { buildMittenShapingNotationSvg } from "./mittenShapingNotationDiagramSvg";
import { calculateMittenPattern, womanSmallPreviewCalc, womanSmallPreviewInput } from "./mittenMath";

describe("mitten shaping notation", () => {
  const calc = womanSmallPreviewCalc();

  it("uses the shared notation tokens from the approved calc", () => {
    const notation = buildMittenShapingNotation(calc);
    expect(notation.castOn).toBe("co46");
    expect(notation.cuffRows).toBe("26r");
    expect(notation.handIncrease).toBe(`+${formatShapingSegment(calc.increaseSts, 1, 1)}`);
    expect(notation.hand1Rows).toBe("20r");
    expect(notation.straightRows).toBe("24r");
    expect(notation.fingertip).toEqual(mittenFingertipShortRowNotation(calc.fingertip));
    expect(notation.thumbRows).toBe("24r");
    expect(notation.goreShortRows).toEqual([]);
    expect(mittenHandIncreaseNotation(0)).toBe("");
  });

  it("groups gored returns without a new thumb formula", () => {
    expect(mittenGoreShortRowNotation(goredThumbReturns(6))).toEqual([
      `+${formatShapingSegment(2, 1, 6)}`,
    ]);
    expect(mittenGoreShortRowNotation(goredThumbReturns(5))).toEqual([
      `+${formatShapingSegment(2, 1, 4)}`,
      `+${formatShapingSegment(1, 1, 2)}`,
    ]);
  });

  it("draws both edges and both thumb constructions", () => {
    for (const edge of ["right", "left"] as const) {
      const svg = buildMittenShapingNotationSvg(calc, edge);
      expect(svg).toContain('aria-label="Mitten shaping notation"');
      expect(svg).toContain(`data-slot-edge="${edge}"`);
      expect(svg).toContain("+4s-1r-1x");
      expect(svg).toContain("-1s-1r-16x");
      expect(svg).toContain("Into hold:");
      expect(svg).toContain("Return to work:");
      expect(svg.indexOf("Into hold:")).toBeLessThan(svg.indexOf("-1s-1r-16x"));
      expect(svg.indexOf("-1s-1r-16x")).toBeLessThan(svg.indexOf(">9 sts<"));
      expect(svg.indexOf(">9 sts<")).toBeLessThan(svg.indexOf("Return to work:"));
      expect(svg.indexOf("Return to work:")).toBeLessThan(svg.indexOf("+1s-1r-16x"));
      expect(svg).toContain(`data-thumb-marker="slot-${edge}"`);
      expect(svg).toContain('r="8" fill="#c62828"');
      expect(svg).not.toContain("data-armhole-marker-tick");
      expect(svg).toMatch(/data-rc-label="fingertip-stop"[^>]*data-row-counter="24"/);
      expect(svg).not.toContain("Thumb marker");
      expect(svg).not.toContain("Place marker");
      expect(svg).not.toContain("decrease");
      const thumbX = Number(svg.match(/data-thumb-base-x="([^"]+)"/)?.[1]);
      const handMid = Number(svg.match(/data-hand-mid-x="([^"]+)"/)?.[1]);
      if (edge === "right") expect(thumbX).toBeGreaterThan(handMid);
      else expect(thumbX).toBeLessThan(handMid);
      const viewW = Number(svg.match(/viewBox="[^"]*\s([\d.]+)\s[\d.]+"/)?.[1]);
      expect(viewW).toBeGreaterThan(200);
      expect(viewW).toBeLessThan(720);
    }

    const gored = calculateMittenPattern({
      ...womanSmallPreviewInput(),
      thumbCircumferenceInches: 2,
      thumbLengthInches: 2,
      thumbStyle: "gored",
    });
    if (!gored.ok) throw new Error(gored.message);
    const svg = buildMittenShapingNotationSvg(gored.calc, "right");
    expect(svg).toContain("+2s-1r-6x");
    expect(svg).toContain("Into hold:");
    expect(svg).toContain("Return to work:");
    expect(svg).not.toContain("Return to work: +2s-1r-6x");
    expect(svg).toContain('data-thumb-marker="lower-left"');
    expect(svg).toContain('data-thumb-marker="upper-left"');
    expect(svg).toContain('data-thumb-marker="lower-right"');
    expect(svg).toContain('data-thumb-marker="upper-right"');
    expect(svg).not.toContain('data-thumb-marker="slot');
    expect(svg).toContain("10r");
    expect(svg).not.toContain("bo");
  });
});
