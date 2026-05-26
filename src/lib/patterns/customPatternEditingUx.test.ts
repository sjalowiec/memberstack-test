import { beforeEach, describe, expect, it } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
  readActiveCustomPatternProjectLinkedName,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  EXPRESS_EDITING_FALLBACK_LABEL,
  formatEditingSavedPatternStatus,
  getExpressEditingProjectLabel,
  getGenericUnsavedPatternLabel,
  isEditingSavedCustomPatternProject,
  reconcileActiveSavedProjectLinkedNameFromDraft,
  resolveCustomPatternDisplayName,
  resolveEditingSavedPatternBannerName,
} from "./customPatternEditingUx";
import { getCurrentPattern, PATTERN_STORAGE_KEY, saveCurrentPattern } from "./patternStorage";

const SUES_PATTERN = "Sue's test pattern";

function seedDraftWithTitle(title: string, titleCustomized = true): void {
  saveCurrentPattern({
    patternProject: { title, notes: "", titleCustomized },
  });
}

describe("resolveCustomPatternDisplayName", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("shows the saved project name when active id and linked name are set", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    expect(resolveCustomPatternDisplayName()).toBe(SUES_PATTERN);
  });

  it("uses draft title when active id is set but linked name was missing (legacy)", () => {
    writeActiveCustomPatternProjectId("proj-sue");
    seedDraftWithTitle(SUES_PATTERN);
    reconcileActiveSavedProjectLinkedNameFromDraft();
    expect(resolveCustomPatternDisplayName()).toBe(SUES_PATTERN);
    expect(readActiveCustomPatternProjectLinkedName()).toBe(SUES_PATTERN);
  });

  it("returns empty for a brand-new unsaved draft without a custom title", () => {
    saveCurrentPattern({ patternProject: { title: "", notes: "" } });
    expect(resolveCustomPatternDisplayName()).toBe("");
    expect(getGenericUnsavedPatternLabel()).toBe(EXPRESS_EDITING_FALLBACK_LABEL);
    expect(getExpressEditingProjectLabel()).toBe(EXPRESS_EDITING_FALLBACK_LABEL);
  });

  it("does not use auto-generated title as a saved name without an active project", () => {
    seedDraftWithTitle("Sleeveless Pullover - Women's Size 40 Round Neck", false);
    expect(resolveCustomPatternDisplayName()).toBe("");
    expect(getExpressEditingProjectLabel()).toBe(EXPRESS_EDITING_FALLBACK_LABEL);
  });
});

describe("editing saved pattern status", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("formats the editing status line", () => {
    expect(formatEditingSavedPatternStatus(SUES_PATTERN)).toBe(
      `Editing saved pattern: ${SUES_PATTERN}`,
    );
  });

  it("stays in editing mode when the title changes but the active id remains", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    seedDraftWithTitle(SUES_PATTERN);
    saveCurrentPattern({
      patternProject: { title: "Sue's revised vest", notes: "", titleCustomized: true },
    });
    expect(readActiveCustomPatternProjectId()).toBe("proj-sue");
    expect(isEditingSavedCustomPatternProject()).toBe(true);
    expect(resolveCustomPatternDisplayName()).toBe("Sue's revised vest");
    expect(resolveEditingSavedPatternBannerName()).toBe("Sue's revised vest");
  });
});

describe("hydration after loading a saved project", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("persists Sue's test pattern in the working draft and active keys", () => {
    localStorage.setItem(
      PATTERN_STORAGE_KEY,
      JSON.stringify({
        ...getCurrentPattern(),
        patternProject: { title: SUES_PATTERN, notes: "", titleCustomized: true },
      }),
    );
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);

    expect(readActiveCustomPatternProjectId()).toBe("proj-sue");
    expect(readActiveCustomPatternProjectLinkedName()).toBe(SUES_PATTERN);
    expect(resolveCustomPatternDisplayName()).toBe(SUES_PATTERN);
  });

  it("clears editing state after start-new clears the active link", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    clearActiveCustomPatternProjectId();
    expect(isEditingSavedCustomPatternProject()).toBe(false);
  });
});
