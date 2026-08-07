/**
 * Bust-dart placement labels must follow the CURRENT pattern unit after Edit Pattern saves.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { BUST_DART_STYLE_KEY } from "./legoBlocks/bustDart";
import { buildCustomBuildEffectivePatternInput } from "./buildCustomBuildEffectivePatternInput";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
} from "./patternStorage";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { resolveMeasurementDisplayUnitFromPatternData } from "./patternMeasurementDisplayUnit";
import { renderBustDartCustomizationScreenHtml } from "./bustDartFrontSlotHtml";
import { stubLocalStorage } from "./test/stubLocalStorage";

function seedWorkingDraft(unit: "in" | "cm"): void {
  const now = new Date().toISOString();
  const style = {
    patternMode: "custom-build",
    recipientCategory: "misses",
    bodyShape: "straight",
    frontStyle: "closed",
    garmentStyle: "pullover",
    neckline: "round",
    construction: "sleeveless",
    [BUST_DART_STYLE_KEY]: {
      enabled: true,
      cupSize: "C",
      dartWidthInches: 3.25,
      dartDepthInches: 1,
    },
  };
  const fit = {
    selectedSize: "3",
    easeChoice: "standard",
    sizingChart: "misses",
    selectedMeasurements: {
      finished_bust_chest: 40,
      back_neck_to_hem: 22,
      armhole_depth: 8,
      neck_opening: 6,
      shoulder_width: 4.25,
      front_neck_depth: 3,
      back_neck_depth: 1,
    },
    cbMeasurementOverrides: {
      chestBust: "40",
      finishedLength: "22",
      armholeDepth: "8",
      shoulderWidth: "4.25",
      finishedNeckOpeningWidth: "6",
    },
  };
  const yarnGauge = {
    stitchGauge: "5",
    rowGauge: "7",
    gaugeUnits: "per_inch",
    gaugeStitchRaw: "20",
    gaugeRowRaw: "28",
    gaugeRawUnit: unit,
  };
  const yarnGaugeMachine = {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    gaugeStitchRaw: 20,
    gaugeRowRaw: 28,
    gaugeRawUnit: unit,
    availableNeedles: 200,
  };
  localStorage.clear();
  saveCurrentPattern({
    id: "bust-dart-unit-edit",
    status: "draft",
    version: 1,
    createdAt: now,
    updatedAt: now,
    style,
    fit,
    yarnGauge,
    machine: { availableNeedles: "200" },
    patternProject: { title: "Unit Edit", notes: "" },
  } as never);
  // Mirror the create-time shape: both yarnGauge and yarnGaugeMachine carry the unit.
  savePatternData("style", style);
  savePatternData("fit", fit);
  savePatternData("yarnGauge", yarnGauge);
  savePatternData("yarnGaugeMachine", yarnGaugeMachine);
}

/** Same writes Edit Pattern applyChanges performs for the gauge unit. */
function applyEditWorkspaceUnit(unit: "in" | "cm"): void {
  const stitchSwatch = unit === "cm" ? "20" : "20";
  const rowSwatch = unit === "cm" ? "28" : "28";
  const prevYgm = (getPatternData().yarnGaugeMachine || {}) as Record<string, unknown>;
  saveCurrentPattern({
    yarnGauge: {
      stitchGauge: "5",
      rowGauge: "7",
      gaugeUnits: "per_inch",
      gaugeStitchRaw: stitchSwatch,
      gaugeRowRaw: rowSwatch,
      gaugeRawUnit: unit,
    },
    machine: { availableNeedles: "200" },
  });
  savePatternData("yarnGauge", {
    stitchGauge: "5",
    rowGauge: "7",
    gaugeUnits: "per_inch",
    gaugeStitchRaw: stitchSwatch,
    gaugeRowRaw: rowSwatch,
    gaugeRawUnit: unit,
  });
  savePatternData("yarnGaugeMachine", {
    ...prevYgm,
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    gaugeStitchRaw: stitchSwatch,
    gaugeRowRaw: rowSwatch,
    gaugeRawUnit: unit,
    availableNeedles: 200,
  });
}

