import { describe, expect, it } from "vitest";
import { resolveEffectiveBackNeckDepthInches } from "../customBuildEffectiveNeckDepth";
import { resolveDropShoulderFinishedWristInches } from "../dropShoulderSleeveEase";
import {
  scaleDropShoulderCuffCircumferenceInches,
  scaleDropShoulderSleeveLengthInches,
} from "../dropShoulderSleeveMeasurementOverrides";
import { sleeveShapingPerSide } from "../evenShapingSchedule";
import { fitEaseInchesForChoice } from "../fitEaseInches";
import { calculateHemRowsFromInches, getDefaultHemLengthInches } from "../hemDefaults";
import { DROP_SHOULDER_SLEEVE_LENGTH_CHOICES } from "../patternConstructionIdentity";
import type { ChartRow } from "../sleevelessExpressSizeChartTypes";
import { SLEEVE_CAP_SEAM_TOLERANCE_INCHES } from "./sleeveCapMath";
import {
  calculateSetInSleeveSweater,
  type SetInSleeveSweaterSuccess,
} from "./setInSleeveSweaterMath";

type SizeFixture = {
  audience: string;
  name: string;
  row: ChartRow;
};

const SIZES: SizeFixture[] = [
  {
    audience: "misses",
    name: "Misses 1",
    row: {
      bust_or_chest: 31.5,
      hip: 33.5,
      garment_back_length: 21,
      armhole_depth: 7,
      shoulder_width: 12,
      neck_opening: 6,
      front_neck_depth: 4,
      back_neck_depth: 1,
      upper_arm: 9.75,
      wrist: 5.25,
      sleeve_length: 16.25,
    },
  },
  {
    audience: "misses",
    name: "Misses 7",
    row: {
      bust_or_chest: 40,
      hip: 42,
      garment_back_length: 24.5,
      armhole_depth: 7.75,
      shoulder_width: 13.75,
      neck_opening: 7.5,
      front_neck_depth: 5,
      back_neck_depth: 1,
      upper_arm: 12,
      wrist: 6,
      sleeve_length: 17,
    },
  },
  {
    audience: "plus",
    name: "Plus 1x",
    row: {
      bust_or_chest: 43,
      hip: 45,
      garment_back_length: 25.5,
      armhole_depth: 10,
      shoulder_width: 16.37,
      neck_opening: 7.25,
      front_neck_depth: 5.25,
      back_neck_depth: 1,
      upper_arm: 14,
      wrist: 7.25,
      sleeve_length: 16.75,
    },
  },
  {
    audience: "plus",
    name: "Plus 6x",
    row: {
      bust_or_chest: 63,
      hip: 65,
      garment_back_length: 28,
      armhole_depth: 12,
      shoulder_width: 19,
      neck_opening: 8.5,
      front_neck_depth: 7,
      back_neck_depth: 1,
      upper_arm: 19,
      wrist: 8.5,
      sleeve_length: 17,
    },
  },
  {
    audience: "men",
    name: "Men Sm",
    row: {
      bust_or_chest: 34,
      hip: 36.5,
      garment_back_length: 25.5,
      armhole_depth: 8.5,
      shoulder_width: 15,
      neck_opening: 6.25,
      front_neck_depth: 4,
      back_neck_depth: 1,
      upper_arm: 12,
      wrist: 6.25,
      sleeve_length: 18,
    },
  },
  {
    audience: "men",
    name: "Men 4X",
    row: {
      bust_or_chest: 48,
      hip: 52.5,
      garment_back_length: 29,
      armhole_depth: 12,
      shoulder_width: 21,
      neck_opening: 8.25,
      front_neck_depth: 5.75,
      back_neck_depth: 1.5,
      upper_arm: 20,
      wrist: 8,
      sleeve_length: 19.75,
    },
  },
];

const GAUGES: Array<[number, number]> = [
  [7, 10],
  [5, 7],
  [4, 6],
  [8, 11],
];

