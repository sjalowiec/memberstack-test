import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createEmptySockDraft } from "./sockDraft";
import {
  basicSockCalcInputFromDraft,
  calculateBasicSockPattern,
  calculateShortRowShaping,
  remainingStitchesAtOneThird,
  roundToEvenPreferUp,
  sockGaugeToPerInch,
  splitSockStitchesIntoHalves,
  type BasicSockCalcInput,
} from "./sockMath";
import { createSockSizingAdapter } from "./sockSizing";
import { basicSockCalcInvariantErrors } from "./sockValidation";

const chartPath = resolve(process.cwd(), "public/data/sizing_socks.json");
const adapter = createSockSizingAdapter(JSON.parse(readFileSync(chartPath, "utf8")));

const typicalMachine: BasicSockCalcInput = {
  footCircumferenceInches: 8.5,
  footLengthInches: 9,
  legCircumferenceInches: 8.5,
  legLengthInches: 4.5,
  stitchGaugeDisplay: 28,
  rowGaugeDisplay: 40,
  displayUnit: "inches",
  constructionDirection: "cuff-to-toe",
};

describe("KIN rounding and gauge normalization", () => {
  it("roundToEvenPreferUp matches the Hat even-up convention", () => {
    expect(roundToEvenPreferUp(5.2)).toBe(6);
    expect(roundToEvenPreferUp(4.2)).toBe(4);
    expect(roundToEvenPreferUp(59.4)).toBe(60);
    expect(roundToEvenPreferUp(61)).toBe(62);
  });

  it("converts 4-inch and 10 cm swatches the same way Hat does", () => {
    expect(sockGaugeToPerInch(28, "inches")).toBe(7);
    expect(sockGaugeToPerInch(40, "inches")).toBe(10);
    expect(sockGaugeToPerInch(28, "cm")).toBeCloseTo(28 / (10 / 2.54), 6);
  });
});

describe("circumference → stitch count", () => {
  it("uses finished foot circumference with no ease", () => {
    const result = calculateBasicSockPattern(typicalMachine);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.totalSockStitches).toBe(roundToEvenPreferUp(8.5 * 7));
    expect(result.calc.totalSockStitches).toBe(60);
    expect(result.calc.footStitches).toBe(60);
    expect(result.calc.ankleStitches).toBe(60);
  });

  it("even-ups an odd rounded stitch count", () => {
    const result = calculateBasicSockPattern({
      ...typicalMachine,
      footCircumferenceInches: 8.7,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.totalSockStitches % 2).toBe(0);
    expect(result.calc.totalSockStitches).toBe(roundToEvenPreferUp(8.7 * 7));
  });
});

describe("half split and 1/3 remaining", () => {
  it("splits an even tube into equal integer halves", () => {
    expect(splitSockStitchesIntoHalves(60)).toEqual({
      workingStitches: 30,
      heldStitches: 30,
    });
    expect(splitSockStitchesIntoHalves(62)).toEqual({
      workingStitches: 31,
      heldStitches: 31,
    });
  });

  it("keeps working + held equal to total when the total is defensively odd", () => {
    expect(splitSockStitchesIntoHalves(61)).toEqual({
      workingStitches: 31,
      heldStitches: 30,
    });
  });

  it("uses approximately one-third remaining with same-parity wraps", () => {
    expect(remainingStitchesAtOneThird(30)).toBe(10);
    expect(remainingStitchesAtOneThird(31)).toBe(11);
    expect(remainingStitchesAtOneThird(32)).toBe(10);
    expect(remainingStitchesAtOneThird(2)).toBeNull();
  });

  it("produces symmetrical one-stitch-at-a-time short-row counts", () => {
    const shaping = calculateShortRowShaping(60);
    expect(shaping).toEqual({
      workingStitches: 30,
      heldStitches: 30,
      remainingStitches: 10,
      wrapsEachSide: 10,
      shortRowInSteps: 20,
      shortRowOutSteps: 20,
      shortRowDepthRows: 20,
      shortRowKnittingRows: 40,
    });
    expect(shaping!.shortRowDepthRows).toBe(
      shaping!.workingStitches - shaping!.remainingStitches,
    );
    expect(shaping!.shortRowKnittingRows).toBe(
      shaping!.shortRowInSteps + shaping!.shortRowOutSteps,
    );
    expect(shaping!.shortRowKnittingRows).not.toBe(shaping!.shortRowDepthRows);
    expect(2 * shaping!.wrapsEachSide + shaping!.remainingStitches).toBe(30);
  });

  it("keeps odd working-half remaining the same parity so wraps stay symmetrical", () => {
    const shaping = calculateShortRowShaping(62);
    expect(shaping?.workingStitches).toBe(31);
    expect(shaping?.remainingStitches).toBe(11);
    expect(shaping?.wrapsEachSide).toBe(10);
    expect(shaping?.shortRowDepthRows).toBe(20);
    expect(shaping!.workingStitches % 2).toBe(1);
    expect(shaping!.remainingStitches % 2).toBe(1);
    expect(2 * shaping!.wrapsEachSide + shaping!.remainingStitches).toBe(31);
  });
});

