import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { getCurrentPattern, getPatternData, saveCurrentPattern, savePatternData } from "./patternStorage";
import { syncSidewaysCardiganBuilderToPatternStorage } from "./syncSidewaysCardiganBuilderToPatternStorage";
import { readSidewaysCardiganBuilderStateFromDraft } from "./sidewaysCardiganBuilderState";
import { loadSidewaysCardiganWorkspaceView } from "./sidewaysCardiganWorkspaceLoad";
import { applySidewaysCardiganSummaryMeasurementEdits } from "./sidewaysCardiganSummaryEdit";
import { resolveSidewaysCardiganBodyCalcInputFromPattern } from "./sidewaysCardiganFinishedMeasurements";
import {
  SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_CHOICES,
  SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_LABELS,
} from "./sidewaysCardiganConstructionIdentity";
import { DROP_SHOULDER_SLEEVE_LENGTH_CHOICES } from "./patternConstructionIdentity";
import { SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS } from "./sidewaysCardiganSizeCharts";
import type { SidewaysCardiganWomenChartRow } from "./sidewaysCardiganSizeCharts";
import type { SidewaysCardiganBuilderValues } from "./syncSidewaysCardiganBuilderToPatternStorage";

const builderAstro = readFileSync(
  resolve("src/pages/patterns/sideways-cardigan/builder.astro"),
  "utf8",
);
const builderScript = readFileSync(
  resolve("src/scripts/sideways-cardigan-builder-page.ts"),
  "utf8",
);
const dropShoulderBuilder = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/builder.astro"),
  "utf8",
);
const sleevelessBuilder = readFileSync(
  resolve("src/pages/patterns/sleeveless/builder.astro"),
  "utf8",
);
const dropShoulderPageScript = readFileSync(
  resolve("src/scripts/drop-shoulder-builder-page.ts"),
  "utf8",
);
const sleevelessExpress = readFileSync(
  resolve("src/scripts/sleeveless-express-page.ts"),
  "utf8",
);

const missesRow: SidewaysCardiganWomenChartRow = {
  size: 8,
  bust_or_chest: 42,
  garment_back_length: 25,
  neck_opening: 7.5,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 12.5,
  wrist: 6.5,
  sleeve_length: 17,
  chartAudience: "misses",
};

const baseValues: SidewaysCardiganBuilderValues = {
  selectedSize: "8",
  chartAudience: "misses",
  fit: "standard",
  styleMeasurements: {
    finishedLength: "25",
    vNeckDepth: "8",
    neckOpeningWidth: "7.5",
    finishedUpperArm: "14.5",
    sleeveLength: "17",
    wrist: "7.25",
  },
  gaugeStitchRaw: "20",
  gaugeRowRaw: "28",
  availableNeedles: "200",
  unit: "in",
  sleeveDirection: "cuff-up",
  sleeveLengthChoice: "long",
  garmentStyle: "pullover",
};

function mergedDraft(): Record<string, unknown> {
  const canonical = getCurrentPattern() as unknown as Record<string, unknown>;
  const pb = getPatternData();
  return {
    ...canonical,
    ...pb,
    style: { ...(canonical.style as object), ...(pb.style as object) },
    fit: { ...(canonical.fit as object), ...(pb.fit as object) },
    yarnGauge: { ...(canonical.yarnGauge as object), ...(pb.yarnGauge as object) },
    yarnGaugeMachine: pb.yarnGaugeMachine,
  };
}

describe("Sideways V-Neck six-step builder", () => {
  it("has exactly six steps and no separate sizing-chart or style-measurements step", () => {
    expect(builderScript).toMatch(/const STEPS = 6/);
    expect(builderAstro).toContain('data-express-step="1"');
    expect(builderAstro).toContain('data-express-step="6"');
    expect(builderAstro).not.toContain('data-express-step="7"');
    expect(builderAstro).not.toContain('data-express-step="8"');
    expect(builderAstro).not.toContain("Choose a sizing chart");
    expect(builderAstro).not.toContain('data-express-field="chartAudience"');
    expect(builderAstro).not.toContain("Style measurements");
    expect(builderAstro).not.toContain('data-express-field="measurements"');
    expect(builderAstro).toContain('data-express-field="selectedSize"');
    expect(builderAstro).toContain("data-sideways-size-group");
    expect(builderAstro).toContain("SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS");
  });

  it("shows Misses and Women's sizes together and keeps plus as the internal key", () => {
    expect(SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS.map((g) => g.audience)).toEqual(["misses", "plus"]);
    expect(SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS.map((g) => g.heading)).toEqual(["Misses", "Women's"]);
    expect(builderAstro).toContain("Misses");
    expect(builderAstro).toContain("Women's");
    expect(builderAstro).not.toMatch(/>Plus</);
    expect(builderScript).toContain('data-chart-audience');
    expect(builderScript).toContain('"plus"');
  });

  it("reuses the Drop Shoulder sleeve-length choices in the combined Sleeve step", () => {
    expect(SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_CHOICES).toEqual(DROP_SHOULDER_SLEEVE_LENGTH_CHOICES);
    expect(SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_LABELS).toEqual({
      long: "Long",
      "three-quarter": "3/4",
      elbow: "Elbow",
      short: "Short",
    });
    expect(builderAstro).toContain('data-field="sleeveDirection"');
    expect(builderAstro).toContain('data-field="sleeveLength"');
    expect(builderAstro).toContain('value: "long"');
    expect(builderAstro).toContain('value: "three-quarter"');
    expect(builderAstro).toContain('value: "elbow"');
    expect(builderAstro).toContain('value: "short"');
    expect(builderScript).toContain('["Garment style"');
    expect(builderScript).toContain('["Starting size"');
    expect(builderScript).toContain('["Fit"');
    expect(builderScript).toContain('["Finished bust"');
    expect(builderScript).toContain('["Sleeve direction"');
    expect(builderScript).toContain('["Sleeve length"');
    expect(builderScript).toContain('["Gauge"');
    expect(builderScript).toContain('["Machine"');
  });
});