function assertWhole(value: number): void {
  expect(Number.isInteger(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(0);
}

function assertIntegrated(
  result: SetInSleeveSweaterSuccess,
  size: SizeFixture,
  rowsPerInch: number,
): void {
  const ease = fitEaseInchesForChoice("standard");
  const bust = Number(size.row.bust_or_chest);
  const armholeDepth = Number(size.row.armhole_depth);
  const bodyUpperArm = Number(size.row.upper_arm);

  expect(result.finished.bodyEaseInches).toBe(ease);
  expect(result.finished.bustInches).toBe(Math.round((bust + ease) * 4) / 4);
  expect(result.finished.armholeDepthInches).toBe(armholeDepth);
  expect(result.finished.bodyUpperArmInches).toBe(bodyUpperArm);
  expect(result.finished.upperArmEaseInches).toBe(2);
  expect(result.finished.finishedUpperArmInches).toBe(
    Math.round((bodyUpperArm + 2) * 4) / 4,
  );
  expect(result.finished.backNeckDepthInches).toBe(
    resolveEffectiveBackNeckDepthInches({
      fit: { selectedMeasurements: { back_neck_depth: size.row.back_neck_depth } },
    }),
  );
  expect(result.finished.backNeckDepthInches).toBeLessThanOrEqual(1);

  const armhole = result.body.armhole;
  expect(armhole.appliesTo).toBe("front-and-back");
  expect(armhole.totalRows).toBe(Math.round(armholeDepth * rowsPerInch));
  expect(armhole.straightRows).toBe(
    armhole.totalRows - armhole.bindOffRows - armhole.decreaseRows,
  );
  expect(
    armhole.bindOffStitchesEachSide +
      armhole.stairStepStitchesEachSide +
      armhole.decreaseStitchesEachSide,
  ).toBe(armhole.shapingStitchesEachSide);
  expect(result.body.stitchesAtUnderarm).toBe(armhole.bodyStitchesAtUnderarm);
  expect(result.body.stitchesAtShoulder).toBe(armhole.bodyStitchesAtShoulder);
  expect(result.body.bodyBlock.armholeStartStitches).toBe(armhole.bodyStitchesAtUnderarm);

  expect(result.body.hemRows + result.body.rowsToArmhole + armhole.totalRows).toBe(
    result.body.totalRows,
  );
  expect(result.body.totalRows).toBe(Math.round(result.finished.lengthInches * rowsPerInch));
  expect(result.body.hemRows).toBe(
    calculateHemRowsFromInches(rowsPerInch, getDefaultHemLengthInches(size.audience)),
  );

  expect(result.sleeve.upperArmStitches).toBe(result.sleeveCap.sleeve.upperArmStitches);
  expect(result.sleeveCap.sleeve.initialBindOffStitchesEachSide).toBe(
    armhole.bindOffStitchesEachSide,
  );
  expect(result.sleeveCap.sleeve.stairStepBindOffsEachSide).toEqual(
    armhole.stairStepBindOffsEachSide,
  );
  expect(result.finished.sleeveLengthInches).toBe(
    scaleDropShoulderSleeveLengthInches(Number(size.row.sleeve_length), "long"),
  );
  expect(result.sleeve.rowsToUpperArm).toBe(result.rows.sleeveCuffToUpperArm);
  expect(result.rows.sleeveCuffThroughCap).toBe(
    result.sleeve.rowsToUpperArm + result.sleeveCap.totals.capRows,
  );
  expect(result.rows.sleeveCap).toBe(result.sleeveCap.totals.capRows);
  expect(result.finished.sleeveLengthInches).not.toBe(result.sleeveCap.totals.capHeightInches);
  expect(result.sleeve.rowsToUpperArm).toBeGreaterThan(0);
  expect(result.sleeveCap.totals.capRows).toBe(
    result.sleeveCap.sleeve.matchedBindOffRows +
      result.sleeveCap.workingCap.rows +
      result.sleeveCap.upperSlope.rows,
  );

  const perSide = sleeveShapingPerSide(result.sleeve.upperArmStitches, result.sleeve.wristStitches);
  expect(result.sleeve.shaping.schedule.count).toBe(perSide);
  expect(
    result.sleeve.shaping.schedule.interval * result.sleeve.shaping.schedule.count +
      result.sleeve.shaping.schedule.remainderRows,
  ).toBe(result.sleeve.rowsCuffToUpperArm);
  expect(perSide).toBeGreaterThan(0);
  expect(result.sleeve.shaping.shapingDirection).toBe("increase");

  expect(result.sleeveCap.intentionalCapEaseInches).toBe(0);
  expect(Math.abs(result.sleeveCap.seam.differenceInches)).toBeLessThanOrEqual(
    SLEEVE_CAP_SEAM_TOLERANCE_INCHES,
  );
  expect(result.sleeveCap.workingCap.zones.lower.pace).toBe("faster");
  expect(result.sleeveCap.workingCap.zones.middle.pace).toBe("slower");
  expect(result.sleeveCap.workingCap.zones.upper.pace).toBe("faster");

  const neck = result.body.neckline;
  expect(neck.back.totalCheck).toBe(neck.openingStitches);
  expect(neck.front.totalCheck).toBe(neck.openingStitches);
  expect(neck.openingStitches % 2).toBe(0);
  const shoulderSum =
    neck.shoulderBindOff.leftChunks.reduce((sum, n) => sum + n, 0) +
    neck.shoulderBindOff.rightChunks.reduce((sum, n) => sum + n, 0);
  expect(shoulderSum).toBe(armhole.bodyStitchesAtShoulder - neck.openingStitches);
  expect(neck.shoulderStitchesPerSide).toBe(
    Math.floor((armhole.bodyStitchesAtShoulder - neck.openingStitches) / 2),
  );

  const counts = [
    armhole.totalRows,
    armhole.straightRows,
    armhole.decreaseRows,
    armhole.bindOffStitchesEachSide,
    result.body.hemRows,
    result.body.rowsToArmhole,
    result.body.totalRows,
    result.sleeve.cuffRows,
    result.sleeve.rowsCuffToUpperArm,
    result.sleeve.rowsToUpperArm,
    result.sleeve.upperArmStitches,
    result.sleeve.wristStitches,
    result.sleeveCap.totals.capRows,
    result.sleeveCap.totals.finalStitches,
    neck.openingStitches,
    result.rows.sleeveCuffThroughCap,
  ];
  for (const count of counts) assertWhole(count);

  expect(result.needles.bodyRequired).toBe(
    Math.max(result.body.bodyBlock.hemStitches, armhole.bodyStitchesAtUnderarm),
  );
  expect(result.needles.sleeveRequired).toBe(result.sleeve.upperArmStitches);
  expect(result.needles.required).toBe(
    Math.max(result.needles.bodyRequired, result.needles.sleeveRequired),
  );
  expect(result.needles.fits).toBe(true);
}

describe("set-in sleeve sweater calculation", () => {
  it("integrates adult and plus sizes at practical gauges", () => {
    const failures: string[] = [];
    for (const size of SIZES) {
      for (const [stitchesPerInch, rowsPerInch] of GAUGES) {
        const result = calculateSetInSleeveSweater({
          chartAudience: size.audience,
          chartRow: size.row,
          stitchesPerInch,
          rowsPerInch,
          availableNeedles: 400,
        });
        if (!result.ok) {
          failures.push(`${size.name} ${stitchesPerInch}/${rowsPerInch}: ${result.reason} ${result.message}`);
          continue;
        }
        assertIntegrated(result, size, rowsPerInch);
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps sleeve length and sleeve-cap height separate for every length option", () => {
    const size = SIZES[1]!;
    const heights = new Set<number>();
    const lengths = new Set<number>();
    for (const choice of DROP_SHOULDER_SLEEVE_LENGTH_CHOICES) {
      const result = calculateSetInSleeveSweater({
        chartAudience: size.audience,
        chartRow: size.row,
        stitchesPerInch: 7,
        rowsPerInch: 10,
        availableNeedles: 400,
        sleeveLengthChoice: choice,
      });
      expect(result.ok, choice).toBe(true);
      if (!result.ok) continue;
      const expectedLength = scaleDropShoulderSleeveLengthInches(
        Number(size.row.sleeve_length),
        choice,
      );
      expect(result.finished.sleeveLengthInches).toBe(expectedLength);
      const finishedWrist = resolveDropShoulderFinishedWristInches({
        chartAudience: size.audience,
        fit: "standard",
        bodyWristIn: Number(size.row.wrist),
      });
      expect(result.finished.wristInches).toBe(
        scaleDropShoulderCuffCircumferenceInches(
          result.finished.finishedUpperArmInches,
          finishedWrist,
          choice,
        ),
      );
      heights.add(result.sleeveCap.totals.capHeightInches);
      lengths.add(result.finished.sleeveLengthInches);
      expect(result.sleeve.rowsToUpperArm + result.sleeveCap.totals.capRows).toBe(
        result.rows.sleeveCuffThroughCap,
      );
      if (choice === "short") {
        expect(result.sleeve.wristStitches).toBe(result.sleeve.upperArmStitches);
        expect(result.sleeve.shaping.noShaping).toBe(true);
      } else {
        expect(result.sleeve.upperArmStitches).toBeGreaterThan(result.sleeve.wristStitches);
        expect(result.sleeve.shaping.noShaping).toBe(false);
      }
    }
    expect(heights.size).toBe(1);
    expect(lengths.size).toBe(DROP_SHOULDER_SLEEVE_LENGTH_CHOICES.length);
  });

  it("uses close-fit ease from the existing body and sleeve tables", () => {
    const size = SIZES[1]!;
    const result = calculateSetInSleeveSweater({
      chartAudience: size.audience,
      fit: "close",
      chartRow: size.row,
      stitchesPerInch: 7,
      rowsPerInch: 10,
      availableNeedles: 400,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.finished.bodyEaseInches).toBe(1);
    expect(result.finished.bustInches).toBe(41);
    expect(result.finished.upperArmEaseInches).toBe(1);
    expect(result.finished.finishedUpperArmInches).toBe(13);
  });

  it("flips the sleeve shaping verb for top-down without changing measurements", () => {
    const size = SIZES[0]!;
    const cuffUp = calculateSetInSleeveSweater({
      chartAudience: size.audience,
      chartRow: size.row,
      stitchesPerInch: 7,
      rowsPerInch: 10,
      availableNeedles: 200,
      sleeveDirection: "cuff-up",
    });
    const topDown = calculateSetInSleeveSweater({
      chartAudience: size.audience,
      chartRow: size.row,
      stitchesPerInch: 7,
      rowsPerInch: 10,
      availableNeedles: 200,
      sleeveDirection: "top-down",
    });
    expect(cuffUp.ok && topDown.ok).toBe(true);
    if (!cuffUp.ok || !topDown.ok) return;
    expect(cuffUp.sleeve.shaping.shapingDirection).toBe("increase");
    expect(topDown.sleeve.shaping.shapingDirection).toBe("decrease");
    expect(topDown.finished.sleeveLengthInches).toBe(cuffUp.finished.sleeveLengthInches);
    expect(topDown.sleeveCap.totals.capHeightInches).toBe(cuffUp.sleeveCap.totals.capHeightInches);
    expect(topDown.sleeve.upperArmStitches).toBe(cuffUp.sleeve.upperArmStitches);
  });

  it("shapes an A-line body from hip to bust and keeps the armhole at the bust", () => {
    const size = SIZES[0]!;
    const result = calculateSetInSleeveSweater({
      chartAudience: size.audience,
      chartRow: size.row,
      stitchesPerInch: 7,
      rowsPerInch: 10,
      availableNeedles: 400,
      bodyShape: "aline",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.finished.hipInches).toBeGreaterThan(result.finished.bustInches);
    expect(result.body.bodyBlock.hemStitches).toBeGreaterThan(result.body.stitchesAtUnderarm);
    expect(result.body.bodyBlock.shapingDirection).toBe("decrease");
    expect(result.body.bodyBlock.armholeStartStitches).toBe(result.body.stitchesAtUnderarm);
    expect(result.needles.bodyRequired).toBe(result.body.bodyBlock.hemStitches);
  });

  it("checks body and sleeve needle capacity separately", () => {
    const size = SIZES[0]!;
    const wide = calculateSetInSleeveSweater({
      chartAudience: size.audience,
      chartRow: size.row,
      stitchesPerInch: 7,
      rowsPerInch: 10,
      availableNeedles: 200,
    });
    const bodyOnlyTooNarrow = calculateSetInSleeveSweater({
      chartAudience: size.audience,
      chartRow: size.row,
      stitchesPerInch: 7,
      rowsPerInch: 10,
      availableNeedles: 100,
    });
    const bothTooNarrow = calculateSetInSleeveSweater({
      chartAudience: size.audience,
      chartRow: size.row,
      stitchesPerInch: 7,
      rowsPerInch: 10,
      availableNeedles: 70,
    });
    expect(wide.ok && bodyOnlyTooNarrow.ok && bothTooNarrow.ok).toBe(true);
    if (!wide.ok || !bodyOnlyTooNarrow.ok || !bothTooNarrow.ok) return;

    expect(wide.needles.fits).toBe(true);
    expect(wide.needles.messages).toEqual([]);

    expect(bodyOnlyTooNarrow.needles.bodyFits).toBe(false);
    expect(bodyOnlyTooNarrow.needles.sleeveFits).toBe(true);
    expect(bodyOnlyTooNarrow.needles.fits).toBe(false);
    expect(bodyOnlyTooNarrow.needles.messages.join(" ")).toContain("body");

    expect(bothTooNarrow.needles.bodyFits).toBe(false);
    expect(bothTooNarrow.needles.sleeveFits).toBe(false);
    expect(bothTooNarrow.needles.messages.join(" ")).toContain("sleeve");

    expect(bodyOnlyTooNarrow.sleeve.upperArmStitches).toBe(wide.sleeve.upperArmStitches);
    expect(bodyOnlyTooNarrow.body.armhole.totalRows).toBe(wide.body.armhole.totalRows);
  });

  it("rejects baby and children's sizes", () => {
    const size = SIZES[0]!;
    for (const chartAudience of ["baby", "kids", "kid"]) {
      const result = calculateSetInSleeveSweater({
        chartAudience,
        chartRow: size.row,
        stitchesPerInch: 7,
        rowsPerInch: 10,
        availableNeedles: 200,
      });
      expect(result.ok, chartAudience).toBe(false);
      if (result.ok) continue;
      expect(result.reason).toBe("adult-sizes-only");
    }
  });

  it("keeps the chart front neck depth independent of the armhole method", () => {
    const size = SIZES[1]!;
    const result = calculateSetInSleeveSweater({
      chartAudience: size.audience,
      chartRow: size.row,
      stitchesPerInch: 7,
      rowsPerInch: 10,
      availableNeedles: 400,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.neckline.front.necklineDepthRows).toBe(50);
    expect(result.body.armhole.straightRows).toBe(50);
    expect(result.body.armhole.method).toBe("alternate");
    expect(result.finished.lengthInches).toBe(24.5);
  });

  it("reports required needles when the machine size is not supplied", () => {
    const size = SIZES[0]!;
    const result = calculateSetInSleeveSweater({
      chartAudience: size.audience,
      chartRow: size.row,
      stitchesPerInch: 7,
      rowsPerInch: 10,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.needles.available).toBeNull();
    expect(result.needles.fits).toBeNull();
    expect(result.needles.required).toBeGreaterThan(0);
  });

  it("rejects a garment too short for the hem and armhole", () => {
    const size = SIZES[1]!;
    const result = calculateSetInSleeveSweater({
      chartAudience: size.audience,
      chartRow: { ...size.row, garment_back_length: 8 },
      stitchesPerInch: 7,
      rowsPerInch: 10,
      availableNeedles: 400,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("body-length");
  });

  it("rejects a size row that cannot supply the body measurements", () => {
    const result = calculateSetInSleeveSweater({
      chartAudience: "misses",
      chartRow: { bust_or_chest: 36 },
      stitchesPerInch: 7,
      rowsPerInch: 10,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid-input");
  });
});