describe("calculateBasicSockPattern", () => {
  it("uses identical heel and toe shaping and one-way physical depth", () => {
    const result = calculateBasicSockPattern(typicalMachine);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(basicSockCalcInvariantErrors(result.calc)).toEqual([]);
    expect(result.calc.heel).toEqual(result.calc.toe);
    expect(result.calc.heel.shortRowDepthRows).toBe(20);
    expect(result.calc.heel.shortRowKnittingRows).toBe(40);
    expect(result.calc.heelDepthInches).toBe(2);
    expect(result.calc.toeDepthInches).toBe(2);
    expect(result.calc.straightFootLengthInches).toBe(5);
    expect(result.calc.straightFootRows).toBe(50);
    expect(result.calc.unresolved).toEqual(["leg-shaping-schedule"]);
  });

  it("does not count return/increase short rows in finished heel or toe depth", () => {
    const result = calculateBasicSockPattern(typicalMachine);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.heelDepthInches).toBe(
      result.calc.heel.shortRowDepthRows / result.calc.rowGaugePerInch,
    );
    expect(result.calc.heelDepthInches).not.toBe(
      result.calc.heel.shortRowKnittingRows / result.calc.rowGaugePerInch,
    );
    expect(result.calc.straightFootLengthInches).toBe(
      result.calc.footLengthInches - result.calc.heelDepthInches - result.calc.toeDepthInches,
    );
  });

  it("does not invent a leg shaping schedule when circumferences differ", () => {
    const result = calculateBasicSockPattern({
      ...typicalMachine,
      legCircumferenceInches: 10,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.legStitches).toBe(roundToEvenPreferUp(10 * 7));
    expect(result.calc.legShapingNeeded).toBe(true);
    expect(result.calc.legStitchChange).toBe(result.calc.legStitches - 60);
    expect(result.calc.legShapingSchedule).toBeNull();
    expect(result.calc.legRows).toBe(roundToEvenPreferUp(4.5 * 10));
  });

  it("does not require leg shaping when leg and foot circumferences match", () => {
    const result = calculateBasicSockPattern(typicalMachine);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.legShapingNeeded).toBe(false);
    expect(result.calc.legStitchChange).toBe(0);
  });

  it("keeps cuff-to-toe and toe-up geometry identical", () => {
    const cuff = calculateBasicSockPattern(typicalMachine);
    const toeUp = calculateBasicSockPattern({
      ...typicalMachine,
      constructionDirection: "toe-up",
    });
    expect(cuff.ok && toeUp.ok).toBe(true);
    if (!cuff.ok || !toeUp.ok) return;
    const { constructionDirection: _c, ...cuffRest } = cuff.calc;
    const { constructionDirection: _t, ...toeRest } = toeUp.calc;
    expect(cuffRest).toEqual(toeRest);
    expect(_c).toBe("cuff-to-toe");
    expect(_t).toBe("toe-up");
  });

  it("normalizes a 10 cm swatch to the same stitches as the matching 4-inch swatch", () => {
    const inches = calculateBasicSockPattern(typicalMachine);
    const cmEquivalentSts = 7 * (10 / 2.54);
    const cmEquivalentRows = 10 * (10 / 2.54);
    const cm = calculateBasicSockPattern({
      ...typicalMachine,
      stitchGaugeDisplay: cmEquivalentSts,
      rowGaugeDisplay: cmEquivalentRows,
      displayUnit: "cm",
    });
    expect(inches.ok && cm.ok).toBe(true);
    if (!inches.ok || !cm.ok) return;
    expect(cm.calc.stGaugePerInch).toBeCloseTo(inches.calc.stGaugePerInch, 5);
    expect(cm.calc.totalSockStitches).toBe(inches.calc.totalSockStitches);
    expect(cm.calc.heelDepthInches).toBeCloseTo(inches.calc.heelDepthInches, 5);
    expect(cm.calc.toeDepthInches).toBeCloseTo(inches.calc.toeDepthInches, 5);
    expect(cm.calc.straightFootLengthInches).toBeCloseTo(
      inches.calc.straightFootLengthInches,
      5,
    );
    expect(cm.calc.straightFootRows).toBe(inches.calc.straightFootRows);
  });

  it("rejects missing, zero, and impossible inputs", () => {
    expect(calculateBasicSockPattern({ ...typicalMachine, footCircumferenceInches: 0 }).ok).toBe(
      false,
    );
    expect(calculateBasicSockPattern({ ...typicalMachine, stitchGaugeDisplay: -4 }).ok).toBe(
      false,
    );
    expect(
      calculateBasicSockPattern({
        ...typicalMachine,
        constructionDirection: "sideways" as BasicSockCalcInput["constructionDirection"],
      }).ok,
    ).toBe(false);
    const tiny = calculateBasicSockPattern({
      ...typicalMachine,
      footCircumferenceInches: 0.5,
      stitchGaugeDisplay: 4,
    });
    expect(tiny.ok).toBe(false);
  });

  it("rejects a foot length that cannot fit one-way heel plus toe depth", () => {
    const result = calculateBasicSockPattern({
      ...typicalMachine,
      footLengthInches: 3,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toMatch(/longer than the requested finished foot length/i);
    expect(result.errors.join(" ")).toMatch(/3/);
    expect(result.errors.join(" ")).not.toMatch(/clamp/i);
  });

  it("computes odd working-half depth without forcing a multiple of 4 total stitches", () => {
    const result = calculateBasicSockPattern({
      ...typicalMachine,
      footCircumferenceInches: 8.7,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.totalSockStitches).toBe(62);
    expect(result.calc.totalSockStitches % 4).toBe(2);
    expect(result.calc.heel.workingStitches).toBe(31);
    expect(result.calc.heel.remainingStitches).toBe(11);
    expect(result.calc.heel.shortRowDepthRows).toBe(20);
    expect(result.calc.heelDepthInches).toBe(2);
    expect(result.calc.toeDepthInches).toBe(2);
    expect(result.calc.straightFootLengthInches).toBe(5);
    expect(result.calc.straightFootRows).toBe(50);
  });

  it("never returns negative stitch counts on random plausible inputs", () => {
    for (let i = 0; i < 80; i += 1) {
      const footCirc = 4 + (i % 8);
      const stitchDisplay = 16 + (i % 20);
      const result = calculateBasicSockPattern({
        ...typicalMachine,
        footCircumferenceInches: footCirc,
        legCircumferenceInches: footCirc + (i % 3),
        stitchGaugeDisplay: stitchDisplay,
        rowGaugeDisplay: stitchDisplay + 8,
      });
      if (!result.ok) continue;
      expect(basicSockCalcInvariantErrors(result.calc)).toEqual([]);
      expect(result.calc.totalSockStitches).toBeGreaterThan(0);
      expect(result.calc.heel.wrapsEachSide).toBeGreaterThan(0);
      expect(result.calc.heel.remainingStitches).toBeGreaterThan(0);
      expect(result.calc.straightFootLengthInches).toBeGreaterThan(0);
      expect(result.calc.straightFootRows).toBeGreaterThan(0);
    }
  });
});

describe("draft → calc input", () => {
  it("prefills from the sock chart when draft measurement fields are empty", () => {
    const draft = createEmptySockDraft({
      sizeSel: "woman_med",
      constructionDirection: "cuff-to-toe",
      gaugeSlots: {
        inches: { stitch: "28", row: "40" },
        cm: { stitch: "", row: "" },
      },
    });
    const input = basicSockCalcInputFromDraft(draft, adapter);
    expect(input).toMatchObject({
      footCircumferenceInches: 8.5,
      footLengthInches: 9,
      legCircumferenceInches: 8.5,
      legLengthInches: 4.5,
      stitchGaugeDisplay: 28,
      displayUnit: "inches",
    });
    const result = calculateBasicSockPattern(input!);
    expect(result.ok).toBe(true);
  });

  it("lets filled measurement strings override the chart (Perfect Fit later)", () => {
    const draft = createEmptySockDraft({
      sizeSel: "woman_med",
      constructionDirection: "toe-up",
      footCircumference: "9",
      footLength: "9.5",
      legCircumference: "10",
      legLength: "6",
      gaugeSlots: {
        inches: { stitch: "20", row: "28" },
        cm: { stitch: "", row: "" },
      },
    });
    const input = basicSockCalcInputFromDraft(draft, adapter);
    expect(input).toMatchObject({
      footCircumferenceInches: 9,
      footLengthInches: 9.5,
      legCircumferenceInches: 10,
      legLengthInches: 6,
      stitchGaugeDisplay: 20,
    });
  });

  it("converts custom centimeter measurements to inches", () => {
    const draft = createEmptySockDraft({
      unit: "cm",
      sizeSel: "custom",
      constructionDirection: "cuff-to-toe",
      footCircumference: "21.59",
      footLength: "22.86",
      legCircumference: "21.59",
      legLength: "11.43",
      gaugeSlots: {
        inches: { stitch: "", row: "" },
        cm: { stitch: "28", row: "40" },
      },
    });
    const input = basicSockCalcInputFromDraft(draft, adapter);
    expect(input?.footCircumferenceInches).toBeCloseTo(8.5, 2);
    expect(input?.displayUnit).toBe("cm");
  });
});
