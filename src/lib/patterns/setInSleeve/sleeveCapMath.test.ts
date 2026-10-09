import { describe, expect, it } from "vitest";
import { calculateArmholeShaping } from "../legoBlocks/armholeShaping";
import {
  resolveDropShoulderFinishedUpperArmInches,
  resolveDropShoulderUpperArmEaseInches,
} from "../dropShoulderSleeveEase";
import { FIT_EASE_INCHES_BY_CHOICE } from "../fitEaseInches";
import {
  SLEEVE_CAP_SEAM_TOLERANCE_INCHES,
  calculateSetInSleeveCap,
  topOfCapWidthInches,
  upperSlopeRows,
  type SetInSleeveCapInput,
  type SetInSleeveCapSuccess,
} from "./sleeveCapMath";

const STANDARD_BODY_EASE = FIT_EASE_INCHES_BY_CHOICE.standard;

type SizeSample = {
  name: string;
  chartAudience: "misses" | "plus" | "men";
  bodyBustInches: number;
  shoulderWidthInches: number;
  armholeDepthInches: number;
  bodyUpperArmInches: number;
};

/** Chart body measurements. Finished bust adds standard body ease (+3 in). */
const SIZES: SizeSample[] = [
  {
    name: "Misses 1",
    chartAudience: "misses",
    bodyBustInches: 31.5,
    shoulderWidthInches: 12,
    armholeDepthInches: 7,
    bodyUpperArmInches: 9.75,
  },
  {
    name: "Misses 7",
    chartAudience: "misses",
    bodyBustInches: 40,
    shoulderWidthInches: 13.75,
    armholeDepthInches: 7.75,
    bodyUpperArmInches: 12,
  },
  {
    name: "Plus 1x",
    chartAudience: "plus",
    bodyBustInches: 43,
    shoulderWidthInches: 16.37,
    armholeDepthInches: 10,
    bodyUpperArmInches: 14,
  },
  {
    name: "Plus 6x",
    chartAudience: "plus",
    bodyBustInches: 63,
    shoulderWidthInches: 19,
    armholeDepthInches: 12,
    bodyUpperArmInches: 19,
  },
  {
    name: "Men Sm",
    chartAudience: "men",
    bodyBustInches: 34,
    shoulderWidthInches: 15,
    armholeDepthInches: 8.5,
    bodyUpperArmInches: 12,
  },
  {
    name: "Men 4X",
    chartAudience: "men",
    bodyBustInches: 48,
    shoulderWidthInches: 21,
    armholeDepthInches: 12,
    bodyUpperArmInches: 20,
  },
];

const GAUGES = [
  { name: "7 sts / 10 rows", stitchesPerInch: 7, rowsPerInch: 10 },
  { name: "5 sts / 7 rows", stitchesPerInch: 5, rowsPerInch: 7 },
  { name: "6 sts / 8 rows", stitchesPerInch: 6, rowsPerInch: 8 },
  { name: "4 sts / 6 rows", stitchesPerInch: 4, rowsPerInch: 6 },
  { name: "8 sts / 11 rows", stitchesPerInch: 8, rowsPerInch: 11 },
  { name: "3.5 sts / 5 rows", stitchesPerInch: 3.5, rowsPerInch: 5 },
  { name: "9 sts / 12 rows", stitchesPerInch: 9, rowsPerInch: 12 },
];

function inputFor(size: SizeSample, gauge: { stitchesPerInch: number; rowsPerInch: number }): SetInSleeveCapInput {
  return {
    finishedBustInches: size.bodyBustInches + STANDARD_BODY_EASE,
    shoulderWidthInches: size.shoulderWidthInches,
    armholeDepthInches: size.armholeDepthInches,
    bodyUpperArmInches: size.bodyUpperArmInches,
    chartAudience: size.chartAudience,
    fit: "standard",
    stitchesPerInch: gauge.stitchesPerInch,
    rowsPerInch: gauge.rowsPerInch,
  };
}

