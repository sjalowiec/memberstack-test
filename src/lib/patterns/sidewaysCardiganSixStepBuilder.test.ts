import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { getCurrentPattern, getPatternData, saveCurrentPattern, savePatternData } from "./patternStorage";
import { syncSidewaysCardiganBuilderToPatternStorage } from "./syncSidewaysCardiganBuilderToPatternStorage";
import {
    applySidewaysCardiganSleeveChoice,
    applySidewaysCardiganStartingChartSelection,
    emptySidewaysCardiganBuilderDraftState,
    isSidewaysCardiganSleeveStepComplete,
    readSidewaysCardiganBuilderStateFromDraft,
  writeSidewaysCardiganSizingIdentity,
} from "./sidewaysCardiganBuilderState";
import { loadSidewaysCardiganWorkspaceView } from "./sidewaysCardiganWorkspaceLoad";
import { applySidewaysCardiganSummaryMeasurementEdits } from "./sidewaysCardiganSummaryEdit";
import { resolveSidewaysCardiganBodyCalcInputFromPattern } from "./sidewaysCardiganFinishedMeasurements";
import {
  SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_CHOICES,
  SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_LABELS,
} from "./sidewaysCardiganConstructionIdentity";
import { DROP_SHOULDER_SLEEVE_LENGTH_CHOICES } from "./patternConstructionIdentity";
import { SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS } from "./sidewaysCardiganSizeCharts";
import {
  resetExpressSweaterChartsForTests,
  seedExpressSweaterChartsForTests,
} from "./sleevelessExpressSizeChartClient";
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

