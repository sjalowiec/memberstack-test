import { describe, expect, it, vi, beforeEach } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { saveCurrentPattern } from "./patternStorage";
import {
  clearActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { loadProjectIntoWorkingDraft } from "./customPatternProjectClient";
import {
  EXPRESS_EDITING_FALLBACK_LABEL,
} from "./sleevelessExpressResume";
import { syncSleevelessBuilderHeaderTitle, resolveSleevelessBuilderHeaderTitle } from "./sleevelessBuilderHeaderUx";

const SUES_PATTERN = "Sue's test pattern";

function makeHeaderEl(initial = "Sleeveless Sweater") {
  return { textContent: initial } as unknown as HTMLElement;
}

describe("sleevelessBuilderHeaderUx", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("opening a saved custom-build project + syncing shows the saved name on the Build/Create header", () => {
    const headerEl = makeHeaderEl();
    vi.stubGlobal("document", {
      querySelector: () => headerEl,
    });

    const project: CustomPatternProject = {
      id: "proj-sue",
      name: SUES_PATTERN,
      family: "sleeveless",
      source: "custom-build",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      version: 1,
      customOverrides: {},
      notes: "",
      pattern: {
        id: "working-draft-id",
        patternType: "sleeveless",
        status: "draft",
        version: 1,
        createdAt: "t",
        updatedAt: "t",
        style: { recipientCategory: "misses", garmentStyle: "pullover" },
        fit: { selectedSize: "40" },
        yarnGauge: {},
        measurements: {},
        machine: {},
        calculations: {},
        instructions: {},
      },
    };

    loadProjectIntoWorkingDraft(project);
    writeActiveCustomPatternProjectId(project.id, project.name);

    syncSleevelessBuilderHeaderTitle();
    expect(headerEl.textContent).toBe(SUES_PATTERN);
    expect(resolveSleevelessBuilderHeaderTitle()).toBe(SUES_PATTERN);
  });

  it("changing a build value (e.g. bust size) keeps the header on the active saved name", () => {
    const headerEl = makeHeaderEl();
    vi.stubGlobal("document", {
      querySelector: () => headerEl,
    });

    saveCurrentPattern({
      patternProject: { title: SUES_PATTERN, notes: "", titleCustomized: true },
    });
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);

    syncSleevelessBuilderHeaderTitle();
    expect(headerEl.textContent).toBe(SUES_PATTERN);

    // Simulate the user changing a build value on this page.
    saveCurrentPattern({
      fit: {
        cbMeasurementOverrides: { chestBust: "52" },
      } as unknown as Record<string, unknown>,
    });

    syncSleevelessBuilderHeaderTitle();
    expect(headerEl.textContent).toBe(SUES_PATTERN);
  });

  it("brand-new unsaved draft uses the generic fallback title", () => {
    const headerEl = makeHeaderEl("Some other title");
    vi.stubGlobal("document", {
      querySelector: () => headerEl,
    });

    clearActiveCustomPatternProjectId();
    saveCurrentPattern({ patternProject: { title: "", notes: "" } });

    syncSleevelessBuilderHeaderTitle();
    expect(headerEl.textContent).toBe(EXPRESS_EDITING_FALLBACK_LABEL);
  });

  it("falls back to kbm_custom_pattern_active_project_name when the draft title is empty", () => {
    const headerEl = makeHeaderEl();
    vi.stubGlobal("document", {
      querySelector: () => headerEl,
    });

    clearActiveCustomPatternProjectId();
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    saveCurrentPattern({ patternProject: { title: "", notes: "" } });

    syncSleevelessBuilderHeaderTitle();
    expect(headerEl.textContent).toBe(SUES_PATTERN);
  });
});