function assertSchedule(
  steps: { stitchesEachSide: number; everyRows: number; times: number }[],
  stitchesEachSide: number,
  rows: number,
) {
  expect(steps.length).toBeGreaterThan(0);
  let stitchSum = 0;
  let rowSum = 0;
  for (const step of steps) {
    expect(Number.isInteger(step.stitchesEachSide)).toBe(true);
    expect(Number.isInteger(step.everyRows)).toBe(true);
    expect(Number.isInteger(step.times)).toBe(true);
    expect(step.stitchesEachSide).toBeGreaterThan(0);
    expect(step.everyRows).toBeGreaterThan(0);
    expect(step.times).toBeGreaterThan(0);
    stitchSum += step.stitchesEachSide * step.times;
    rowSum += step.everyRows * step.times;
  }
  expect(stitchSum).toBe(stitchesEachSide);
  expect(rowSum).toBe(rows);
}

function assertValidCap(result: SetInSleeveCapSuccess, gauge: { stitchesPerInch: number; rowsPerInch: number }) {
  const { stitchesPerInch, rowsPerInch } = gauge;
  const integers = [
    result.armhole.totalRows,
    result.armhole.bindOffStitchesEachSide,
    result.armhole.bindOffRows,
    result.armhole.decreaseStitchesEachSide,
    result.armhole.decreaseRows,
    result.armhole.straightRows,
    result.armhole.bodyStitchesAtUnderarm,
    result.armhole.bodyStitchesAtShoulder,
    result.sleeve.upperArmStitches,
    result.sleeve.initialBindOffStitchesEachSide,
    result.sleeve.initialBindOffRows,
    result.top.stitches,
    result.upperSlope.stitchesEachSide,
    result.upperSlope.rows,
    result.upperSlope.plainRows,
    result.workingCap.stitchesEachSide,
    result.workingCap.rows,
    result.workingCap.zones.lower.stitchesEachSide,
    result.workingCap.zones.middle.stitchesEachSide,
    result.workingCap.zones.upper.stitchesEachSide,
    result.workingCap.zones.lower.rows,
    result.workingCap.zones.middle.rows,
    result.workingCap.zones.upper.rows,
    result.totals.capRows,
    result.totals.finalStitches,
  ];
  for (const count of integers) {
    expect(Number.isInteger(count)).toBe(true);
    expect(count).toBeGreaterThanOrEqual(0);
  }

  expect(result.intentionalCapEaseInches).toBe(0);
  expect(result.armhole.appliesTo).toBe("front-and-back");
  expect(result.armhole.straightRows).toBe(
    result.armhole.totalRows - 2 - result.armhole.decreaseRows,
  );
  expect(result.armhole.decreaseRows).toBe(result.armhole.decreaseStitchesEachSide * 2);
  expect(result.armhole.bindOffRows).toBe(2);

  const internal = calculateArmholeShaping({
    startingStitches: result.armhole.bodyStitchesAtUnderarm,
    targetStitches: result.armhole.bodyStitchesAtShoulder,
    totalRows: result.armhole.totalRows,
  });
  expect(result.armhole.bindOffStitchesEachSide).toBe(internal.bindOffSts);
  expect(result.armhole.decreaseStitchesEachSide).toBe(internal.decreaseSts);
  expect(result.armhole.straightRows).toBe(internal.evenRows - 2);

  expect(result.sleeve.initialBindOffStitchesEachSide).toBe(result.armhole.bindOffStitchesEachSide);
  expect(result.top.widthInches).toBeCloseTo(result.sleeve.finishedUpperArmInches / 4 - 0.25, 10);
  expect(result.top.widthInches).toBe(topOfCapWidthInches(result.sleeve.finishedUpperArmInches));
  expect(result.totals.finalStitches).toBe(result.top.stitches);
  expect(result.top.knittedWidthInches).toBeCloseTo(result.top.stitches / stitchesPerInch, 8);
  expect(Math.abs(result.top.knittedWidthInches - result.top.widthInches)).toBeLessThanOrEqual(
    1 / stitchesPerInch + 1e-9,
  );

  expect(result.upperSlope.targetWidthInches).toBe(1);
  expect(result.upperSlope.targetHeightInches).toBe(0.5);
  expect(result.upperSlope.rows).toBe(upperSlopeRows(rowsPerInch));
  expect(result.upperSlope.rows % 2).toBe(0);
  expect(result.upperSlope.stitchesEachSide).toBe(Math.round(stitchesPerInch));
  expect(Math.abs(result.upperSlope.widthInches - 1)).toBeLessThanOrEqual(0.5 / stitchesPerInch + 1e-9);
  expect(Math.abs(result.upperSlope.heightInches - 0.5)).toBeLessThanOrEqual(1.5 / rowsPerInch + 1e-9);
  let previousSlope = 0;
  let slopeStitches = 0;
  for (const step of result.upperSlope.steps) {
    expect(step.rows).toBe(2);
    expect(step.stitchesEachSide).toBeGreaterThanOrEqual(previousSlope);
    previousSlope = step.stitchesEachSide;
    slopeStitches += step.stitchesEachSide;
  }
  expect(slopeStitches).toBe(result.upperSlope.stitchesEachSide);
  expect(result.upperSlope.steps.length * 2 + result.upperSlope.plainRows).toBe(result.upperSlope.rows);

  const { lower, middle, upper } = result.workingCap.zones;
  expect(lower.pace).toBe("faster");
  expect(middle.pace).toBe("slower");
  expect(upper.pace).toBe("faster");
  expect(lower.stitchesEachSide * middle.rows).toBeGreaterThan(middle.stitchesEachSide * lower.rows);
  expect(upper.stitchesEachSide * middle.rows).toBeGreaterThan(middle.stitchesEachSide * upper.rows);
  expect(lower.rows + middle.rows + upper.rows).toBe(result.workingCap.rows);
  expect(lower.stitchesEachSide + middle.stitchesEachSide + upper.stitchesEachSide).toBe(
    result.workingCap.stitchesEachSide,
  );
  expect(lower.rows).toBe(Math.floor(result.workingCap.rows / 4));
  expect(upper.rows).toBe(lower.rows);
  expect(middle.rows).toBe(result.workingCap.rows - lower.rows - upper.rows);
  assertSchedule(lower.steps, lower.stitchesEachSide, lower.rows);
  assertSchedule(middle.steps, middle.stitchesEachSide, middle.rows);
  assertSchedule(upper.steps, upper.stitchesEachSide, upper.rows);
  for (const zone of [lower, middle, upper]) {
    for (const step of zone.steps) expect(step.stitchesEachSide).toBe(1);
  }

  expect(result.workingCap.geometricHeightInches).toBeGreaterThan(0);
  expect(result.workingCap.rows).toBe(
    Math.round(result.workingCap.geometricHeightInches * rowsPerInch),
  );
  expect(
    Math.hypot(result.workingCap.widthInches, result.workingCap.geometricHeightInches),
  ).toBeCloseTo(result.workingCap.seamInches, 6);

  expect(result.totals.capRows).toBe(2 + result.workingCap.rows + result.upperSlope.rows);
  expect(result.totals.capHeightInches).toBeCloseTo(result.totals.capRows / rowsPerInch, 8);
  expect(result.totals.capHeightInches).toBeGreaterThan(result.workingCap.knittedHeightInches);
  expect(result.totals.capHeightInches).toBeGreaterThan(result.upperSlope.heightInches);

  expect(Math.abs(result.seam.differenceInches)).toBeLessThanOrEqual(SLEEVE_CAP_SEAM_TOLERANCE_INCHES);
  expect(result.seam.toleranceInches).toBe(0.5);
  expect(result.seam.sleeveCapEdgeInches).toBeCloseTo(
    result.seam.armholeEdgeInches + result.seam.differenceInches,
    6,
  );
  expect(result.seam.armholeEdgeInches).toBeCloseTo(
    result.seam.underarmBindOffInches +
      result.seam.lowerCapInches +
      result.seam.middleCapInches +
      result.seam.upperCapInches +
      result.seam.upperSlopeInches +
      result.seam.halfTopBindOffInches -
      result.seam.differenceInches,
    6,
  );

  const top = result.phases[result.phases.length - 1];
  expect(top).toEqual({ kind: "top-bind-off", stitches: result.top.stitches });
  expect(result.phases.map((phase) => phase.kind)).toEqual([
    "underarm-bind-off",
    "decrease-zone",
    "decrease-zone",
    "decrease-zone",
    "upper-slope",
    "top-bind-off",
  ]);
  let previousStitches = result.sleeve.upperArmStitches;
  for (const phase of result.phases) {
    if (phase.kind === "top-bind-off") {
      expect(phase.stitches).toBe(previousStitches);
      continue;
    }
    expect(phase.stitchesAfter).toBeLessThan(previousStitches);
    expect(Number.isInteger(phase.stitchesAfter)).toBe(true);
    previousStitches = phase.stitchesAfter;
  }
}

