import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  readActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import * as workflowModule from "./patternReadingWorkflow";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { OPEN_PATTERN_HREF } from "./customPatternProjectNavigation";
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

  it("completes open action with pattern href and active project id", async () => {
    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject(),
    });

    const result = await loadSavedCustomPatternProject(PROJECT_ID, "open");

    expect(result).toEqual({ ok: true, redirectHref: OPEN_PATTERN_HREF });
    expect(readActiveCustomPatternProjectId()).toBe(PROJECT_ID);
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toContain("For Aubrie");
  });

  it("does not call Express builder restore during normal open", async () => {
    const restoreSpy = vi.spyOn(restoreModule, "restoreSleevelessExpressBuilderFromPattern");
    const safeSpy = vi.spyOn(restoreModule, "safeRestoreSleevelessExpressBuilderFromPattern");

    loadCustomPatternProjectMock.mockResolvedValue({
      ok: true,
      project: sampleProject(),
    });

    await loadSavedCustomPatternProject(PROJECT_ID, "open");

    expect(restoreSpy).not.toHaveBeenCalled();
    expect(safeSpy).not.toHaveBeenCalled();
    restoreSpy.mockRestore();
    safeSpy.mockRestore();
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
