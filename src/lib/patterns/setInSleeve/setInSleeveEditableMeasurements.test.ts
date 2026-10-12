import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { reconcileDropShoulderSleeveOverridesForSizeChange, resolveDropShoulderSleeveInches } from "../dropShoulderSleeveMeasurementOverrides";
import { generateDropShoulderPattern } from "../dropShoulderPatternOutput";
import { withDropShoulderConstructionAuthored } from "../patternConstructionIdentity";
import { computeDefaultMeasurementsFromChartRow } from "../sleevelessExpressSizeChartClient";
import type { ChartRow } from "../sleevelessExpressSizeChartTypes";
import { generateSetInSleevePattern } from "../setInSleevePatternOutput";
import { withSetInSleeveConstructionAuthored } from "../setInSleeveConstructionIdentity";
import { DROP_SHOULDER_USER_EDITED_SLEEVE_FIELDS_KEY } from "../dropShoulderUserEditedSleeveFields";
import { setInSleeveSleeveStateAfterLengthPreset } from "./setInSleeveLengthPreset";
import { setInSleeveTaperProblem } from "./setInSleeveTaper";

const MISSES_7: ChartRow = {
  size: "7",
  bust_or_chest: 40,
  waist: 32,
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
};

const editDrawerSrc = readFileSync(
  resolve("src/scripts/sleevelessPatternEditDrawerPrototype.ts"),
  "utf8",
);

function textOf(rows: { paragraphs?: string[] }[]): string {
  return rows.flatMap((row) => row.paragraphs ?? []).join("\n");
}

function pattern(options?: {
  sleeveLength?: string;
  stitchesPerInch?: number;
  rowsPerInch?: number;
  overrides?: Record<string, string>;
  userEdited?: { upperArm?: boolean; sleeveLength?: boolean; cuffCircumference?: boolean };
  armholeDepth?: string;
  patternMode?: string;
}): Record<string, unknown> {
  const measurements = computeDefaultMeasurementsFromChartRow(MISSES_7, "standard");
  const userEdited = {
    upperArm: false,
    sleeveLength: false,
    cuffCircumference: false,
    ...options?.userEdited,
  };
  return {
    fit: {
      sizingChart: "misses",
      selectedSize: "7",
      easeChoice: "standard",
      selectedMeasurements: measurements,
      cbMeasurementOverrides: options?.overrides ?? {},
      [DROP_SHOULDER_USER_EDITED_SLEEVE_FIELDS_KEY]: userEdited,
    },
    style: withSetInSleeveConstructionAuthored(
      {
        recipientCategory: "misses",
        garmentStyle: "pullover",
        neckline: "round",
        bodyShape: "straight",
        ...(options?.patternMode ? { patternMode: options.patternMode } : {}),
      },
      options?.sleeveLength ?? "long",
    ),
    yarnGaugeMachine: {
      gaugeStitchesPerInch: options?.stitchesPerInch ?? 7,
      gaugeRowsPerInch: options?.rowsPerInch ?? 10,
      availableNeedles: 200,
    },
  };
}

