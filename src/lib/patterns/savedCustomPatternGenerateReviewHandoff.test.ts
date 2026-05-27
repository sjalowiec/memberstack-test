import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { mergedPatternForDisplayFromSources, buildGeneratorPatternDataFromSources } from "./sleevelessPatternBuilderMerge";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { getCurrentPattern, getPatternData, saveCurrentPattern, savePatternData } from "./patternStorage";
import { captureSavedCustomPatternDirtyBaseline, hasUnsavedSavedCustomPatternChanges } from "./customPatternSavedProjectDirtyState";
import { stubLocalStorage } from "./test/stubLocalStorage";

describe("savedCustomPattern generate/review handoff", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders from local draft after edits, without calling cloud APIs", () => {
    // Guard: this flow must not require any network calls (no implicit cloud-save).
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any);

    writeActiveCustomPatternProjectId("proj-1", "My Saved Pattern");
    saveCurrentPattern({
      style: {
        patternMode: "express",
        recipientCategory: "women",
        garmentStyle: "pullover",
        frontStyle: "closed",
        neckline: "round",
      },
      fit: {
        sizingChart: "women",
        selectedSize: "M",
        easeChoice: "standard",
        selectedMeasurements: {
          finished_bust_chest: 40,
          finished_hip: 40,
          finished_length: 22,
          armhole_depth: 8,
          shoulder_width: 14,
          neck_opening_width: 8,
          front_neck_depth: 3,
          hem_depth: 1,
        },
      },
      yarnGauge: { stitchGauge: 6, rowGauge: 8, gaugeRawUnit: "in" },
      machine: { availableNeedles: 200 },
      patternProject: { title: "My Saved Pattern", notes: "", titleCustomized: true },
    });

    // Mirror builder sections (typical after opening a saved project).
    savePatternData("style", getCurrentPattern().style as Record<string, unknown>);
    savePatternData("fit", getCurrentPattern().fit as Record<string, unknown>);
    savePatternData("yarnGauge", getCurrentPattern().yarnGauge as Record<string, unknown>);
    savePatternData("machine", getCurrentPattern().machine as Record<string, unknown>);

    captureSavedCustomPatternDirtyBaseline();

    // Simulate a quick edit in the saved-pattern session.
    saveCurrentPattern({
      yarnGauge: { stitchGauge: 6.5 },
      patternProject: { title: "My Saved Pattern (edited)" },
    });
    expect(hasUnsavedSavedCustomPatternChanges()).toBe(true);

    // Regression guard: even if `patternBuilderData` becomes stale/empty, generation should still work.
    localStorage.removeItem("patternBuilderData");
    expect(Object.keys(getPatternData())).toHaveLength(0);

    const merged = mergedPatternForDisplayFromSources(getCurrentPattern(), getPatternData());
    const genInput = buildGeneratorPatternDataFromSources(merged, getPatternData(), getCurrentPattern());
    const result = generateSleevelessBackPattern(genInput);

    expect(result.displayRows?.length ?? 0).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