describe("sleeve-cap formulas", () => {
  it("keeps the top width at finished upper arm ÷ 4 − ¼ inch", () => {
    expect(topOfCapWidthInches(11.75)).toBe(11.75 / 4 - 0.25);
    expect(topOfCapWidthInches(21)).toBe(21 / 4 - 0.25);
    expect(topOfCapWidthInches(14)).toBe(3.25);
  });

  it("makes the upper slope an even row count of about ½ inch", () => {
    expect(upperSlopeRows(10)).toBe(6);
    expect(upperSlopeRows(7)).toBe(4);
    expect(upperSlopeRows(8)).toBe(4);
    expect(upperSlopeRows(5)).toBe(4);
    expect(upperSlopeRows(11)).toBe(6);
  });

  it("uses a ½ inch seam match limit", () => {
    expect(SLEEVE_CAP_SEAM_TOLERANCE_INCHES).toBe(0.5);
  });
});

describe("Misses 1 at 7 stitches and 10 rows", () => {
  const gauge = { stitchesPerInch: 7, rowsPerInch: 10 };
  const result = calculateSetInSleeveCap(inputFor(SIZES[0]!, gauge));

  it("matches the hand-worked cap", () => {
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.sleeve.upperArmEaseInches).toBe(2);
    expect(result.sleeve.finishedUpperArmInches).toBe(11.75);
    expect(result.sleeve.upperArmStitches).toBe(82);
    expect(result.armhole.totalRows).toBe(70);
    expect(result.armhole.bodyStitchesAtUnderarm).toBe(122);
    expect(result.armhole.bodyStitchesAtShoulder).toBe(84);
    expect(result.armhole.bindOffStitchesEachSide).toBe(10);
    expect(result.armhole.decreaseStitchesEachSide).toBe(9);
    expect(result.armhole.decreaseRows).toBe(18);
    expect(result.armhole.straightRows).toBe(50);

    const bindOffEdge = 10 / 7;
    const decreaseEdge = Math.hypot(9 / 7, 18 / 10);
    const straightEdge = 5;
    expect(result.armhole.edgeInches).toBeCloseTo(bindOffEdge + decreaseEdge + straightEdge, 6);

    expect(result.top.widthInches).toBe(2.6875);
    expect(result.top.stitches).toBe(18);
    expect(result.upperSlope.stitchesEachSide).toBe(7);
    expect(result.upperSlope.rows).toBe(6);
    expect(result.upperSlope.steps.map((step) => step.stitchesEachSide)).toEqual([2, 2, 3]);
    expect(result.workingCap.stitchesEachSide).toBe(15);

    const slopeEdge = Math.hypot(1, 0.6);
    const halfTop = 18 / 7 / 2;
    const workingSeam = result.armhole.edgeInches - bindOffEdge - slopeEdge - halfTop;
    const workingWidth = 15 / 7;
    const height = Math.sqrt(workingSeam * workingSeam - workingWidth * workingWidth);
    expect(result.workingCap.seamInches).toBeCloseTo(workingSeam, 6);
    expect(result.workingCap.widthInches).toBeCloseTo(workingWidth, 6);
    expect(result.workingCap.geometricHeightInches).toBeCloseTo(height, 6);
    expect(result.workingCap.rows).toBe(Math.round(height * 10));
    expect(result.workingCap.stitchDivision).toBe("thirds");
    expect(result.workingCap.zones.lower.stitchesEachSide).toBe(5);
    expect(result.workingCap.zones.middle.stitchesEachSide).toBe(5);
    expect(result.workingCap.zones.upper.stitchesEachSide).toBe(5);
    expect(result.totals.finalStitches).toBe(18);
    expect(result.totals.capRows).toBe(2 + result.workingCap.rows + 6);
  });

  it("satisfies the cap checks", () => {
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    assertValidCap(result, gauge);
  });
});

