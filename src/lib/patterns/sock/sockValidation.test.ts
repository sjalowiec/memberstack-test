import { describe, expect, it } from "vitest";
import { evaluateGaugeSanity } from "../legoBlocks/gaugeSanity";
import { createEmptySockDraft } from "./sockDraft";
import { calculateBasicSockPattern, type BasicSockCalcInput } from "./sockMath";
import {
  basicSockCalcInvariantErrors,
  evaluateSockGaugeSanity,
  evaluateSockGaugeSanityGate,
  sockDraftGaugeRaw,
} from "./sockValidation";

const valid: BasicSockCalcInput = {
  footCircumferenceInches: 8.5,
  footLengthInches: 9,
  legCircumferenceInches: 8.5,
  legLengthInches: 4.5,
  stitchGaugeDisplay: 28,
  rowGaugeDisplay: 40,
  displayUnit: "inches",
  constructionDirection: "cuff-to-toe",
};

describe("sock gauge sanity", () => {
  it("reuses the shared Lego evaluator, including the 4 sts / 7 rows case", () => {
    expect(evaluateSockGaugeSanity("4", "7", "in")).toEqual(
      evaluateGaugeSanity("4", "7", "in"),
    );
    const result = evaluateSockGaugeSanity("4", "7", "inches");
    expect(result?.unusual).toBe(true);
    expect(result?.reasons).toEqual(expect.arrayContaining(["low-stitch", "low-row"]));
    expect(evaluateSockGaugeSanityGate("4", "7", "in").proceed).toBe(false);
    expect(
      evaluateSockGaugeSanityGate("4", "7", "in", "4|7|in").proceed,
    ).toBe(true);
    expect(evaluateSockGaugeSanityGate("28", "40", "in").proceed).toBe(true);
  });

  it("reads the active unit slot from the sock draft", () => {
    const draft = createEmptySockDraft({
      unit: "inches",
      gaugeSlots: {
        inches: { stitch: "4", row: "7" },
        cm: { stitch: "20", row: "28" },
      },
    });
    expect(sockDraftGaugeRaw(draft)).toEqual({ stitch: "4", row: "7", unit: "inches" });
    expect(evaluateSockGaugeSanityGate("4", "7", "inches").reason).toBe("unusual-gauge");
  });
});

describe("basic sock calc invariants", () => {
  it("accepts a typical machine-knitting sock", () => {
    const result = calculateBasicSockPattern(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(basicSockCalcInvariantErrors(result.calc)).toEqual([]);
  });

  it("flags a calc whose heel and toe were forced apart", () => {
    const result = calculateBasicSockPattern(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const broken = {
      ...result.calc,
      toe: { ...result.calc.toe, remainingStitches: result.calc.toe.remainingStitches + 2 },
    };
    expect(basicSockCalcInvariantErrors(broken).join(" ")).toMatch(/heel and toe|symmetrical/);
  });
});
