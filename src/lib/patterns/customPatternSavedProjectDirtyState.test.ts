import { beforeEach, describe, expect, it } from "vitest";
import { writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import {
  buildSavePayloadFromWorkingDraft,
} from "./customPatternProjectClient";
import {
  captureSavedCustomPatternDirtyBaseline,
  CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_KEY,
  CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_PROJECT_KEY,
  hasUnsavedSavedCustomPatternChanges,
  normalizeCustomPatternDirtySnapshot,
} from "./customPatternSavedProjectDirtyState";
import { ensureSavedCustomPatternSessionHydratedOnPatternPage } from "./hydrateSavedCustomPatternProject";
import { saveCurrentPattern, savePatternData } from "./patternStorage";
import { applyExpressGaugeNeedleEdits, readExpressWizardValues } from "./syncExpressWizardToPatternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";

describe("customPatternSavedProjectDirtyState", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("reports no unsaved changes when not editing a saved project", () => {
    saveCurrentPattern({
      style: { patternMode: "express", garmentStyle: "pullover" },
      patternProject: { title: "Draft", notes: "", titleCustomized: true },
    });
    expect(hasUnsavedSavedCustomPatternChanges()).toBe(false);
  });

  it("reports no unsaved changes immediately after capturing baseline on load", () => {
    writeActiveCustomPatternProjectId("proj-1", "Aubrey");
    saveCurrentPattern({
      style: { patternMode: "express", garmentStyle: "pullover" },
      patternProject: { title: "Aubrey", notes: "", titleCustomized: true },
    });
    captureSavedCustomPatternDirtyBaseline();
    expect(hasUnsavedSavedCustomPatternChanges()).toBe(false);
  });

  it("detects unsaved changes after the working draft changes", () => {
    writeActiveCustomPatternProjectId("proj-1", "Aubrey");
    saveCurrentPattern({
      style: { patternMode: "express", garmentStyle: "pullover" },
      patternProject: { title: "Aubrey", notes: "", titleCustomized: true },
    });
    captureSavedCustomPatternDirtyBaseline();

    saveCurrentPattern({
      style: { patternMode: "express", garmentStyle: "cardigan" },
      patternProject: { title: "Aubrey", notes: "edited", titleCustomized: true },
    });

    expect(hasUnsavedSavedCustomPatternChanges()).toBe(true);
  });

  it("ignores volatile pattern timestamps in dirty comparison", () => {
    const payload = buildSavePayloadFromWorkingDraft("Test");
    const a = normalizeCustomPatternDirtySnapshot(payload);
    const b = normalizeCustomPatternDirtySnapshot({
      ...payload,
      pattern: {
        ...payload.pattern,
        id: "other-id",
        createdAt: "old",
        updatedAt: "new",
      },
    });
    expect(a).toBe(b);
  });

  it("treats a missing baseline as dirty while a saved project is active", () => {
    writeActiveCustomPatternProjectId("proj-legacy", "Legacy");
    saveCurrentPattern({
      patternProject: { title: "Legacy", notes: "", titleCustomized: true },
    });
    expect(hasUnsavedSavedCustomPatternChanges()).toBe(true);
  });

  it("clears false dirty after deferred baseline capture when page init normalizes the draft", async () => {
    const { scheduleCaptureSavedCustomPatternDirtyBaselineAfterHydration } = await import(
      "./customPatternSavedProjectDirtyState"
    );

    writeActiveCustomPatternProjectId("proj-1", "Aubrey");
    saveCurrentPattern({
      style: { patternMode: "express", garmentStyle: "pullover" },
      patternProject: { title: "Aubrey", notes: "", titleCustomized: true },
    });
    captureSavedCustomPatternDirtyBaseline();
    saveCurrentPattern({
      style: { patternMode: "express", garmentStyle: "pullover", recipientCategory: "men" },
      patternProject: { title: "Aubrey", notes: "", titleCustomized: true },
    });
    expect(hasUnsavedSavedCustomPatternChanges()).toBe(true);

    scheduleCaptureSavedCustomPatternDirtyBaselineAfterHydration();
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(hasUnsavedSavedCustomPatternChanges()).toBe(false);
  });

  it("stores baseline against the active project id", () => {
    writeActiveCustomPatternProjectId("proj-abc", "Name");
    captureSavedCustomPatternDirtyBaseline();
    expect(localStorage.getItem(CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_PROJECT_KEY)).toBe(
      "proj-abc",
    );
    expect(localStorage.getItem(CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_KEY)).toBeTruthy();
  });

  it("stays dirty after preview sync (generate) and pattern-tab hydration without Save", () => {
    writeActiveCustomPatternProjectId("proj-1", "Aubrey");
    saveCurrentPattern({
      style: { patternMode: "express", garmentStyle: "pullover" },
      yarnGauge: { gaugeStitchRaw: "20", gaugeRowRaw: "26", gaugeRawUnit: "in" },
      patternProject: { title: "Aubrey", notes: "", titleCustomized: true },
    });
    savePatternData("yarnGauge", { gaugeStitchRaw: "20", gaugeRowRaw: "26", gaugeRawUnit: "in" });
    savePatternData("yarnGaugeMachine", { gaugeStitchRaw: "20", gaugeRowRaw: "26", gaugeRawUnit: "in" });
    captureSavedCustomPatternDirtyBaseline();

    applyExpressGaugeNeedleEdits(readExpressWizardValues(), {
      gaugeStitchRaw: "22",
      gaugeRowRaw: "28",
      availableNeedles: "120",
    });

    expect(hasUnsavedSavedCustomPatternChanges()).toBe(true);

    ensureSavedCustomPatternSessionHydratedOnPatternPage();

    expect(hasUnsavedSavedCustomPatternChanges()).toBe(true);
  });
});