describe("set-in sleeve editable measurements", () => {
  it("keeps unedited instructions on the chart and preset, and does not rewrite the saved pattern", () => {
    const saved = pattern();
    const before = JSON.stringify(saved);
    const result = generateSetInSleevePattern(saved);
    expect(JSON.stringify(saved)).toBe(before);
    expect((saved.fit as { selectedSize: string }).selectedSize).toBe("7");
    expect(result.sleeveSaveBlocker).toBeNull();
    expect(result.sleeveCap?.sleeve.finishedUpperArmInches).toBe(14);
    expect(result.sleeveCap?.sleeve.upperArmEaseInches).toBe(2);
    expect(textOf(result.sleeveDisplayRows)).toContain("Bind off");
    expect(result.warnings.join(" ")).not.toMatch(/bind-off does not match/i);
  });

  it("recalculates the cap from a custom upper arm without changing the body armhole", () => {
    const baseline = generateSetInSleevePattern(pattern());
    const custom = generateSetInSleevePattern(
      pattern({
        overrides: { upperArm: "16" },
        userEdited: { upperArm: true },
      }),
    );
    expect(custom.sleeveSaveBlocker).toBeNull();
    expect(custom.sleeveCap?.sleeve.finishedUpperArmInches).toBe(16);
    expect(custom.sleeveCap?.sleeve.upperArmEaseInches).toBe(0);
    expect(custom.sleeveCap?.sleeve.upperArmStitches).not.toBe(baseline.sleeveCap?.sleeve.upperArmStitches);
    expect(custom.sleeveCap?.totals.capRows).not.toBe(baseline.sleeveCap?.totals.capRows);
    expect(custom.sleeveCap?.armhole).toEqual(baseline.sleeveCap?.armhole);
    expect(custom.debug.bustBodyStitches).toBe(baseline.debug.bustBodyStitches);
    expect(custom.sleevePiece?.topSts).toBe(custom.sleeveCap?.sleeve.upperArmStitches);
  });

  it("changes the sleeve taper from a custom cuff without changing the cap", () => {
    const baseline = generateSetInSleevePattern(pattern());
    const custom = generateSetInSleevePattern(
      pattern({
        overrides: { wrist: "10" },
        userEdited: { cuffCircumference: true },
      }),
    );
    expect(custom.sleeveSaveBlocker).toBeNull();
    expect(custom.sleeveCap).toEqual(baseline.sleeveCap);
    expect(custom.sleevePiece?.wristSts).not.toBe(baseline.sleevePiece?.wristSts);
    expect(custom.sleevePiece?.sleeveBodyRows).toBe(baseline.sleevePiece?.sleeveBodyRows);
    expect(textOf(custom.sleeveDisplayRows)).not.toBe(textOf(baseline.sleeveDisplayRows));
  });

  it("changes sleeve-body rows from a typed length without scaling it or changing the cap", () => {
    const baseline = generateSetInSleevePattern(pattern({ sleeveLength: "long" }));
    const custom = generateSetInSleevePattern(
      pattern({
        sleeveLength: "long",
        overrides: { sleeveLength: "10" },
        userEdited: { sleeveLength: true },
      }),
    );
    expect(custom.sleeveSaveBlocker).toBeNull();
    expect(custom.sleeveCap).toEqual(baseline.sleeveCap);
    expect(custom.sleevePiece?.sleeveTotalRows).toBe(Math.round(10 * 10));
    expect(custom.sleevePiece?.sleeveBodyRows).not.toBe(baseline.sleevePiece?.sleeveBodyRows);
    expect(custom.sleevePiece?.wristSts).toBe(baseline.sleevePiece?.wristSts);
  });

  it("keeps a custom upper arm and cuff when the length preset changes", () => {
    const next = setInSleeveSleeveStateAfterLengthPreset({
      overrides: { upperArm: "16", wrist: "8", sleeveLength: "12" },
      userEdited: { upperArm: true, cuffCircumference: true, sleeveLength: true },
      chartRow: MISSES_7,
      fitPreference: "standard",
      chartAudience: "misses",
    });
    expect(next.userEdited).toEqual({
      upperArm: true,
      cuffCircumference: true,
      sleeveLength: false,
    });
    expect(next.overrides.upperArm).toBe("16");
    expect(next.overrides.wrist).toBe("8");
    expect(next.overrides.sleeveLength).not.toBe("12");

    const generated = generateSetInSleevePattern(
      pattern({
        sleeveLength: "short",
        overrides: next.overrides,
        userEdited: next.userEdited,
      }),
    );
    expect(generated.sleeveCap?.sleeve.finishedUpperArmInches).toBe(16);
    expect(generated.sleevePiece?.wristSts).toBe(
      generateSetInSleevePattern(
        pattern({
          sleeveLength: "long",
          overrides: { upperArm: "16", wrist: "8" },
          userEdited: { upperArm: true, cuffCircumference: true },
        }),
      ).sleevePiece?.wristSts,
    );
    const resolved = resolveDropShoulderSleeveInches({
      overrides: next.overrides,
      chartRow: MISSES_7,
      fitPreference: "standard",
      chartAudience: "misses",
      sleeveLengthChoice: "short",
      userEdited: next.userEdited,
    });
    expect(resolved.sleeveLengthIn).toBe(5.5);
    expect(resolved.wristIn).toBe(8);
    expect(resolved.upperArmIn).toBe(16);
  });

  it("recalculates an unedited cuff for the selected preset", () => {
    const long = generateSetInSleevePattern(pattern({ sleeveLength: "long" }));
    const short = generateSetInSleevePattern(pattern({ sleeveLength: "short" }));
    expect(short.sleeveCap).toEqual(long.sleeveCap);
    expect(short.sleevePiece?.wristSts).toBe(short.sleevePiece?.topSts);
    expect(short.sleevePiece?.wristSts).not.toBe(long.sleevePiece?.wristSts);
    expect(short.sleeveSaveBlocker).toBeNull();
  });

  it("recalculates the body armhole and the cap together when only armhole depth changes", () => {
    const baseline = generateSetInSleevePattern(pattern());
    const deeper = generateSetInSleevePattern(
      pattern({
        patternMode: "custom-build",
        overrides: { armholeDepth: "9" },
      }),
    );
    expect(deeper.sleeveSaveBlocker).toBeNull();
    expect(deeper.debug.armholeDepth).toBe(9);
    expect(deeper.sleeveCap?.armhole.totalRows).not.toBe(baseline.sleeveCap?.armhole.totalRows);
    expect(deeper.sleeveCap?.sleeve.upperArmStitches).toBe(baseline.sleeveCap?.sleeve.upperArmStitches);
    expect(deeper.setInArmholePlan?.totalRows).toBe(deeper.sleeveCap?.armhole.totalRows);
  });

  it("blocks save when the sleeve taper does not fit, including a wider cuff that does not fit", () => {
    const narrow = generateSetInSleevePattern(
      pattern({
        sleeveLength: "short",
        stitchesPerInch: 9,
        rowsPerInch: 6,
        overrides: { upperArm: "13.25", wrist: "6.75" },
        userEdited: { upperArm: true, cuffCircumference: true },
      }),
    );
    expect(narrow.sleeveSaveBlocker).toMatch(/does not fit/);
    expect(textOf(narrow.sleeveDisplayRows)).toBe(narrow.sleeveSaveBlocker);
    expect(narrow.sleeveSaveBlocker).not.toMatch(/bind-off does not match/i);

    const flare = generateSetInSleevePattern(
      pattern({
        overrides: { sleeveLength: "4", wrist: "20", upperArm: "14" },
        userEdited: { sleeveLength: true, cuffCircumference: true, upperArm: true },
        stitchesPerInch: 9,
        rowsPerInch: 6,
      }),
    );
    expect(flare.sleeveCap?.sleeve.finishedUpperArmInches).toBe(14);
    expect(flare.sleeveSaveBlocker).toMatch(/does not fit/);
  });

  it("allows every-row shaping and a wider cuff when the rows are enough", () => {
    expect(
      setInSleeveTaperProblem({ topStitches: 40, cuffStitches: 20, sleeveBodyRows: 10 }),
    ).toBeNull();
    expect(
      setInSleeveTaperProblem({ topStitches: 40, cuffStitches: 48, sleeveBodyRows: 10 }),
    ).toBeNull();
    expect(
      setInSleeveTaperProblem({ topStitches: 40, cuffStitches: 20, sleeveBodyRows: 8 }),
    ).toMatch(/does not fit/);
  });

  it("leaves Drop Shoulder preset reset unchanged", () => {
    const dropShoulderReset = reconcileDropShoulderSleeveOverridesForSizeChange(
      { upperArm: "16", wrist: "8", sleeveLength: "12" },
      MISSES_7,
      "standard",
      { upperArm: true, sleeveLength: false, cuffCircumference: false },
      { chartAudience: "misses" },
    );
    expect(dropShoulderReset.upperArm).toBe("16");
    expect(dropShoulderReset.wrist).not.toBe("8");
    expect(dropShoulderReset.sleeveLength).not.toBe("12");

    const dropShoulder = generateDropShoulderPattern({
      fit: {
        sizingChart: "misses",
        selectedSize: "7",
        easeChoice: "standard",
        selectedMeasurements: computeDefaultMeasurementsFromChartRow(MISSES_7, "standard"),
      },
      style: withDropShoulderConstructionAuthored(
        { recipientCategory: "misses", bodyShape: "straight", garmentStyle: "pullover" },
        "short",
      ),
      yarnGaugeMachine: { gaugeStitchesPerInch: 7, gaugeRowsPerInch: 10, availableNeedles: 200 },
    });
    expect(dropShoulder.warnings.join(" ")).not.toMatch(/set-in/i);

    expect(editDrawerSrc).toContain("cuffCircumference: false");
    expect(editDrawerSrc).toContain("handleDropShoulderQuickEditSleeveLengthChanged");
    expect(editDrawerSrc).toContain("handleSetInSleeveQuickEditSleeveLengthChanged");
    expect(editDrawerSrc).toContain("setInSleeveSleeveStateAfterLengthPreset");
    expect(editDrawerSrc).toContain("generated.sleeveSaveBlocker");
  });
});
