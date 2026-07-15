import { describe, expect, it } from "vitest";
import { computeDropShoulderArmholeDepthInches } from "./dropShoulderArmholeDepth";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  dropShoulderSleeveDefaultsFromChartRow,
  reconcileDropShoulderSleeveOverridesForSizeChange,
  resolveDropShoulderSleeveInches,
  resolveDropShoulderSleeveOverrideStrings,
} from "./dropShoulderSleeveMeasurementOverrides";
import {
  dropShoulderSleeveEaseGroupForChartAudience,
  getDefaultSleeveEase,
  normalizeSleeveEaseFit,
  resolveDropShoulderFinishedUpperArmInches,
  resolveDropShoulderFinishedWristInches,
  resolveDropShoulderUpperArmEaseInches,
  resolveDropShoulderWristEaseInches,
} from "./dropShoulderSleeveEase";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import type { DropShoulderUserEditedSleeveFields } from "./dropShoulderUserEditedSleeveFields";

/** Misses size 7 — body upper_arm 12, wrist 6. */
const MISSES_7: ChartRow = {
  size: 7,
  bust_or_chest: 40,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

/** Men's Med — body upper_arm 13, wrist 6.5. */
const MENS_MED: ChartRow = {
  size: "Med",
  bust_or_chest: 36,
  upper_arm: 13,
  wrist: 6.5,
  sleeve_length: 18.25,
};

/** Baby 3 mo — body upper_arm 5.5, wrist 3.5. */
const BABY_3MO: ChartRow = {
  size: "3 mo",
  bust_or_chest: 16,
  upper_arm: 5.5,
  wrist: 3.5,
  sleeve_length: 6,
};

/** Kids 2 yr — body upper_arm 6, wrist 4.5. */
const KIDS_2YR: ChartRow = {
  size: "2 yr",
  bust_or_chest: 21,
  upper_arm: 6,
  wrist: 4.5,
  sleeve_length: 8.5,
};

const NONE_EDITED: DropShoulderUserEditedSleeveFields = {
  upperArm: false,
  sleeveLength: false,
  cuffCircumference: false,
};

const UPPER_ARM_EDITED: DropShoulderUserEditedSleeveFields = {
  upperArm: true,
  sleeveLength: false,
  cuffCircumference: false,
};

const WRIST_EDITED: DropShoulderUserEditedSleeveFields = {
  upperArm: false,
  sleeveLength: false,
  cuffCircumference: true,
};

function defaultsFor(
  row: ChartRow,
  chartAudience: string,
  fit: string,
): Partial<Record<"upperArm" | "wrist", string>> {
  return dropShoulderSleeveDefaultsFromChartRow(row, fit, { chartAudience });
}

describe("dropShoulderSleeveEaseGroupForChartAudience", () => {
  it("maps the five repo sizing audiences to baby, child, and adult groups", () => {
    expect(dropShoulderSleeveEaseGroupForChartAudience("baby")).toBe("baby");
    expect(dropShoulderSleeveEaseGroupForChartAudience("kids")).toBe("child");
    expect(dropShoulderSleeveEaseGroupForChartAudience("misses")).toBe("adult");
    expect(dropShoulderSleeveEaseGroupForChartAudience("plus")).toBe("adult");
    expect(dropShoulderSleeveEaseGroupForChartAudience("men")).toBe("adult");
  });
});

describe("getDefaultSleeveEase", () => {
  it("returns adult ease for all three fit levels", () => {
    expect(getDefaultSleeveEase({ sizeGroup: "adult", fit: "close" })).toEqual({
      upperArmInches: 1.0,
      wristInches: 0.5,
    });
    expect(getDefaultSleeveEase({ sizeGroup: "adult", fit: "standard" })).toEqual({
      upperArmInches: 2.0,
      wristInches: 0.75,
    });
    expect(getDefaultSleeveEase({ sizeGroup: "adult", fit: "relaxed" })).toEqual({
      upperArmInches: 3.0,
      wristInches: 1.0,
    });
  });

  it("returns baby ease for all three fit levels", () => {
    expect(getDefaultSleeveEase({ sizeGroup: "baby", fit: "close" })).toEqual({
      upperArmInches: 0.5,
      wristInches: 0.25,
    });
    expect(getDefaultSleeveEase({ sizeGroup: "baby", fit: "standard" })).toEqual({
      upperArmInches: 0.75,
      wristInches: 0.375,
    });
    expect(getDefaultSleeveEase({ sizeGroup: "baby", fit: "relaxed" })).toEqual({
      upperArmInches: 1.0,
      wristInches: 0.5,
    });
  });

  it("returns child ease for all three fit levels", () => {
    expect(getDefaultSleeveEase({ sizeGroup: "child", fit: "close" })).toEqual({
      upperArmInches: 0.75,
      wristInches: 0.375,
    });
    expect(getDefaultSleeveEase({ sizeGroup: "child", fit: "standard" })).toEqual({
      upperArmInches: 1.25,
      wristInches: 0.5,
    });
    expect(getDefaultSleeveEase({ sizeGroup: "child", fit: "relaxed" })).toEqual({
      upperArmInches: 1.75,
      wristInches: 0.75,
    });
  });
});

describe("Adult finished sleeve defaults", () => {
  it("Close fit — upper arm = body + 1.0, wrist = body + 0.5", () => {
    expect(defaultsFor(MISSES_7, "misses", "close").upperArm).toBe("13");
    expect(defaultsFor(MISSES_7, "misses", "close").wrist).toBe("6.5");
    expect(
      resolveDropShoulderFinishedUpperArmInches({
        chartAudience: "misses",
        fit: "close",
        bodyUpperArmIn: 12,
      }),
    ).toBe(13);
    expect(
      resolveDropShoulderFinishedWristInches({
        chartAudience: "misses",
        fit: "close",
        bodyWristIn: 6,
      }),
    ).toBe(6.5);
  });

  it("Standard fit — upper arm = body + 2.0, wrist = body + 0.75", () => {
    expect(defaultsFor(MISSES_7, "misses", "standard").upperArm).toBe("14");
    expect(defaultsFor(MISSES_7, "misses", "standard").wrist).toBe("6.75");
  });

  it("Relaxed fit — upper arm = body + 3.0, wrist = body + 1.0", () => {
    expect(defaultsFor(MISSES_7, "misses", "relaxed").upperArm).toBe("15");
    expect(defaultsFor(MISSES_7, "misses", "relaxed").wrist).toBe("7");
    expect(normalizeSleeveEaseFit("oversized")).toBe("relaxed");
  });

  it("uses the same adult ease for men and misses", () => {
    expect(resolveDropShoulderUpperArmEaseInches({ chartAudience: "men", fit: "standard" })).toBe(2);
    expect(resolveDropShoulderWristEaseInches({ chartAudience: "misses", fit: "standard" })).toBe(
      0.75,
    );
    expect(defaultsFor(MENS_MED, "men", "standard").upperArm).toBe("15");
    expect(defaultsFor(MENS_MED, "men", "standard").wrist).toBe("7.25");
  });
});

describe("Baby finished sleeve defaults", () => {
  it("applies baby ease for Close, Standard, and Relaxed", () => {
    expect(defaultsFor(BABY_3MO, "baby", "close").upperArm).toBe("6");
    expect(defaultsFor(BABY_3MO, "baby", "close").wrist).toBe("3.75");
    expect(defaultsFor(BABY_3MO, "baby", "standard").upperArm).toBe("6.25");
    expect(defaultsFor(BABY_3MO, "baby", "standard").wrist).toBe("4");
    expect(defaultsFor(BABY_3MO, "baby", "relaxed").upperArm).toBe("6.5");
    expect(defaultsFor(BABY_3MO, "baby", "relaxed").wrist).toBe("4");
  });
});

describe("Child finished sleeve defaults", () => {
  it("applies child ease for Close, Standard, and Relaxed", () => {
    expect(defaultsFor(KIDS_2YR, "kids", "close").upperArm).toBe("6.75");
    expect(defaultsFor(KIDS_2YR, "kids", "close").wrist).toBe("5");
    expect(defaultsFor(KIDS_2YR, "kids", "standard").upperArm).toBe("7.25");
    expect(defaultsFor(KIDS_2YR, "kids", "standard").wrist).toBe("5");
    expect(defaultsFor(KIDS_2YR, "kids", "relaxed").upperArm).toBe("7.75");
    expect(defaultsFor(KIDS_2YR, "kids", "relaxed").wrist).toBe("5.25");
  });
});

describe("Switching fit updates untouched sleeve defaults", () => {
  it("refreshes upper arm and wrist when neither field is user-edited", () => {
    const close = resolveDropShoulderSleeveOverrideStrings({
      overrides: { upperArm: "13", wrist: "6.5" },
      chartRow: MISSES_7,
      fitPreference: "close",
      chartAudience: "misses",
      userEdited: NONE_EDITED,
    });
    const standard = resolveDropShoulderSleeveOverrideStrings({
      overrides: { upperArm: "13", wrist: "6.5" },
      chartRow: MISSES_7,
      fitPreference: "standard",
      chartAudience: "misses",
      userEdited: NONE_EDITED,
    });

    expect(close.upperArm).toBe("13");
    expect(close.wrist).toBe("6.5");
    expect(standard.upperArm).toBe("14");
    expect(standard.wrist).toBe("6.75");
  });
});

describe("User-customized sleeve values are preserved when fit changes", () => {
  it("keeps a manual upper arm across fit changes", () => {
    for (const fit of ["close", "standard", "relaxed"]) {
      const resolved = resolveDropShoulderSleeveOverrideStrings({
        overrides: { upperArm: "15", wrist: "6.75" },
        chartRow: MISSES_7,
        fitPreference: fit,
        chartAudience: "misses",
        userEdited: UPPER_ARM_EDITED,
      });
      expect(resolved.upperArm).toBe("15");
    }
  });

  it("keeps a manual wrist across fit changes", () => {
    for (const fit of ["close", "standard", "relaxed"]) {
      const resolved = resolveDropShoulderSleeveOverrideStrings({
        overrides: { upperArm: "14", wrist: "7.5" },
        chartRow: MISSES_7,
        fitPreference: fit,
        chartAudience: "misses",
        userEdited: WRIST_EDITED,
      });
      expect(resolved.wrist).toBe("7.5");
    }
  });
});

describe("Existing saved pattern values are not eased twice", () => {
  it("uses a stored override directly when the user-edited flag is set", () => {
    const resolved = resolveDropShoulderSleeveOverrideStrings({
      overrides: { upperArm: "21.25", wrist: "8" },
      chartRow: MISSES_7,
      fitPreference: "standard",
      chartAudience: "misses",
      userEdited: { upperArm: true, sleeveLength: false, cuffCircumference: true },
    });
    expect(resolved.upperArm).toBe("21.25");
    expect(resolved.wrist).toBe("8");
  });

  it("recomputes system defaults from body + ease, not from stored override + ease", () => {
    const resolved = resolveDropShoulderSleeveOverrideStrings({
      overrides: { upperArm: "21.25", wrist: "8" },
      chartRow: MISSES_7,
      fitPreference: "standard",
      chartAudience: "misses",
      userEdited: NONE_EDITED,
    });
    expect(resolved.upperArm).toBe("14");
    expect(resolved.wrist).toBe("6.75");
  });
});

describe("Stitch counts use eased finished circumferences", () => {
  it("sleeve-top stitches use finished upper arm (body 12 + standard 2.0 = 14 ? 70 sts at 5 spi)", () => {
    const upperArmIn = resolveDropShoulderSleeveInches({
      overrides: {},
      chartRow: MISSES_7,
      fitPreference: "standard",
      chartAudience: "misses",
      userEdited: NONE_EDITED,
    }).upperArmIn;
    expect(upperArmIn).toBe(14);

    const patternData = {
      fit: {
        sizingChart: "misses",
        selectedSize: 7,
        easeChoice: "standard",
        selectedMeasurements: {
          ...computeDefaultMeasurementsFromChartRow(MISSES_7, "standard", { bodyShape: "straight" }),
          upper_arm: upperArmIn,
        },
      },
      style: {
        construction: "drop-shoulder",
        constructionAuthored: "drop-shoulder",
        recipientCategory: "misses",
        neckline: "round",
        bodyShape: "straight",
        frontStyle: "closed",
        garmentStyle: "pullover",
      },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
    };

    const result = generateDropShoulderPattern(patternData);
    expect(result.debug.dropShoulderUpperArmInches).toBe(14);
    expect(result.debug.dropShoulderSleeveTopStitches).toBe(70);
    expect(result.debug.armholeDepth).toBe(computeDropShoulderArmholeDepthInches(14));
  });
});

describe("Straight and reverse-taper sleeves remain valid with eased defaults", () => {
  it("straight sleeve works when eased upper arm and wrist resolve to equal stitch counts", () => {
    const resolved = resolveDropShoulderSleeveInches({
      overrides: { upperArm: "14", wrist: "14" },
      chartRow: MISSES_7,
      fitPreference: "standard",
      chartAudience: "misses",
      userEdited: { upperArm: true, sleeveLength: false, cuffCircumference: true },
    });
    expect(resolved.upperArmIn).toBe(14);
    expect(resolved.wristIn).toBe(14);
  });

  it("reverse taper remains valid when wrist exceeds upper arm", () => {
    const resolved = resolveDropShoulderSleeveInches({
      overrides: { upperArm: "12", wrist: "14" },
      chartRow: MISSES_7,
      fitPreference: "standard",
      chartAudience: "misses",
      userEdited: { upperArm: true, sleeveLength: false, cuffCircumference: true },
    });
    expect(resolved.upperArmIn).toBe(12);
    expect(resolved.wristIn).toBe(14);
    expect(resolved.wristIn).toBeGreaterThan(resolved.upperArmIn!);
  });
});

describe("Sleeveless / no-audience behavior is unchanged", () => {
  it("computeDefaultMeasurementsFromChartRow still returns raw body measurements", () => {
    expect(computeDefaultMeasurementsFromChartRow(MISSES_7, "standard").upper_arm).toBe(12);
    expect(computeDefaultMeasurementsFromChartRow(MISSES_7, "standard").wrist).toBe(6);
  });

  it("dropShoulderSleeveDefaultsFromChartRow without an audience keeps body values", () => {
    expect(dropShoulderSleeveDefaultsFromChartRow(MISSES_7, "standard").upperArm).toBe("12");
    expect(dropShoulderSleeveDefaultsFromChartRow(MISSES_7, "standard").wrist).toBe("6");
  });
});

describe("Size-change reconcile", () => {
  it("refreshes system-default upper arm and wrist to eased values", () => {
    const next = reconcileDropShoulderSleeveOverridesForSizeChange(
      { upperArm: "9.75", wrist: "5.25", sleeveLength: "16.25" },
      MISSES_7,
      "standard",
      NONE_EDITED,
      { chartAudience: "misses" },
    );
    expect(next.upperArm).toBe("14");
    expect(next.wrist).toBe("6.75");
  });

  it("preserves user-edited upper arm and wrist", () => {
    const nextUpper = reconcileDropShoulderSleeveOverridesForSizeChange(
      { upperArm: "15", wrist: "6.75", sleeveLength: "17" },
      MISSES_7,
      "standard",
      UPPER_ARM_EDITED,
      { chartAudience: "misses" },
    );
    expect(nextUpper.upperArm).toBe("15");

    const nextWrist = reconcileDropShoulderSleeveOverridesForSizeChange(
      { upperArm: "14", wrist: "7.5", sleeveLength: "17" },
      MISSES_7,
      "standard",
      WRIST_EDITED,
      { chartAudience: "misses" },
    );
    expect(nextWrist.wrist).toBe("7.5");
  });
});