const plusRow: SidewaysCardiganWomenChartRow = {
  size: "X",
  bust_or_chest: 39,
  garment_back_length: 16.75,
  neck_opening: 7,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 13,
  wrist: 7,
  sleeve_length: 17,
  chartAudience: "plus",
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

const plusValues: SidewaysCardiganBuilderValues = {
  ...baseValues,
  selectedSize: "X",
  chartAudience: "plus",
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

describe("Sideways V-Neck five-step builder", () => {
  it("has exactly five numbered steps and does not number Review and Create", () => {
    expect(builderScript).toMatch(/const STEPS = 5/);
    expect(builderScript).not.toMatch(/const STEPS = 6/);
    expect(builderAstro).toContain('data-express-step="1"');
    expect(builderAstro).toContain('data-express-step="5"');
    expect(builderAstro).not.toContain('data-express-step="6"');
    expect(builderAstro).not.toContain('data-express-step="7"');
    expect(builderAstro).not.toContain('data-express-step="8"');
    expect(builderAstro).toContain('label: "Style"');
    expect(builderAstro).toContain('label: "Starting Size"');
    expect(builderAstro).toContain('label: "Fit"');
    expect(builderAstro).toContain('label: "Sleeve"');
    expect(builderAstro).toContain('label: "Gauge and Machine"');
    expect(builderAstro).not.toContain('label: "Review"');
    expect(builderAstro).not.toContain("Review and create");
    expect(builderAstro).not.toContain('data-express-field="review"');
    expect(builderAstro).not.toContain("Choose a sizing chart");
    expect(builderAstro).not.toContain('data-express-field="chartAudience"');
    expect(builderAstro).not.toContain("Style measurements");
    expect(builderAstro).not.toContain('data-express-field="measurements"');
    expect(builderAstro).toContain('data-express-field="selectedSize"');
    expect(builderAstro).toContain("data-sideways-size-group");
    expect(builderAstro).toContain("SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS");
    expect(builderAstro).not.toContain('id="express-acc-panel-6"');
    expect(builderScript).toContain("if (step < 1 || step > STEPS) return false");
    expect(builderScript).toContain('header?.setAttribute("tabindex", locked ? "-1" : "0")');
    expect(builderAstro).toContain('aria-label="Review your pattern"');
  });

  it("shows Review My Pattern after Gauge and Machine, not as a numbered step", () => {
    expect(builderAstro).toContain("Review My Pattern");
    expect(builderAstro).toContain('id="express-generate-wrap"');
    expect(builderAstro).toContain("express-generate-wrap--footer");
    expect(builderAstro).toContain("Your selections are ready to review.");
    expect(builderAstro).toMatch(
      /data-express-step="5"[\s\S]*id="express-generate-wrap"[\s\S]*Review My Pattern/,
    );
    expect(builderAstro).not.toMatch(
      /data-express-step="6"[\s\S]*Review My Pattern/,
    );
    expect(builderScript).toContain("wizardReadyForReview");
    expect(builderScript).toContain("showingReview");
    expect(builderScript).toContain("is-reviewing");
    expect(builderAstro).toContain("data-sideways-review-panel");
    expect(builderAstro).toContain("Create Pattern");
    expect(builderAstro).toContain('id="sideways-create-pattern"');
    expect(builderAstro).not.toMatch(
      /data-express-step="6"[\s\S]*Create Pattern/,
    );
    expect(builderScript).toContain("SIDEWAYS_CARDIGAN_PATTERN_WORKSPACE_GENERATED_HREF");
    expect(builderAstro).toContain('data-express-review-href="/patterns/sideways-cardigan/pattern/?generated=1"');
  });

  it("keeps the review screen, Back to builder, and Create Pattern on the existing routes", () => {
    const patternPage = readFileSync(
      resolve("src/pages/patterns/sideways-cardigan/pattern/index.astro"),
      "utf8",
    );
    expect(patternPage).toContain("Back to builder");
    expect(patternPage).toContain('href="/patterns/sideways-cardigan/builder"');
    expect(builderAstro).toContain("data-sideways-review-summary");
    expect(builderScript).toContain('["Garment style"');
    expect(builderScript).toContain('["Starting size"');
    expect(builderScript).toContain('["Fit"');
    expect(builderScript).toContain('["Finished bust"');
    expect(builderScript).toContain('["Sleeve direction"');
    expect(builderScript).toContain('["Sleeve length"');
    expect(builderScript).toContain('["Gauge"');
    expect(builderScript).toContain('["Machine"');
    expect(builderAstro).toContain('id="sideways-create-pattern"');
    expect(builderScript).toContain('getElementById("sideways-create-pattern")');
    expect(builderScript).toContain("readSidewaysCardiganBuilderStateFromDraft");
  });

  it("shows Misses and Women's as chart buttons and keeps plus as the internal key", () => {
    expect(SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS.map((g) => g.audience)).toEqual(["misses", "plus"]);
    expect(SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS.map((g) => g.heading)).toEqual(["Misses", "Women's"]);
    expect(SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS.map((g) => g.buttonLabel)).toEqual([
      "Misses (1–8)",
      "Women's (X–6X)",
    ]);
    expect(builderAstro).toContain("{group.buttonLabel}");
    expect(builderAstro).toContain('data-field="chartAudience"');
    expect(builderAstro).toContain("data-value={group.audience}");
    expect(builderAstro).toContain("data-chart-audience={group.audience}");
    expect(builderAstro).not.toMatch(/>Plus</);
    expect(builderAstro).toContain("sideways-chart-picker");
    expect(builderScript).toContain("applySidewaysCardiganStartingChartSelection");
    expect(builderScript).toContain('"plus"');
    expect(builderScript).toContain("section.hidden = state.chartAudience !== group.audience");
    expect(builderScript).toContain("if (state.chartAudience !== group.audience) continue");
    expect(builderAstro).toMatch(/data-express-nested-size hidden/);
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
    expect(builderAstro).not.toContain('{ "is-selected": i === 0 }');
    expect(builderScript).toContain("applySidewaysCardiganSleeveChoice");
    expect(builderScript).toContain("result.openStep");
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

describe("Sideways V-Neck Starting Size chart buttons", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    seedExpressSweaterChartsForTests("misses", [
      { size: 1, bust_or_chest: 31.5 },
      { size: 8, bust_or_chest: 42 },
    ]);
    seedExpressSweaterChartsForTests("plus", [
      { size: "X", bust_or_chest: 39 },
      { size: "6X", bust_or_chest: 63 },
    ]);
  });

  afterEach(() => {
    localStorage.clear();
    resetExpressSweaterChartsForTests();
  });

  it("clears an incompatible size when switching from Misses to Women's", () => {
    const state = emptySidewaysCardiganBuilderDraftState();
    state.chartAudience = "misses";
    state.selectedSize = "8";
    state.styleMeasurements.finishedLength = "25";
    applySidewaysCardiganStartingChartSelection(state, "plus");
    expect(state.chartAudience).toBe("plus");
    expect(state.selectedSize).toBe("");
    expect(state.styleMeasurements.finishedLength).toBe("");
  });

  it("clears an incompatible size when switching from Women's to Misses", () => {
    const state = emptySidewaysCardiganBuilderDraftState();
    state.chartAudience = "plus";
    state.selectedSize = "X";
    applySidewaysCardiganStartingChartSelection(state, "misses");
    expect(state.chartAudience).toBe("misses");
    expect(state.selectedSize).toBe("");
  });

  it("keeps a compatible size when the same chart is selected again", () => {
    const state = emptySidewaysCardiganBuilderDraftState();
    state.chartAudience = "misses";
    state.selectedSize = "8";
    applySidewaysCardiganStartingChartSelection(state, "misses");
    expect(state.chartAudience).toBe("misses");
    expect(state.selectedSize).toBe("8");
  });

  it("reopens a saved Misses draft with the Misses chart and size 8", () => {
    syncSidewaysCardiganBuilderToPatternStorage(baseValues, missesRow);
    const restored = readSidewaysCardiganBuilderStateFromDraft();
    expect(restored.chartAudience).toBe("misses");
    expect(restored.selectedSize).toBe("8");
  });

  it("reopens a saved Women's draft with plus key and size X", () => {
    syncSidewaysCardiganBuilderToPatternStorage(plusValues, plusRow);
    const restored = readSidewaysCardiganBuilderStateFromDraft();
    expect(restored.chartAudience).toBe("plus");
    expect(restored.selectedSize).toBe("X");
    expect(getCurrentPattern().style.recipientCategory).toBe("plus");
    expect(getCurrentPattern().fit.sizingChart).toBe("plus");
  });

  it("persists a cleared size so refresh does not restore the old Misses size on Women's", () => {
    syncSidewaysCardiganBuilderToPatternStorage(baseValues, missesRow);
    const state = readSidewaysCardiganBuilderStateFromDraft();
    applySidewaysCardiganStartingChartSelection(state, "plus");
    writeSidewaysCardiganSizingIdentity({
      chartAudience: state.chartAudience,
      selectedSize: state.selectedSize,
    });
    const restored = readSidewaysCardiganBuilderStateFromDraft();
    expect(restored.chartAudience).toBe("plus");
    expect(restored.selectedSize).toBe("");
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
    style.sleeveLength = "";
    saveCurrentPattern({ style });
    const pbStyle = { ...(getPatternData().style as Record<string, unknown>) };
    pbStyle.sleeveLength = "";
    savePatternData("style", pbStyle);
    const restored = readSidewaysCardiganBuilderStateFromDraft();
    expect(restored.sleeveLengthChoice).toBe("");
    expect(isSidewaysCardiganSleeveStepComplete(restored)).toBe(false);
    expect(restored.styleMeasurements.finishedLength).toBe("23.5");
    expect(restored.styleMeasurements.vNeckDepth).toBe("9");
    expect(restored.garmentStyle).toBe("pullover");
    expect(restored.sleeveDirection).toBe("cuff-up");
  });
});

describe("Sideways V-Neck Sleeve step completion", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("does not close the step when direction is chosen first", () => {
    const state = emptySidewaysCardiganBuilderDraftState();
    const result = applySidewaysCardiganSleeveChoice(state, "sleeveDirection", "cuff-up");
    expect(state.sleeveDirection).toBe("cuff-up");
    expect(state.sleeveLengthChoice).toBe("");
    expect(result.complete).toBe(false);
    expect(result.openStep).toBe(4);
    expect(isSidewaysCardiganSleeveStepComplete(state)).toBe(false);
  });

  it("does not close the step when length is chosen first", () => {
    const state = emptySidewaysCardiganBuilderDraftState();
    const result = applySidewaysCardiganSleeveChoice(state, "sleeveLength", "elbow");
    expect(state.sleeveLengthChoice).toBe("elbow");
    expect(state.sleeveDirection).toBe("");
    expect(result.complete).toBe(false);
    expect(result.openStep).toBe(4);
    expect(isSidewaysCardiganSleeveStepComplete(state)).toBe(false);
  });

  it("completes and advances to Gauge and Machine only after both are selected", () => {
    const state = emptySidewaysCardiganBuilderDraftState();
    const afterDirection = applySidewaysCardiganSleeveChoice(state, "sleeveDirection", "top-down");
    expect(afterDirection.complete).toBe(false);
    expect(afterDirection.openStep).toBe(4);
    const afterLength = applySidewaysCardiganSleeveChoice(state, "sleeveLength", "short");
    expect(state.sleeveDirection).toBe("top-down");
    expect(state.sleeveLengthChoice).toBe("short");
    expect(afterLength.complete).toBe(true);
    expect(afterLength.openStep).toBe(5);
    expect(isSidewaysCardiganSleeveStepComplete(state)).toBe(true);
  });

  it("reopens a draft with only one sleeve selection as incomplete", () => {
    syncSidewaysCardiganBuilderToPatternStorage(
      { ...baseValues, sleeveDirection: "sideways", sleeveLengthChoice: "long" },
      missesRow,
    );
    const style = { ...(getCurrentPattern().style as Record<string, unknown>) };
    style.sleeveLength = "";
    saveCurrentPattern({ style });
    const pbStyle = { ...(getPatternData().style as Record<string, unknown>) };
    pbStyle.sleeveLength = "";
    savePatternData("style", pbStyle);
    const directionOnly = readSidewaysCardiganBuilderStateFromDraft();
    expect(directionOnly.sleeveDirection).toBe("sideways");
    expect(directionOnly.sleeveLengthChoice).toBe("");
    expect(isSidewaysCardiganSleeveStepComplete(directionOnly)).toBe(false);

    syncSidewaysCardiganBuilderToPatternStorage(
      { ...baseValues, sleeveDirection: "cuff-up", sleeveLengthChoice: "three-quarter" },
      missesRow,
    );
    const style2 = { ...(getCurrentPattern().style as Record<string, unknown>) };
    style2.sleeveDirection = "";
    saveCurrentPattern({ style: style2 });
    const pbStyle2 = { ...(getPatternData().style as Record<string, unknown>) };
    pbStyle2.sleeveDirection = "";
    savePatternData("style", pbStyle2);
    const lengthOnly = readSidewaysCardiganBuilderStateFromDraft();
    expect(lengthOnly.sleeveDirection).toBe("");
    expect(lengthOnly.sleeveLengthChoice).toBe("three-quarter");
    expect(isSidewaysCardiganSleeveStepComplete(lengthOnly)).toBe(false);
  });

  it("restores a draft with both sleeve selections as complete", () => {
    syncSidewaysCardiganBuilderToPatternStorage(
      { ...baseValues, sleeveDirection: "top-down", sleeveLengthChoice: "elbow" },
      missesRow,
    );
    const restored = readSidewaysCardiganBuilderStateFromDraft();
    expect(restored.sleeveDirection).toBe("top-down");
    expect(restored.sleeveLengthChoice).toBe("elbow");
    expect(isSidewaysCardiganSleeveStepComplete(restored)).toBe(true);
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
    expect(sleevelessBuilder).toContain("Review My Pattern");
    expect(dropShoulderBuilder).toContain("View My Pattern");
    expect(dropShoulderBuilder).not.toContain("Misses (1–8)");
    expect(sleevelessBuilder).not.toContain("Women's (X–6X)");
    expect(dropShoulderBuilder).not.toContain("sideways-chart-picker");
    expect(sleevelessBuilder).not.toContain("sideways-chart-picker");
    expect(dropShoulderBuilder).not.toContain("data-sideways-review-panel");
    expect(sleevelessBuilder).not.toContain("data-sideways-review-panel");
    expect(dropShoulderPageScript).not.toContain("applySidewaysCardiganStartingChartSelection");
    expect(sleevelessExpress).not.toContain("applySidewaysCardiganStartingChartSelection");
  });
});
