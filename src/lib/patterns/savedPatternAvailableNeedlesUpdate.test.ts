/**
 * Regression coverage for editing Available Needles on an existing saved pattern.
 *
 * The bug: an edited needle count was dropped because the stale Express wizard snapshot
 * (`kbm_sleeveless_express_builder`) is the highest-priority read source for needle mirror sync and
 * too-wide validation. Editing needles in the Edit Pattern drawer wrote canonical + builder mirrors
 * but not the Express snapshot, so the post-save refresh (and reopen) re-clobbered the value with the
 * old snapshot entry.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  buildSavePayloadFromWorkingDraft,
} from "./customPatternProjectClient";
import {
  readAvailableNeedlesFromAllSources,
  syncAvailableNeedlesMirrorsFromAllSources,
} from "./availableNeedlesMirrors";
import { hydrateSavedCustomPatternProjectSession } from "./hydrateSavedCustomPatternProject";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
} from "./patternStorage";
import { loadExpressPersisted, writeExpressPersistedSnapshot } from "./sleevelessExpressResume";
import {
  expressNeedleValidationSourcesFromPatternStorage,
  resolveExpressAvailableNeedlesForValidationWithSource,
} from "./sleevelessExpressAvailableNeedles";
import { stubLocalStorage } from "./test/stubLocalStorage";

vi.mock("./patternReadingWorkflow", () => ({
  applySleevelessReadingWorkflow: vi.fn(),
}));

function sleevelessSavedProject(availableNeedles: string | number): CustomPatternProject {
  return {
    id: "proj-sl",
    name: "Sleeveless test",
    family: "sleeveless",
    source: "express",
    notes: "",
    customOverrides: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    version: 1,
    pattern: {
      id: "pattern-sl",
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      style: {
        recipientCategory: "misses",
        bodyShape: "straight",
        frontStyle: "closed",
        garmentStyle: "pullover",
        neckline: "round",
        patternMode: "express",
      },
      fit: {
        selectedSize: "M",
        easeChoice: "standard",
        sizingChart: "misses",
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
      yarnGauge: {
        stitchGauge: "6",
        rowGauge: "8",
        gaugeStitchRaw: "24",
        gaugeRowRaw: "32",
        gaugeRawUnit: "in",
      },
      measurements: {},
      machine: { availableNeedles },
      calculations: {},
      instructions: {},
      patternProject: { title: "Sleeveless test", notes: "", titleCustomized: true },
    },
  };
}

function ygm(): Record<string, unknown> {
  const v = getPatternData().yarnGaugeMachine;
  return v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {};
}

describe("saved pattern Available Needles update", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("persists an edited needle count into the save payload and survives the post-save refresh", () => {
    // Open the saved project with its original value (100).
    hydrateSavedCustomPatternProjectSession(sleevelessSavedProject("100"), { editChoicesReopen: true });
    expect(readAvailableNeedlesFromAllSources().value).toBe("100");

    // Simulate the Edit Pattern drawer "Apply Changes" save of a new value (250).
    saveCurrentPattern({
      machine: { ...(getCurrentPattern().machine as Record<string, unknown>), availableNeedles: "250" },
    });
    savePatternData("yarnGaugeMachine", { ...ygm(), availableNeedles: "250" });
    writeExpressPersistedSnapshot({ availableNeedles: "250" });

    // The cloud save payload must carry the edited value to the same project.
    const payload = buildSavePayloadFromWorkingDraft("Sleeveless test", {
      flushRoot: null,
      skipFlushMeasurementOverrides: true,
    });
    expect(String((payload.pattern.machine as Record<string, unknown>).availableNeedles)).toBe("250");

    // The post-save pattern-tab refresh re-mirrors from all sources — it must NOT revert to 100.
    syncAvailableNeedlesMirrorsFromAllSources();
    expect(String(getCurrentPattern().machine.availableNeedles)).toBe("250");
    expect(readAvailableNeedlesFromAllSources().value).toBe("250");
    expect(loadExpressPersisted()?.availableNeedles).toBe("250");
  });

  it("reopening hydrates the updated saved value even when a stale Express snapshot lingers", () => {
    // Stale snapshot left in localStorage from an earlier session (old value 100).
    writeExpressPersistedSnapshot({ values: { who: "women" }, availableNeedles: "100" });

    // Reopen the saved project whose stored value is now the edited value (250).
    hydrateSavedCustomPatternProjectSession(sleevelessSavedProject("250"), { editChoicesReopen: true });

    expect(String(getCurrentPattern().machine.availableNeedles)).toBe("250");
    expect(String((getPatternData().yarnGaugeMachine as Record<string, unknown>).availableNeedles)).toBe(
      "250",
    );
    expect(loadExpressPersisted()?.availableNeedles).toBe("250");
    expect(readAvailableNeedlesFromAllSources().value).toBe("250");
  });

  it("pattern-width validation resolves the updated saved value after reopen", () => {
    writeExpressPersistedSnapshot({ values: { who: "women" }, availableNeedles: "100" });
    hydrateSavedCustomPatternProjectSession(sleevelessSavedProject("250"), { editChoicesReopen: true });

    const sources = expressNeedleValidationSourcesFromPatternStorage(getPatternData(), {});
    const resolved = resolveExpressAvailableNeedlesForValidationWithSource(sources);
    expect(resolved.value).toBe(250);
  });
});
