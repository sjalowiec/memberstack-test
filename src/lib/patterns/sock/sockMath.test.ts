import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { magicFormulaIntervals } from "../../shaping/autoShaping";
import { createEmptySockDraft } from "./sockDraft";
import {
  basicSockCalcInputFromDraft,
  calculateBasicSockPattern,
  calculateShortRowShaping,
  deriveSockAnkleStraightLengthInches,
  remainingStitchesAtOneThird,
  roundToEvenPreferUp,
  sockGaugeToPerInch,
  SOCK_ANKLE_SECTION_MAX_INCHES,
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
    expect(result.calc.unresolved).toEqual([]);
    expect(result.calc.legShapingSchedule.direction).toBe("none");
    expect(result.calc.legShapingSchedule.pairedEventCount).toBe(0);
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

  it("does not require leg shaping when leg and foot circumferences match", () => {
    const result = calculateBasicSockPattern(typicalMachine);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.legShapingNeeded).toBe(false);
    expect(result.calc.legStitchChange).toBe(0);
    expect(result.calc.legShapingSchedule.direction).toBe("none");
    expect(result.calc.legShapingSchedule.pairedEventCount).toBe(0);
    expect(result.calc.legShapingSchedule.steps).toEqual([]);
    expect(result.calc.legShapingSchedule.knitOrder.events).toEqual([]);
    expect(result.calc.ankleStraightLengthInches).toBe(0.85);
    expect(result.calc.ankleStraightRows).toBe(10);
    expect(result.calc.legShapingRowsAvailable).toBe(36);
    expect(result.calc.ankleStraightRows + result.calc.legShapingRowsAvailable).toBe(
      result.calc.legRows,
    );
    expect(result.calc.legShapingSchedule.knitOrder.sections.map((section) => section.kind)).toEqual(
      ["straight-leg", "straight-ankle"],
    );
  });

  it("keeps cuff-to-toe and toe-up finished geometry identical", () => {
    const cuff = calculateBasicSockPattern(typicalMachine);
    const toeUp = calculateBasicSockPattern({
      ...typicalMachine,
      constructionDirection: "toe-up",
    });
    expect(cuff.ok && toeUp.ok).toBe(true);
    if (!cuff.ok || !toeUp.ok) return;
    const { constructionDirection: _c, legShapingSchedule: cuffSchedule, ...cuffRest } = cuff.calc;
    const { constructionDirection: _t, legShapingSchedule: toeSchedule, ...toeRest } = toeUp.calc;
    const { knitOrder: cuffKnit, ...cuffGeometry } = cuffSchedule;
    const { knitOrder: toeKnit, ...toeGeometry } = toeSchedule;
    expect(cuffRest).toEqual(toeRest);
    expect(cuffGeometry).toEqual(toeGeometry);
    expect(_c).toBe("cuff-to-toe");
    expect(_t).toBe("toe-up");
    expect(cuffKnit.constructionDirection).toBe("cuff-to-toe");
    expect(toeKnit.constructionDirection).toBe("toe-up");
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

describe("leg shaping Magic Formula", () => {
  const mathSource = readFileSync(resolve("src/lib/patterns/sock/sockMath.ts"), "utf8");

  it("reuses the Magic Formula paired wrapper and does not call auto-shaping", () => {
    expect(mathSource).toContain("computeMagicFormulaPairedShaping");
    expect(mathSource).not.toContain("computeAutoShaping");
  });
  const widerLeg = {
    ...typicalMachine,
    legCircumferenceInches: 10,
  };
  const narrowerLeg = {
    ...typicalMachine,
    legCircumferenceInches: 7,
  };

  it("schedules paired increases for a wider top of leg and lands on the even stitch target", () => {
    const result = calculateBasicSockPattern(widerLeg);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(basicSockCalcInvariantErrors(result.calc)).toEqual([]);

    const schedule = result.calc.legShapingSchedule;
    const remainingRows = result.calc.legShapingRowsAvailable;
    const expected = magicFormulaIntervals(remainingRows, 5);
    expect(result.calc.ankleStitches).toBe(60);
    expect(result.calc.legStitches).toBe(70);
    expect(result.calc.legStitches % 2).toBe(0);
    expect(result.calc.legStitchChange).toBe(10);
    expect(result.calc.ankleStraightLengthInches).toBe(0.85);
    expect(result.calc.ankleStraightRows).toBe(10);
    expect(result.calc.legRows).toBe(46);
    expect(remainingRows).toBe(36);
    expect(result.calc.ankleStraightRows + remainingRows).toBe(result.calc.legRows);
    expect(schedule.direction).toBe("increase");
    expect(schedule.method).toBe("magic");
    expect(schedule.shapingMode).toBe("both");
    expect(schedule.startStitches).toBe(60);
    expect(schedule.targetStitches).toBe(70);
    expect(schedule.totalStitchChange).toBe(10);
    expect(schedule.pairedEventCount).toBe(5);
    expect(schedule.rowsAvailable).toBe(remainingRows);
    expect(schedule.rowsAvailable).not.toBe(result.calc.legRows);
    expect(schedule.steps).toEqual(expected.steps);
    expect(
      schedule.intervals.shortCount * schedule.intervals.shortInterval +
        schedule.intervals.longCount * schedule.intervals.longInterval,
    ).toBe(schedule.rowsAvailable);
    expect(schedule.knitOrder.events).toHaveLength(5);
    expect(schedule.knitOrder.events.every((event) => event.stitchChange === -2)).toBe(true);
    expect(schedule.knitOrder.events.at(-1)).toMatchObject({
      rowNumber: schedule.rowsAvailable,
      stitchesAfter: 60,
    });
  });

  it("schedules paired decreases for a narrower top of leg", () => {
    const result = calculateBasicSockPattern(narrowerLeg);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(basicSockCalcInvariantErrors(result.calc)).toEqual([]);

    const schedule = result.calc.legShapingSchedule;
    expect(result.calc.ankleStitches).toBe(60);
    expect(result.calc.legStitches).toBe(50);
    expect(result.calc.legStitchChange).toBe(-10);
    expect(schedule.direction).toBe("decrease");
    expect(schedule.pairedEventCount).toBe(5);
    expect(schedule.method).toBe("magic");
    expect(schedule.knitOrder.direction).toBe("increase");
    expect(schedule.knitOrder.startStitches).toBe(50);
    expect(schedule.knitOrder.targetStitches).toBe(60);
    expect(schedule.knitOrder.events.at(-1)?.stitchesAfter).toBe(60);
  });

  it("uses the same Magic Formula intervals for cuff-to-toe and toe-up with reversed knitting order", () => {
    const cuff = calculateBasicSockPattern(widerLeg);
    const toeUp = calculateBasicSockPattern({
      ...widerLeg,
      constructionDirection: "toe-up",
    });
    expect(cuff.ok && toeUp.ok).toBe(true);
    if (!cuff.ok || !toeUp.ok) return;

    const cuffSchedule = cuff.calc.legShapingSchedule;
    const toeSchedule = toeUp.calc.legShapingSchedule;
    expect(cuff.calc.ankleStitches).toBe(toeUp.calc.ankleStitches);
    expect(cuff.calc.legStitches).toBe(toeUp.calc.legStitches);
    expect(cuff.calc.legRows).toBe(toeUp.calc.legRows);
    expect(cuffSchedule.direction).toBe("increase");
    expect(toeSchedule.direction).toBe("increase");
    expect(cuffSchedule.steps).toEqual(toeSchedule.steps);
    expect(cuffSchedule.intervals).toEqual(toeSchedule.intervals);
    expect(cuffSchedule.pairedEventCount).toBe(toeSchedule.pairedEventCount);

    expect(cuffSchedule.knitOrder.constructionDirection).toBe("cuff-to-toe");
    expect(cuffSchedule.knitOrder.startStitches).toBe(70);
    expect(cuffSchedule.knitOrder.targetStitches).toBe(60);
    expect(cuffSchedule.knitOrder.direction).toBe("decrease");

    expect(toeSchedule.knitOrder.constructionDirection).toBe("toe-up");
    expect(toeSchedule.knitOrder.startStitches).toBe(60);
    expect(toeSchedule.knitOrder.targetStitches).toBe(70);
    expect(toeSchedule.knitOrder.direction).toBe("increase");

    expect(cuffSchedule.knitOrder.startStitches).toBe(toeSchedule.knitOrder.targetStitches);
    expect(cuffSchedule.knitOrder.targetStitches).toBe(toeSchedule.knitOrder.startStitches);
    expect(cuffSchedule.knitOrder.events.map((event) => event.rowNumber)).toEqual(
      toeSchedule.knitOrder.events.map((event) => event.rowNumber),
    );
    expect(cuff.calc.ankleStraightRows).toBe(toeUp.calc.ankleStraightRows);
    expect(cuff.calc.legShapingRowsAvailable).toBe(toeUp.calc.legShapingRowsAvailable);
    expect(cuffSchedule.knitOrder.sections.map((section) => section.kind)).toEqual([
      "leg-shaping",
      "straight-ankle",
    ]);
    expect(toeSchedule.knitOrder.sections.map((section) => section.kind)).toEqual([
      "straight-ankle",
      "leg-shaping",
    ]);
  });

  it("returns a calculation error when Magic Formula cannot fit the paired events in the remaining rows", () => {
    const result = calculateBasicSockPattern({
      ...typicalMachine,
      legCircumferenceInches: 20,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toMatch(/paired shaping events/i);
    expect(result.errors.join(" ")).not.toMatch(/clamp/i);
  });

  it("returns a calculation error when the finished leg cannot hold the ankle and required shaping", () => {
    const result = calculateBasicSockPattern({
      ...typicalMachine,
      legCircumferenceInches: 20,
      legLengthInches: 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toMatch(/straight ankle/i);
    expect(result.errors.join(" ")).not.toMatch(/clamp/i);
  });
});

describe("derived straight ankle section", () => {
  const representativeRowGaugePerInch = 10;

  function expectedAnkle(footCircumferenceInches: number) {
    const inches = deriveSockAnkleStraightLengthInches(footCircumferenceInches);
    return {
      inches,
      rows: roundToEvenPreferUp(inches * representativeRowGaugePerInch),
    };
  }

  it("derives a short Baby ankle, adult 0.75–1 inch range, and caps large custom sizes", () => {
    expect(deriveSockAnkleStraightLengthInches(4)).toBe(0.4);
    expect(deriveSockAnkleStraightLengthInches(6.5)).toBe(0.65);
    expect(deriveSockAnkleStraightLengthInches(8.5)).toBe(0.85);
    expect(deriveSockAnkleStraightLengthInches(10)).toBe(1);
    expect(deriveSockAnkleStraightLengthInches(16)).toBe(SOCK_ANKLE_SECTION_MAX_INCHES);
    expect(deriveSockAnkleStraightLengthInches(2)).toBe(0.2);
  });

  it("matches every Socks chart size at 28×40 over 4 inches", () => {
    const chartExpected: Record<string, { circ: number; inches: number; rows: number }> = {
      baby: { circ: 4, inches: 0.4, rows: 4 },
      child: { circ: 6.5, inches: 0.65, rows: 8 },
      woman_sm: { circ: 8, inches: 0.8, rows: 8 },
      woman_med: { circ: 8.5, inches: 0.85, rows: 10 },
      woman_lg: { circ: 9, inches: 0.9, rows: 10 },
      man_sm: { circ: 9, inches: 0.9, rows: 10 },
      man_med: { circ: 9.5, inches: 0.95, rows: 10 },
      man_lg: { circ: 10, inches: 1, rows: 10 },
    };
    expect(adapter.measurements.map((row) => row.size)).toEqual(Object.keys(chartExpected));
    for (const row of adapter.measurements) {
      const expected = chartExpected[row.size];
      expect(row.footCircumferenceInches).toBe(expected.circ);
      expect(expectedAnkle(row.footCircumferenceInches)).toEqual({
        inches: expected.inches,
        rows: expected.rows,
      });
      const result = calculateBasicSockPattern({
        footCircumferenceInches: row.footCircumferenceInches,
        footLengthInches: row.footLengthInches,
        legCircumferenceInches: row.defaultLegCircumferenceInches,
        legLengthInches: row.legLengthInches,
        stitchGaugeDisplay: 28,
        rowGaugeDisplay: 40,
        displayUnit: "inches",
        constructionDirection: "cuff-to-toe",
      });
      expect(result.ok, row.size).toBe(true);
      if (!result.ok) continue;
      expect(basicSockCalcInvariantErrors(result.calc)).toEqual([]);
      expect(result.calc.ankleStraightLengthInches).toBe(expected.inches);
      expect(result.calc.ankleStraightRows).toBe(expected.rows);
      expect(result.calc.legShapingRowsAvailable).toBe(
        result.calc.legRows - result.calc.ankleStraightRows,
      );
    }
  });

  it("keeps a custom very small circumference short and caps a custom large circumference", () => {
    const tiny = calculateBasicSockPattern({
      ...typicalMachine,
      footCircumferenceInches: 2,
      footLengthInches: 3.5,
      legCircumferenceInches: 2,
      legLengthInches: 2.5,
    });
    expect(tiny.ok).toBe(true);
    if (!tiny.ok) return;
    expect(tiny.calc.ankleStraightLengthInches).toBe(0.2);
    expect(tiny.calc.ankleStraightRows).toBe(2);
    expect(tiny.calc.legShapingRowsAvailable).toBe(tiny.calc.legRows - 2);

    const huge = calculateBasicSockPattern({
      ...typicalMachine,
      footCircumferenceInches: 16,
      footLengthInches: 12,
      legCircumferenceInches: 16,
      legLengthInches: 6,
    });
    expect(huge.ok).toBe(true);
    if (!huge.ok) return;
    expect(huge.calc.ankleStraightLengthInches).toBe(1);
    expect(huge.calc.ankleStraightRows).toBe(10);
    expect(huge.calc.ankleStraightLengthInches).toBe(
      deriveSockAnkleStraightLengthInches(10),
    );
  });

  it("falls back to knitting the whole short leg as the ankle when no shaping is required", () => {
    const result = calculateBasicSockPattern({
      ...typicalMachine,
      legLengthInches: 0.5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.legShapingNeeded).toBe(false);
    expect(result.calc.ankleStraightRows).toBe(result.calc.legRows);
    expect(result.calc.legShapingRowsAvailable).toBe(0);
    expect(result.calc.legShapingSchedule.knitOrder.sections).toEqual([
      {
        kind: "straight-ankle",
        rows: result.calc.legRows,
        startStitches: 60,
        endStitches: 60,
      },
    ]);
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