function slotFromWorkingDraft() {
  const gen = buildCustomBuildEffectivePatternInput();
  const result = generateSleevelessBackPattern(gen);
  return result.frontDisplayRows.find((r) => r.kind === "bustDartCustomization");
}

describe("bust-dart placement unit follows Edit Pattern unit change", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("cm → in updates active dart placement label without removing the dart", () => {
    seedWorkingDraft("cm");
    expect(resolveMeasurementDisplayUnitFromPatternData(getCurrentPattern(), getPatternData())).toBe(
      "cm",
    );
    let slot = slotFromWorkingDraft();
    expect(slot?.kind).toBe("bustDartCustomization");
    if (slot?.kind !== "bustDartCustomization") return;
    expect(slot.active).toBe(true);
    expect(slot.placementDistanceLabel).toBe("2.5 cm");
    expect(slot.instructionParagraphs[0]).toMatch(/2\.5 cm below the armhole opening/);

    applyEditWorkspaceUnit("in");
    expect(resolveMeasurementDisplayUnitFromPatternData(getCurrentPattern(), getPatternData())).toBe(
      "in",
    );
    slot = slotFromWorkingDraft();
    expect(slot?.kind).toBe("bustDartCustomization");
    if (slot?.kind !== "bustDartCustomization") return;
    expect(slot.active).toBe(true);
    expect(slot.cupSize).toBe("C");
    expect(slot.placementDistanceLabel).toBe("1″");
    expect(slot.instructionParagraphs[0]).toMatch(/1″ below the armhole opening/);
    expect(slot.instructionParagraphs.join("\n")).not.toMatch(/cm/);
  });

  it("in → cm updates inactive Optional Bust Dart prompt label", () => {
    seedWorkingDraft("in");
    // Turn dart off but keep eligibility / placement slot.
    saveCurrentPattern({
      style: {
        bustDart: { enabled: false, cupSize: null, dartWidthInches: null, dartDepthInches: null },
      },
    });
    savePatternData("style", {
      bustDart: { enabled: false, cupSize: null, dartWidthInches: null, dartDepthInches: null },
    });

    let slot = slotFromWorkingDraft();
    expect(slot?.kind === "bustDartCustomization" && slot.active).toBe(false);
    if (slot?.kind !== "bustDartCustomization") return;
    let html = renderBustDartCustomizationScreenHtml(slot);
    expect(html).toMatch(/\(1″ \/ \d+ rows before the armhole\)/);

    applyEditWorkspaceUnit("cm");
    slot = slotFromWorkingDraft();
    expect(slot?.kind === "bustDartCustomization" && slot.active).toBe(false);
    if (slot?.kind !== "bustDartCustomization") return;
    expect(slot.placementDistanceLabel).toBe("2.5 cm");
    html = renderBustDartCustomizationScreenHtml(slot);
    expect(html).toMatch(/\(2\.5 cm \/ \d+ rows before the armhole\)/);
    expect(html).not.toMatch(/1″/);
  });

  it("stale cm on yarnGaugeMachine must not keep cm after yarnGauge is edited to inches", () => {
    seedWorkingDraft("cm");
    applyEditWorkspaceUnit("in");
    // Leftover cm on the builder machine section (historical “any source says cm” failure mode).
    savePatternData("yarnGaugeMachine", {
      ...((getPatternData().yarnGaugeMachine || {}) as Record<string, unknown>),
      gaugeRawUnit: "cm",
    });

    const unit = resolveMeasurementDisplayUnitFromPatternData(getCurrentPattern(), getPatternData());
    const slot = slotFromWorkingDraft();
    expect(unit).toBe("in");
    expect(slot?.kind === "bustDartCustomization" && slot.active).toBe(true);
    expect(slot?.kind === "bustDartCustomization" && slot.placementDistanceLabel).toBe("1″");
    const html = renderBustDartCustomizationScreenHtml(
      slot as Parameters<typeof renderBustDartCustomizationScreenHtml>[0],
    );
    expect(html).toMatch(/1″/);
    expect(html).not.toMatch(/2\.5 cm/);
  });
});
