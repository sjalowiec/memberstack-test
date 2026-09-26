import { describe, expect, it } from "vitest";
import {
  BABY_KIDS_LENGTH_CHART_CORRECTED_AT,
  BABY_KIDS_LENGTH_MATCH_RULES,
} from "./babyKidsLengthErrata";
import { classifySavedPatternForErrata } from "./classifySavedPatternErrata";
import type { PatternErrataRecord } from "./types";

const errata = {
  affectedBuilders: ["drop-shoulder", "sleeveless"],
  matchRules: BABY_KIDS_LENGTH_MATCH_RULES,
} satisfies Pick<PatternErrataRecord, "affectedBuilders" | "matchRules">;

const BEFORE = "2026-03-01T12:00:00.000Z";
const AFTER = "2026-09-26T18:00:00.000Z";

function savedProject(options: {
  builder?: "drop-shoulder" | "sleeveless" | "hat" | "sideways" | "unmarked-drop";
  audience?: string;
  sizingChart?: string;
  size?: string;
  chartLength?: number | null;
  chartUpperArm?: number | null;
  override?: string;
  upperArmOverride?: string;
  patternMode?: string;
  createdAt?: string | null;
  patternType?: string;
}) {
  const builder = options.builder ?? "drop-shoulder";
  const style: Record<string, unknown> = {
    recipientCategory: options.audience ?? "baby",
  };
  if (options.patternMode) style.patternMode = options.patternMode;
  if (builder === "drop-shoulder") {
    style.construction = "drop-shoulder";
    style.constructionAuthored = "drop-shoulder";
  }
  if (builder === "unmarked-drop") {
    style.construction = "drop-shoulder";
  }
  if (builder === "sideways") {
    style.construction = "sideways-cardigan";
    style.constructionAuthored = "sideways-cardigan";
  }
  const selected: Record<string, unknown> =
    options.chartLength === null ? {} : { back_neck_to_hem: options.chartLength ?? 6 };
  if (options.chartUpperArm != null) selected.upper_arm = options.chartUpperArm;
  const overrides: Record<string, string> = {};
  if (options.override !== undefined) overrides.finishedLength = options.override;
  if (options.upperArmOverride !== undefined) overrides.upperArm = options.upperArmOverride;
  return {
    id: "project-1",
    name: "Saved sweater",
    createdAt: options.createdAt === null ? undefined : (options.createdAt ?? BEFORE),
    customOverrides: {},
    pattern: {
      patternType: options.patternType ?? (builder === "hat" ? "hat" : "sleeveless"),
      style,
      fit: {
        sizingChart: options.sizingChart ?? options.audience ?? "baby",
        selectedSize: options.size ?? "3 mo",
        selectedMeasurements: selected,
        ...(Object.keys(overrides).length > 0 ? { cbMeasurementOverrides: overrides } : {}),
      },
    },
  };
}

