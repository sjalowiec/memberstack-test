import { beforeEach, describe, expect, it } from "vitest";
import {
  normalizePatternRecordNeckWidth,
  normalizeSelectedMeasurementsNeckWidth,
  resolveEffectiveNeckOpeningWidthInches,
} from "./customBuildEffectiveNeckOpeningWidth";
import {
  buildSavePayloadFromWorkingDraft,
  loadProjectIntoWorkingDraft,
} from "./customPatternProjectClient";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  CONSTRUCTION_AUTHORED_KEY,
  CONSTRUCTION_FAMILY_OVERRIDE_KEY,
  DROP_SHOULDER_CONSTRUCTION,
} from "./patternConstructionIdentity";
import { getCurrentPattern, type SleevelessPatternRecord } from "./patternStorage";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import { stubLocalStorage } from "./test/stubLocalStorage";

const LEGACY_NECK_KEYS = ["neck_opening", "neckOpening", "neck_opening_width"] as const;

function baseSelectedMeasurements(
  neckFields: Record<string, unknown>,
): Record<string, unknown> {
  return {
    finished_bust_chest: 40,
    back_neck_to_hem: 22,
    armhole_depth: 8,
    shoulder_width: 12,
    ...neckFields,
  };
}

function projectWithNeckFields(
  neckFields: Record<string, unknown>,
  options: {
    patternMode?: string;
    finishedNeckOpeningWidth?: string;
    dropShoulder?: boolean;
  } = {},
): CustomPatternProject {
  const patternMode = options.patternMode ?? "express";
  const fit: Record<string, unknown> = {
    selectedSize: "M",
    easeChoice: "standard",
    sizingChart: "misses",
    selectedMeasurements: baseSelectedMeasurements(neckFields),
  };
  if (options.finishedNeckOpeningWidth !== undefined) {
    fit.cbMeasurementOverrides = {
      finishedNeckOpeningWidth: options.finishedNeckOpeningWidth,
    };
  }
  const style: Record<string, unknown> = {
    patternMode,
    recipientCategory: "misses",
    bodyShape: "straight",
    frontStyle: "closed",
    garmentStyle: "pullover",
    neckline: "round",
  };
  const customOverrides: Record<string, unknown> = {};
  if (options.dropShoulder) {
    style.construction = DROP_SHOULDER_CONSTRUCTION;
    style[CONSTRUCTION_AUTHORED_KEY] = DROP_SHOULDER_CONSTRUCTION;
    customOverrides[CONSTRUCTION_FAMILY_OVERRIDE_KEY] = DROP_SHOULDER_CONSTRUCTION;
  }
  return {
    id: "proj-neck-norm",
    name: "Neck normalize test",
    family: "sleeveless",
    source: patternMode === "custom-build" ? "custom-build" : "express",
    notes: "",
    customOverrides,
    createdAt: "t1",
    updatedAt: "t2",
    version: 1,
    pattern: {
      id: "pattern-neck-norm",
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "t1",
      updatedAt: "t1",
      style,
      fit,
      yarnGauge: { gaugeStitchRaw: "20", gaugeRowRaw: "26" },
      measurements: {},
      machine: {},
      calculations: {},
      instructions: {},
      patternProject: {
        title: "Neck normalize test",
        notes: "",
        titleCustomized: true,
      },
    },
  };
}

function selectedMeasurementsFromDraft(): Record<string, unknown> {
  const fit = getCurrentPattern().fit as Record<string, unknown>;
  return (fit.selectedMeasurements ?? {}) as Record<string, unknown>;
}

describe("normalizeSelectedMeasurementsNeckWidth", () => {
  it("copies neck_opening_width into neck_width when canonical is missing", () => {
    const sm = normalizeSelectedMeasurementsNeckWidth(
      baseSelectedMeasurements({ neck_opening_width: 7 }),
    );
    expect(sm.neck_width).toBe(7);
    expect(sm.neck_opening_width).toBe(7);
  });

  it("copies neck_opening into neck_width when canonical is missing", () => {
    const sm = normalizeSelectedMeasurementsNeckWidth(
      baseSelectedMeasurements({ neck_opening: 6.5 }),
    );
    expect(sm.neck_width).toBe(6.5);
    expect(sm.neck_opening).toBe(6.5);
  });

  it("copies neckOpening into neck_width when canonical is missing", () => {
    const sm = normalizeSelectedMeasurementsNeckWidth(
      baseSelectedMeasurements({ neckOpening: 5.75 }),
    );
    expect(sm.neck_width).toBe(5.75);
    expect(sm.neckOpening).toBe(5.75);
  });

  it("prefers neck_opening over later aliases", () => {
    const sm = normalizeSelectedMeasurementsNeckWidth(
      baseSelectedMeasurements({
        neck_opening: 6,
        neckOpening: 8,
        neck_opening_width: 9,
      }),
    );
    expect(sm.neck_width).toBe(6);
  });

  it("never overwrites an existing valid neck_width", () => {
    const sm = normalizeSelectedMeasurementsNeckWidth(
      baseSelectedMeasurements({
        neck_width: 7,
        neck_opening: 99,
        neckOpening: 98,
        neck_opening_width: 97,
      }),
    );
    expect(sm.neck_width).toBe(7);
  });

  it("leaves measurements unchanged when no neck inches are present", () => {
    const input = baseSelectedMeasurements({});
    expect(normalizeSelectedMeasurementsNeckWidth(input)).toBe(input);
  });
});

