import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  readActiveCustomPatternProjectId,
  readActiveCustomPatternProjectLinkedName,
} from "./customPatternProjectActiveId";
import * as workflowModule from "./patternReadingWorkflow";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  CUSTOM_BUILD_EDIT_WORKSPACE_HREF,
  EXPRESS_CONTINUE_EDITING_HREF,
  EXPRESS_EDIT_WORKSPACE_HREF,
  OPEN_PATTERN_EDIT_WORKSPACE_HREF,
  OPEN_PATTERN_HREF,
} from "./customPatternProjectNavigation";
import {
  PATTERN_STORAGE_KEY,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import * as restoreModule from "./restoreSleevelessExpressBuilderFromPattern";

const PROJECT_ID = "proj-aubrie";

function sampleProject(overrides: Partial<CustomPatternProject> = {}): CustomPatternProject {
  return {
    id: PROJECT_ID,
    name: "For Aubrie",
    family: "sleeveless",
    source: "express",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    version: 1,
    customOverrides: {},
    pattern: {
      id: "pattern-1",
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      style: {
        recipientCategory: "misses",
        bodyShape: "aline",
        frontStyle: "open",
        garmentStyle: "cardigan",
        neckline: "v",
        patternMode: "express",
      },
      fit: { selectedSize: "M", easeChoice: "standard" },
      yarnGauge: { gaugeStitchRaw: "22", gaugeRowRaw: "28" },
      measurements: {},
      machine: {},
      calculations: {},
      instructions: {},
      patternProject: { title: "For Aubrie", notes: "note", titleCustomized: true },
    },
    ...overrides,
  };
}

const loadCustomPatternProjectMock = vi.fn();

vi.mock("./customPatternProjectClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./customPatternProjectClient")>();
  return {
    ...actual,
    loadCustomPatternProject: (...args: unknown[]) => loadCustomPatternProjectMock(...args),
  };
});

import { loadProjectIntoWorkingDraft } from "./customPatternProjectClient";
import { loadSavedCustomPatternProject } from "./loadSavedCustomPatternProject";