describe("adult sizes and gauges", () => {
  const cases = SIZES.flatMap((size) =>
    GAUGES.map((gauge) => ({
      label: `${size.name} · ${gauge.name}`,
      size,
      gauge,
    })),
  );

  it("lists size and gauge combinations that cannot form a cap", () => {
    const failures: string[] = [];
    for (const { label, size, gauge } of cases) {
      const result = calculateSetInSleeveCap(inputFor(size, gauge));
      if (!result.ok) failures.push(`${label}: ${result.reason}: ${result.message}`);
    }
    expect(failures).toEqual([]);
  });

  it.each(cases)("$label forms a valid cap", ({ label, size, gauge }) => {
    const result = calculateSetInSleeveCap(inputFor(size, gauge));
    expect(result.ok, result.ok ? label : `${result.reason}: ${result.message}`).toBe(true);
    if (!result.ok) return;
    assertValidCap(result, gauge);
    expect(result.sleeve.finishedUpperArmInches).toBe(
      resolveDropShoulderFinishedUpperArmInches({
        chartAudience: size.chartAudience,
        fit: "standard",
        bodyUpperArmIn: size.bodyUpperArmInches,
      }),
    );
    expect(result.sleeve.upperArmEaseInches).toBe(
      resolveDropShoulderUpperArmEaseInches({
        chartAudience: size.chartAudience,
        fit: "standard",
      }),
    );
  });
});