describe("loadProjectIntoWorkingDraft neck_width normalization", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("hydrates neck_width from neck_opening_width only (sleeveless)", () => {
    loadProjectIntoWorkingDraft(projectWithNeckFields({ neck_opening_width: 7 }));
    const sm = selectedMeasurementsFromDraft();
    expect(sm.neck_width).toBe(7);
    expect(sm.neck_opening_width).toBe(7);
  });

  it("hydrates neck_width from neck_opening only", () => {
    loadProjectIntoWorkingDraft(projectWithNeckFields({ neck_opening: 6.5 }));
    const sm = selectedMeasurementsFromDraft();
    expect(sm.neck_width).toBe(6.5);
    expect(sm.neck_opening).toBe(6.5);
  });

  it("hydrates neck_width from neckOpening only", () => {
    loadProjectIntoWorkingDraft(projectWithNeckFields({ neckOpening: 5.75 }));
    const sm = selectedMeasurementsFromDraft();
    expect(sm.neck_width).toBe(5.75);
    expect(sm.neckOpening).toBe(5.75);
  });

  it("never overwrites an existing valid neck_width", () => {
    loadProjectIntoWorkingDraft(
      projectWithNeckFields({
        neck_width: 7,
        neck_opening: 99,
        neck_opening_width: 98,
      }),
    );
    expect(selectedMeasurementsFromDraft().neck_width).toBe(7);
  });

  it("keeps finishedNeckOpeningWidth separate from chart neck_width", () => {
    loadProjectIntoWorkingDraft(
      projectWithNeckFields(
        { neck_opening_width: 6 },
        { patternMode: "custom-build", finishedNeckOpeningWidth: "8" },
      ),
    );
    const draft = getCurrentPattern();
    const sm = selectedMeasurementsFromDraft();
    const overrides = (draft.fit as Record<string, unknown>).cbMeasurementOverrides as Record<
      string,
      string
    >;
    expect(sm.neck_width).toBe(6);
    expect(overrides.finishedNeckOpeningWidth).toBe("8");
    expect(
      resolveEffectiveNeckOpeningWidthInches({
        style: draft.style,
        fit: draft.fit,
      }),
    ).toBe(8);
  });

  it("also normalizes Drop Shoulder projects on the shared load path", () => {
    loadProjectIntoWorkingDraft(
      projectWithNeckFields({ neck_opening_width: 7.25 }, { dropShoulder: true }),
    );
    const sm = selectedMeasurementsFromDraft();
    expect(sm.neck_width).toBe(7.25);
    expect(sm.neck_opening_width).toBe(7.25);
  });
});

describe("new projects do not invent legacy neck aliases", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("computeDefaultMeasurementsFromChartRow writes neck_width only", () => {
    const sm = computeDefaultMeasurementsFromChartRow(
      {
        size: "M",
        bust_or_chest: 38,
        waist: 30,
        hip: 40,
        garment_back_length: 24,
        armhole_depth: 8,
        shoulder_width: 12,
        neck_opening: 6.5,
        front_neck_depth: 3,
        back_neck_depth: 1,
        upper_arm: 12,
        wrist: 6,
        sleeve_length: 18,
      },
      "standard",
    );
    expect(sm.neck_width).toBe(6.5);
    for (const key of LEGACY_NECK_KEYS) {
      expect(sm).not.toHaveProperty(key);
    }
  });

  it("save payload from a chart-synced draft does not gain legacy neck aliases", () => {
    const chartSm = computeDefaultMeasurementsFromChartRow(
      {
        size: "M",
        bust_or_chest: 38,
        waist: 30,
        hip: 40,
        garment_back_length: 24,
        armhole_depth: 8,
        shoulder_width: 12,
        neck_opening: 6.5,
        front_neck_depth: 3,
        back_neck_depth: 1,
        upper_arm: 12,
        wrist: 6,
        sleeve_length: 18,
      },
      "standard",
    );
    loadProjectIntoWorkingDraft(
      projectWithNeckFields({ neck_width: chartSm.neck_width }),
    );
    const payload = buildSavePayloadFromWorkingDraft("Neck normalize test", {
      skipFlushMeasurementOverrides: true,
    });
    const sm = (payload.pattern.fit as Record<string, unknown>).selectedMeasurements as Record<
      string,
      unknown
    >;
    expect(sm.neck_width).toBe(6.5);
    for (const key of LEGACY_NECK_KEYS) {
      expect(sm).not.toHaveProperty(key);
    }
  });
});

describe("normalizePatternRecordNeckWidth", () => {
  it("returns the same pattern reference when neck_width already valid", () => {
    const pattern: SleevelessPatternRecord = {
      id: "p1",
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "t1",
      updatedAt: "t1",
      style: {},
      fit: {
        selectedMeasurements: baseSelectedMeasurements({ neck_width: 7, neck_opening: 9 }),
      },
      yarnGauge: {},
      measurements: {},
      machine: {},
      calculations: {},
      instructions: {},
    };
    expect(normalizePatternRecordNeckWidth(pattern)).toBe(pattern);
  });
});