describe("loadSavedCustomPatternProject", () => {
  beforeEach(() => {
    stubLocalStorage();
    loadCustomPatternProjectMock.mockReset();
  });

  it("opens express projects in the pattern page's auto-opened Edit Pattern Workspace and links the active project id", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject(),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "open");

    // In-place split workspace on the pattern page (quick edits + measurements), auto-opened via
    // the `?edit=1` flag — not the standalone review page, the step wizard, or read-only output.
    expect(result).toEqual({ ok: true, redirectHref: OPEN_PATTERN_EDIT_WORKSPACE_HREF });
    if (result.ok) {
      expect(result.redirectHref).toContain(OPEN_PATTERN_HREF);
      expect(result.redirectHref).not.toBe(OPEN_PATTERN_HREF);
      expect(result.redirectHref).not.toBe(EXPRESS_CONTINUE_EDITING_HREF);
      expect(result.redirectHref).not.toBe(EXPRESS_EDIT_WORKSPACE_HREF);
    }
    expect(readActiveCustomPatternProjectId()).toBe(PROJECT_ID);
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toContain("For Aubrie");
  });

  it("views a saved pattern by routing to the read-only pattern page, never the edit workspace", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject(),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "view");

    expect(result).toEqual({ ok: true, redirectHref: OPEN_PATTERN_HREF });
    if (result.ok) {
      expect(result.redirectHref).not.toBe(EXPRESS_EDIT_WORKSPACE_HREF);
      expect(result.redirectHref).not.toContain("edit=choices");
    }
    // Working draft is still hydrated so the pattern page can render the saved pattern.
    expect(readActiveCustomPatternProjectId()).toBe(PROJECT_ID);
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toContain("For Aubrie");
  });

  it("views a custom-build saved pattern on the same pattern page (source-independent)", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject({ source: "custom-build" }),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "view");

    expect(result).toEqual({ ok: true, redirectHref: OPEN_PATTERN_HREF });
    if (result.ok) {
      expect(result.redirectHref).not.toBe(CUSTOM_BUILD_EDIT_WORKSPACE_HREF);
    }
  });

  it("opens custom-build projects in the editable Foundation workspace, not Customize/review", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject({
        name: "Sue's test pattern",
        source: "custom-build",
        pattern: {
          ...sampleProject().pattern,
          patternProject: { title: "Sue's test pattern", notes: "", titleCustomized: true },
        },
      }),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "open");

    expect(result).toEqual({ ok: true, redirectHref: CUSTOM_BUILD_EDIT_WORKSPACE_HREF });
    if (result.ok) {
      expect(result.redirectHref).not.toBe(EXPRESS_CONTINUE_EDITING_HREF);
      expect(result.redirectHref).not.toContain("/custom-style");
      expect(result.redirectHref).not.toBe(OPEN_PATTERN_HREF);
    }
    expect(readActiveCustomPatternProjectId()).toBe(PROJECT_ID);
    expect(readActiveCustomPatternProjectLinkedName()).toBe("Sue's test pattern");
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toContain("Sue's test pattern");
  });

  it("rehydrates Express builder storage during normal open", async () => {
    const safeSpy = vi.spyOn(restoreModule, "safeRestoreSleevelessExpressBuilderFromPattern");

    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject(),
    });

    await loadSavedCustomPatternProject(PROJECT_ID, "open");

    expect(safeSpy).toHaveBeenCalled();
    safeSpy.mockRestore();
  });

  it("prefills saved values (including gauge) and unlocks every step when opening for edit", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject(),
    });

    await loadSavedCustomPatternProject(PROJECT_ID, "open");

    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const snapshot = JSON.parse(raw ?? "{}");
    // Gauge from the saved project is prefilled so it can be edited without rebuilding.
    expect(snapshot.gaugeStitchRaw).toBe("22");
    expect(snapshot.gaugeRowRaw).toBe("28");
    // Saved sizing identity is restored into the wizard values.
    expect(snapshot.values?.selectedSize).toBe("M");
    expect(snapshot.values?.who).toBe("women");
    // Opened for edit: all steps unlocked + reopened so gauge is reachable immediately.
    expect(snapshot.editChoicesReopen).toBe(true);
    expect(snapshot.maxReachable).toBe(5);
  });

  it("links the active project to the opened (copied) project id, not a previously opened one", async () => {
    const original = sampleProject({ id: "proj-original", name: "Original" });
    loadCustomPatternProjectMock.mockResolvedValueOnce({ ok: true, project: original });
    await loadSavedCustomPatternProject("proj-original", "open");
    expect(readActiveCustomPatternProjectId()).toBe("proj-original");

    const copy = sampleProject({ id: "proj-original-copy", name: "Original - Copy" });
    loadCustomPatternProjectMock.mockResolvedValueOnce({ ok: true, project: copy });
    await loadSavedCustomPatternProject("proj-original-copy", "open");

    expect(readActiveCustomPatternProjectId()).toBe("proj-original-copy");
    expect(readActiveCustomPatternProjectLinkedName()).toBe("Original - Copy");
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toContain("Original - Copy");
  });
});

describe("loadProjectIntoWorkingDraft", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it("loads draft even when pattern sections are null", () => {
    const project = sampleProject({
      pattern: {
        ...sampleProject().pattern,
        style: null as unknown as CustomPatternProject["pattern"]["style"],
        fit: null as unknown as CustomPatternProject["pattern"]["fit"],
      },
    });

    expect(() => loadProjectIntoWorkingDraft(project)).not.toThrow();
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toContain("For Aubrie");
  });

  it("continues when reading workflow restore throws", () => {
    const workflowError = vi
      .spyOn(workflowModule, "applySleevelessReadingWorkflow")
      .mockImplementation(() => {
        throw new Error("workflow restore failed");
      });

    expect(() => loadProjectIntoWorkingDraft(sampleProject())).not.toThrow();
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toContain("For Aubrie");

    workflowError.mockRestore();
  });
});

describe("safeRestoreSleevelessExpressBuilderFromPattern", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it("returns false when localStorage.setItem fails without throwing", () => {
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() =>
      restoreModule.safeRestoreSleevelessExpressBuilderFromPattern(sampleProject().pattern),
    ).not.toThrow();
    expect(
      restoreModule.safeRestoreSleevelessExpressBuilderFromPattern(sampleProject().pattern),
    ).toBe(false);

    setItem.mockRestore();
  });

  it("still writes builder snapshot when restore succeeds", () => {
    const project = sampleProject().pattern;
    localStorage.setItem(PATTERN_STORAGE_KEY, JSON.stringify(project));

    const ok = restoreModule.safeRestoreSleevelessExpressBuilderFromPattern(project);

    expect(ok).toBe(true);
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    expect(raw).toContain('"who":"women"');
  });
});