describe("classifySavedPatternForErrata", () => {
  it("marks a baby size that still has the old finished length as an old default", () => {
    const project = savedProject({ chartLength: 6 });
    expect(classifySavedPatternForErrata(project, errata)).toMatchObject({
      classification: "old_default",
      builder: "drop-shoulder",
      audience: "baby",
      size: "3 mo",
      lengthInches: 6,
    });
    expect(project.pattern.fit.selectedMeasurements.back_neck_to_hem).toBe(6);
  });

  it("marks a sleeveless kids pattern on the old default the same way", () => {
    expect(
      classifySavedPatternForErrata(
        savedProject({ builder: "sleeveless", audience: "kids", size: "2 yr", chartLength: 18 }),
        errata,
      ).classification,
    ).toBe("old_default");
  });

  it("marks a different saved length as customized, including a length chosen before the chart change", () => {
    expect(classifySavedPatternForErrata(savedProject({ chartLength: 7.25 }), errata).classification).toBe(
      "customized",
    );
    expect(
      classifySavedPatternForErrata(savedProject({ chartLength: 8.75, createdAt: BEFORE }), errata)
        .classification,
    ).toBe("customized");
  });

  it("does not call a pattern saved after the correction an old default when it already has the new length", () => {
    expect(
      classifySavedPatternForErrata(savedProject({ chartLength: 8.75, createdAt: AFTER }), errata)
        .classification,
    ).toBe("current_default");
    expect(BABY_KIDS_LENGTH_CHART_CORRECTED_AT < AFTER).toBe(true);
  });

  it("leaves a corrected length with no creation date uncertain", () => {
    expect(
      classifySavedPatternForErrata(savedProject({ chartLength: 8.75, createdAt: null }), errata)
        .classification,
    ).toBe("uncertain");
  });

  it("keeps other charts, builders, and unmarked construction out of the affected count", () => {
    expect(
      classifySavedPatternForErrata(
        savedProject({ audience: "misses", size: "40", chartLength: 6 }),
        errata,
      ).classification,
    ).toBe("out_of_scope");
    expect(classifySavedPatternForErrata(savedProject({ builder: "hat" }), errata).classification).toBe(
      "out_of_scope",
    );
    expect(
      classifySavedPatternForErrata(savedProject({ builder: "sideways" }), errata).classification,
    ).toBe("out_of_scope");
    expect(
      classifySavedPatternForErrata(savedProject({ builder: "unmarked-drop" }), errata).classification,
    ).toBe("uncertain");
  });

  it("does not guess when the chart and recipient disagree, the length is missing, or the size is unknown", () => {
    expect(
      classifySavedPatternForErrata(
        savedProject({ audience: "baby", sizingChart: "kids", size: "3 mo" }),
        errata,
      ).classification,
    ).toBe("uncertain");
    expect(
      classifySavedPatternForErrata(savedProject({ chartLength: null }), errata).classification,
    ).toBe("uncertain");
    expect(
      classifySavedPatternForErrata(savedProject({ size: "newborn" }), errata).classification,
    ).toBe("uncertain");
  });

  it("treats a conflicting express override as uncertain and a custom-build override as the saved length", () => {
    expect(
      classifySavedPatternForErrata(
        savedProject({ chartLength: 6, override: "9", patternMode: "express" }),
        errata,
      ).classification,
    ).toBe("uncertain");
    expect(
      classifySavedPatternForErrata(
        savedProject({ chartLength: 6, override: "9", patternMode: "custom-build" }),
        errata,
      ).classification,
    ).toBe("customized");
    expect(
      classifySavedPatternForErrata(
        savedProject({ chartLength: 8.75, override: "6", patternMode: "custom-build" }),
        errata,
      ).classification,
    ).toBe("old_default");
  });

  it("does not treat a centimeter-sized number as the inch default", () => {
    expect(
      classifySavedPatternForErrata(savedProject({ chartLength: 15.24 }), errata).classification,
    ).toBe("uncertain");
  });

  it("marks Kids 2 yr affected when only the finished length still matches the old default", () => {
    const result = classifySavedPatternForErrata(
      savedProject({
        audience: "kids",
        size: "2 yr",
        chartLength: 18,
        chartUpperArm: 8,
      }),
      errata,
    );
    expect(result.classification).toBe("old_default");
    expect(result.matchedMeasurements).toEqual(["finished-length"]);
    expect(result.reason).toContain("finished length");
    expect(result.reason).not.toContain("upper arm still");
  });

  it("marks Kids 2 yr affected when only the upper arm still matches the old default", () => {
    const result = classifySavedPatternForErrata(
      savedProject({
        audience: "kids",
        size: "2 yr",
        chartLength: 13,
        chartUpperArm: 8,
        upperArmOverride: "6",
      }),
      errata,
    );
    expect(result.classification).toBe("old_default");
    expect(result.matchedMeasurements).toEqual(["upper-arm"]);
    expect(result.upperArmInches).toBe(6);
    expect(result.reason).toContain("upper arm");
    expect(result.reason).not.toContain("finished length");
  });

  it("marks Kids 2 yr affected and names both measurements when both still match", () => {
    const result = classifySavedPatternForErrata(
      savedProject({
        audience: "kids",
        size: "2 yr",
        chartLength: 18,
        chartUpperArm: 6,
      }),
      errata,
    );
    expect(result.classification).toBe("old_default");
    expect(result.matchedMeasurements).toEqual(["finished-length", "upper-arm"]);
    expect(result.reason).toContain("finished length");
    expect(result.reason).toContain("upper arm");
  });

  it("marks Kids 2 yr customized only when both measurements differ from the old defaults", () => {
    const result = classifySavedPatternForErrata(
      savedProject({
        audience: "kids",
        size: "2 yr",
        chartLength: 13,
        chartUpperArm: 8,
      }),
      errata,
    );
    expect(result.classification).toBe("customized");
    expect(result.matchedMeasurements).toEqual([]);
  });

  it("keeps Kids 2 yr uncertain when a measurement is missing or ambiguous and neither is an old default", () => {
    expect(
      classifySavedPatternForErrata(
        savedProject({ audience: "kids", size: "2 yr", chartLength: null, chartUpperArm: 8 }),
        errata,
      ).classification,
    ).toBe("uncertain");
    expect(
      classifySavedPatternForErrata(
        savedProject({
          audience: "kids",
          size: "2 yr",
          chartLength: 13,
          override: "18",
          patternMode: "express",
          chartUpperArm: 8,
        }),
        errata,
      ).classification,
    ).toBe("uncertain");
    const armStillOld = classifySavedPatternForErrata(
      savedProject({
        audience: "kids",
        size: "2 yr",
        chartLength: null,
        chartUpperArm: 6,
      }),
      errata,
    );
    expect(armStillOld.classification).toBe("old_default");
    expect(armStillOld.matchedMeasurements).toEqual(["upper-arm"]);
  });
});