describe("Sideways V-Neck sleeve direction and length persistence", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("saves and restores sleeve direction and sleeve length together", () => {
    syncSidewaysCardiganBuilderToPatternStorage(
      { ...baseValues, sleeveDirection: "top-down", sleeveLengthChoice: "elbow" },
      missesRow,
    );
    expect(getCurrentPattern().style.sleeveDirection).toBe("top-down");
    expect(getCurrentPattern().style.sleeveLength).toBe("elbow");
    expect(getPatternData().style?.sleeveLength).toBe("elbow");
    const restored = readSidewaysCardiganBuilderStateFromDraft();
    expect(restored.sleeveDirection).toBe("top-down");
    expect(restored.sleeveLengthChoice).toBe("elbow");
    expect(restored.garmentStyle).toBe("pullover");
  });

  it("loads eight-step drafts without a categorical sleeve length and keeps measurement overrides", () => {
    syncSidewaysCardiganBuilderToPatternStorage(
      {
        ...baseValues,
        styleMeasurements: {
          ...baseValues.styleMeasurements!,
          finishedLength: "23.5",
          vNeckDepth: "9",
        },
      },
      missesRow,
    );
    const style = { ...(getCurrentPattern().style as Record<string, unknown>) };
    delete style.sleeveLength;
    saveCurrentPattern({ style });
    const pbStyle = { ...(getPatternData().style as Record<string, unknown>) };
    delete pbStyle.sleeveLength;
    savePatternData("style", pbStyle);
    const restored = readSidewaysCardiganBuilderStateFromDraft();
    expect(restored.sleeveLengthChoice).toBe("long");
    expect(restored.styleMeasurements.finishedLength).toBe("23.5");
    expect(restored.styleMeasurements.vNeckDepth).toBe("9");
    expect(restored.garmentStyle).toBe("pullover");
    expect(restored.sleeveDirection).toBe("cuff-up");
  });
});

describe("Sideways V-Neck Summary/Edit measurements", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("recalculates body numbers after Save Changes and leaves Cardigan/Pullover intact", () => {
    syncSidewaysCardiganBuilderToPatternStorage(baseValues, missesRow);
    const before = loadSidewaysCardiganWorkspaceView();
    expect(before.ok).toBe(true);
    if (!before.ok) throw new Error(before.message);
    expect(before.input.garmentLengthInches).toBe(25);
    expect(before.instructions?.garmentStyle).toBe("pullover");

    const result = applySidewaysCardiganSummaryMeasurementEdits({
      finishedLength: "23",
      vNeckDepth: "7.5",
    });
    expect(result.ok).toBe(true);

    const after = loadSidewaysCardiganWorkspaceView();
    expect(after.ok).toBe(true);
    if (!after.ok) throw new Error(after.message);
    expect(after.input.garmentLengthInches).toBe(23);
    expect(after.input.vNeckDepthInches).toBe(7.5);
    expect(after.instructions?.garmentStyle).toBe("pullover");
    expect(getCurrentPattern().style.garmentStyle).toBe("pullover");
    expect(getCurrentPattern().style.sleeveDirection).toBe("cuff-up");
    expect(getCurrentPattern().style.sleeveLength).toBe("long");

    const restored = readSidewaysCardiganBuilderStateFromDraft();
    expect(restored.garmentStyle).toBe("pullover");
    expect(restored.sleeveDirection).toBe("cuff-up");
    expect(restored.styleMeasurements.finishedLength).toBe("23");
    expect(restored.styleMeasurements.vNeckDepth).toBe("7.5");

    const input = resolveSidewaysCardiganBodyCalcInputFromPattern(mergedDraft());
    expect(input?.garmentLengthInches).toBe(23);
    expect(input?.vNeckDepthInches).toBe(7.5);
  });
});

describe("Drop Shoulder and Sleeveless builders stay on their existing flows", () => {
  it("keeps five Drop Shoulder and Sleeveless steps and their Who+Size section", () => {
    expect(dropShoulderBuilder).toContain("ExpressBuilderWhoSizeSection");
    expect(sleevelessBuilder).toContain("ExpressBuilderWhoSizeSection");
    expect(dropShoulderBuilder).toContain('data-express-step="5"');
    expect(dropShoulderBuilder).not.toContain('data-express-step="6"');
    expect(sleevelessBuilder).toContain('data-express-step="5"');
    expect(sleevelessBuilder).not.toContain('data-express-step="6"');
    expect(dropShoulderBuilder).toContain('data-express-field="sleeveLength"');
    expect(sleevelessBuilder).not.toContain("sideways-cardigan");
    expect(dropShoulderBuilder).not.toContain("sideways-cardigan");
    expect(dropShoulderPageScript).toContain("drop-shoulder");
    expect(sleevelessExpress).toContain("const STEPS = 5");
    expect(sleevelessExpress).not.toContain("sideways-cardigan-builder");
  });
});