describe("wide-shoulder men's cap", () => {
  it("keeps the quarter / half / quarter rows when equal thirds do not fit", () => {
    const men4x = SIZES.find((size) => size.name === "Men 4X");
    expect(men4x).toBeDefined();
    if (!men4x) return;
    const result = calculateSetInSleeveCap(
      inputFor(men4x, { stitchesPerInch: 5, rowsPerInch: 7 }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workingCap.stitchDivision).toBe("adjusted");
    expect(result.workingCap.rows).toBe(38);
    expect(result.workingCap.zones.lower).toMatchObject({ stitchesEachSide: 9, rows: 9 });
    expect(result.workingCap.zones.middle).toMatchObject({ stitchesEachSide: 13, rows: 20 });
    expect(result.workingCap.zones.upper).toMatchObject({ stitchesEachSide: 9, rows: 9 });
    assertValidCap(result, { stitchesPerInch: 5, rowsPerInch: 7 });
  });
});

describe("sleeve ease and rejected measurements", () => {
  const misses7 = inputFor(SIZES[1]!, { stitchesPerInch: 7, rowsPerInch: 10 });

  it("follows Drop Shoulder ease for close, standard, and relaxed adult fits", () => {
    for (const fit of ["close", "standard", "relaxed"] as const) {
      const result = calculateSetInSleeveCap({ ...misses7, fit });
      const expectedEase = resolveDropShoulderUpperArmEaseInches({
        chartAudience: "misses",
        fit,
      });
      const expectedWidth = resolveDropShoulderFinishedUpperArmInches({
        chartAudience: "misses",
        fit,
        bodyUpperArmIn: misses7.bodyUpperArmInches,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.sleeve.upperArmEaseInches).toBe(expectedEase);
      expect(result.sleeve.finishedUpperArmInches).toBe(expectedWidth);
      assertValidCap(result, { stitchesPerInch: 7, rowsPerInch: 10 });
    }
  });

  it("rejects children and babies", () => {
    for (const chartAudience of ["kids", "baby"]) {
      const result = calculateSetInSleeveCap({ ...misses7, chartAudience });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("adult-sizes-only");
    }
  });

  it("rejects a zero gauge", () => {
    const result = calculateSetInSleeveCap({ ...misses7, stitchesPerInch: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid-input");
  });

  it("rejects an armhole too shallow for its decreases", () => {
    const result = calculateSetInSleeveCap({
      ...misses7,
      armholeDepthInches: 2,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("armhole-too-shallow");
    expect(result.message).toContain("not enough rows");
  });

  it("rejects a wide sleeve whose armhole edge cannot cover the cap", () => {
    const result = calculateSetInSleeveCap({
      finishedBustInches: 36,
      shoulderWidthInches: 16,
      armholeDepthInches: 6,
      bodyUpperArmInches: 18,
      chartAudience: "misses",
      fit: "standard",
      stitchesPerInch: 7,
      rowsPerInch: 10,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("impossible-geometry");
    expect(result.message).toContain("not long enough");
  });
});
