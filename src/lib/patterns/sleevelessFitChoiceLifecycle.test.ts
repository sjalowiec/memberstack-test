import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  type SleevelessPatternRecord,
} from "./patternStorage";
import { syncExpressWizardToPatternStorage } from "./syncExpressWizardToPatternStorage";
import { buildExpressValuesFromPattern } from "./restoreSleevelessExpressBuilderFromPattern";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";

function basePattern(): SleevelessPatternRecord {
  return {
    id: "p1",
    patternType: "sleeveless",
    status: "draft",
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    style: {
      recipientCategory: "misses",
      bodyShape: "straight",
      frontStyle: "closed",
      garmentStyle: "pullover",
      neckline: "round",
      patternMode: "express",
    },
    fit: { selectedSize: "M", easeChoice: "standard", fitChoice: "standard", sizingChart: "misses" },
    yarnGauge: { stitchGauge: "5", rowGauge: "7", gaugeStitchRaw: "20", gaugeRowRaw: "28", gaugeRawUnit: "in" },
    measurements: {},
    machine: { availableNeedles: "200" },
    calculations: {},
    instructions: {},
    patternProject: { title: "Test", notes: "", titleCustomized: true },
  };
}

const CHART_ROW = {
  size: "M",
  bust_or_chest: 38,
  waist: 32,
  hip: 40,
  garment_back_length: 22,
  armhole_depth: 8,
  shoulder_width: 4.25,
  neck_opening: 6,
  front_neck_depth: 3,
  back_neck_depth: 1,
};

describe("Fit choice lifecycle", () => {
  beforeEach(() => {
    stubLocalStorage();
    writeActiveCustomPatternProjectId("proj-fit");
    vi.stubGlobal("document", { getElementById: () => null, querySelector: () => null });
  });

  it("persists the Fit choice selected during build into project data", () => {
    saveCurrentPattern(basePattern());

    syncExpressWizardToPatternStorage(
      { who: "women", selectedSize: "M", front: "closed", neckline: "round", fit: "relaxed", style: "straight-pullover" },
      null,
    );

    const fit = getCurrentPattern().fit as Record<string, unknown>;
    expect(fit.fitChoice).toBe("relaxed");
    expect(fit.easeChoice).toBe("relaxed");

    const pbFit = getPatternData().fit as Record<string, unknown>;
    expect(pbFit.fitChoice).toBe("relaxed");
  });

  it("restores the saved Fit choice when reloading a pattern (My Patterns reload)", () => {
    const saved = basePattern();
    saved.fit = { ...saved.fit, easeChoice: "relaxed", fitChoice: "relaxed" };

    const values = buildExpressValuesFromPattern(saved, {});
    expect(values.fit).toBe("relaxed");
  });

  it("changing Fit from Close to Relaxed changes the finished bust (ease applied)", () => {
    const close = computeDefaultMeasurementsFromChartRow(CHART_ROW, "close");
    const relaxed = computeDefaultMeasurementsFromChartRow(CHART_ROW, "relaxed");

    // close ease = +1", relaxed ease = +5" → +4" finished bust difference.
    expect(close.finished_bust_chest).toBe(39);
    expect(relaxed.finished_bust_chest).toBe(43);
    expect(relaxed.finished_bust_chest - close.finished_bust_chest).toBe(4);
  });

  it("finished-bust resolver reflects the recalculated Fit measurements", () => {
    const relaxed = computeDefaultMeasurementsFromChartRow(CHART_ROW, "relaxed");
    const patternData = {
      style: { patternMode: "express" },
      fit: { selectedSize: "M", fitChoice: "relaxed", selectedMeasurements: relaxed },
    };
    expect(resolveEffectiveFinishedBustInches(patternData)).toBe(43);
  });

  it("other Express choices continue to persist alongside Fit", () => {
    saveCurrentPattern(basePattern());

    syncExpressWizardToPatternStorage(
      { who: "women", selectedSize: "M", front: "open", neckline: "v-neck", fit: "close", style: "straight-cardigan" },
      null,
    );

    const style = getCurrentPattern().style as Record<string, unknown>;
    expect(style.frontStyle).toBe("open");
    expect(style.neckline).toBe("v");
    expect((getCurrentPattern().fit as Record<string, unknown>).fitChoice).toBe("close");
  });
});
