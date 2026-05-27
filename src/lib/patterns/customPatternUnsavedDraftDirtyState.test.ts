/**
 * Unsaved custom-build draft (no saved Blob project id yet) — hip overrides and dirty prompts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { buildSavePayloadFromWorkingDraft } from "./customPatternProjectClient";
import {
  captureCustomPatternDirtyBaseline,
  CUSTOM_PATTERN_UNSAVED_DRAFT_BASELINE_SENTINEL,
  hasUnsavedCustomPatternChanges,
  isUnsavedCustomBuildDraftSession,
} from "./customPatternSavedProjectDirtyState";
import { hydrateSavedCustomPatternProjectSession } from "./hydrateSavedCustomPatternProject";
import { persistMeasurementOverrides, loadMeasurementOverrides } from "./sleevelessCustomMeasurementStorage";
import {
  getCurrentPattern,
  saveCurrentPattern,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";

function seedNewCustomBuildDraft(overrides: Record<string, string>): void {
  localStorage.setItem(
    SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
    JSON.stringify({
      values: {
        who: "women",
        selectedSize: "M",
        fit: "standard",
        neckline: "round",
        front: "closed",
        style: "straight-pullover",
      },
      cbMeasurementOverrides: overrides,
    }),
  );
  saveCurrentPattern({
    style: { patternMode: "custom-build", garmentStyle: "pullover", bodyShape: "straight" },
    fit: {
      selectedSize: "M",
      easeChoice: "standard",
      sizingChart: "misses",
      cbMeasurementOverrides: overrides,
    },
    yarnGauge: { gaugeStitchRaw: "20", gaugeRowRaw: "26" },
    patternProject: { title: "My new vest", notes: "", titleCustomized: true },
  });
}

describe("unsaved custom-build draft dirty state", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("recognizes a brand-new custom-build session without an active saved project id", () => {
    seedNewCustomBuildDraft({
      chestBust: "40",
      hip: "40",
      finishedLength: "24",
      hemDepth: "2",
    });
    expect(readActiveCustomPatternProjectId()).toBe("");
    expect(isUnsavedCustomBuildDraftSession()).toBe(true);
  });

  it("detects dirty after hip-only change on a new custom-build draft", () => {
    seedNewCustomBuildDraft({
      chestBust: "40",
      hip: "40",
      finishedLength: "24",
      armholeDepth: "8",
      shoulderWidth: "14",
      finishedNeckOpeningWidth: "6",
      neckDepth: "3",
      hemDepth: "2",
    });
    captureCustomPatternDirtyBaseline();
    expect(hasUnsavedCustomPatternChanges()).toBe(false);

    persistMeasurementOverrides({
      ...loadMeasurementOverrides(),
      hip: "43",
    });

    expect(hasUnsavedCustomPatternChanges()).toBe(true);
    expect(loadMeasurementOverrides().hip).toBe("43");
  });

  it("save payload keeps hip after sync+flush (DOM-less persist path)", () => {
    seedNewCustomBuildDraft({
      chestBust: "40",
      hip: "40",
      finishedLength: "24",
      hemDepth: "2",
    });
    persistMeasurementOverrides({
      ...loadMeasurementOverrides(),
      hip: "43",
    });

    const payload = buildSavePayloadFromWorkingDraft("My new vest");
    const cb = (payload.pattern.fit as Record<string, unknown>)
      .cbMeasurementOverrides as Record<string, string>;
    expect(cb.hip).toBe("43");
    expect(cb.chestBust).toBe("40");
  });

  it("restores hip from cbMeasurementOverrides after Save New Project hydrate", () => {
    const project = {
      id: "proj-new-hip",
      name: "My new vest",
      family: "sleeveless" as const,
      source: "custom-build" as const,
      notes: "",
      customOverrides: {},
      createdAt: "t1",
      updatedAt: "t2",
      version: 1,
      pattern: {
        id: "pattern-new-hip",
        patternType: "sleeveless",
        status: "draft",
        version: 1,
        createdAt: "t1",
        updatedAt: "t1",
        style: {
          patternMode: "custom-build",
          recipientCategory: "misses",
          bodyShape: "straight",
          garmentStyle: "pullover",
        },
        fit: {
          selectedSize: "M",
          cbMeasurementOverrides: {
            chestBust: "40",
            hip: "43",
            finishedLength: "24",
            hemDepth: "2",
          },
        },
        yarnGauge: {},
        measurements: {},
        machine: {},
        calculations: {},
        instructions: {},
        patternProject: { title: "My new vest", notes: "", titleCustomized: true },
      },
    };

    hydrateSavedCustomPatternProjectSession(project);
    expect(readActiveCustomPatternProjectId()).toBe("proj-new-hip");
    expect(loadMeasurementOverrides().hip).toBe("43");
    expect(hasUnsavedCustomPatternChanges()).toBe(false);
  });

  it("stores draft baseline under the draft sentinel project key", () => {
    seedNewCustomBuildDraft({ chestBust: "40", hip: "40", hemDepth: "2" });
    captureCustomPatternDirtyBaseline();
    expect(localStorage.getItem("kbm_custom_pattern_saved_dirty_baseline_project_id")).toBe(
      CUSTOM_PATTERN_UNSAVED_DRAFT_BASELINE_SENTINEL,
    );
    expect(getCurrentPattern().fit?.cbMeasurementOverrides?.hip).toBe("40");
  });
});
