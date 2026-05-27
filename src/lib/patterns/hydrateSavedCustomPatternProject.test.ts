import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  expressBuilderMatchesActiveSavedProject,
  hydrateSavedCustomPatternProjectSession,
  promoteExpressBuilderToCanonicalWhenDrifted,
} from "./hydrateSavedCustomPatternProject";
import {
  captureSavedCustomPatternDirtyBaseline,
  hasUnsavedSavedCustomPatternChanges,
} from "./customPatternSavedProjectDirtyState";
import { loadProjectIntoWorkingDraft } from "./customPatternProjectClient";
import {
  PATTERN_STORAGE_KEY,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import * as restoreModule from "./restoreSleevelessExpressBuilderFromPattern";
import { stubLocalStorage } from "./test/stubLocalStorage";

function mensProject(): CustomPatternProject {
  return {
    id: "proj-mens",
    name: "Men's pullover round neck",
    family: "sleeveless",
    source: "express",
    notes: "",
    customOverrides: {},
    createdAt: "t1",
    updatedAt: "t2",
    version: 1,
    pattern: {
      id: "pattern-mens",
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "t1",
      updatedAt: "t1",
      style: {
        patternMode: "express",
        recipientCategory: "men",
        bodyShape: "straight",
        frontStyle: "closed",
        garmentStyle: "pullover",
        neckline: "round",
      },
      fit: { selectedSize: "L", easeChoice: "standard", sizingChart: "men" },
      yarnGauge: { gaugeStitchRaw: "20", gaugeRowRaw: "26" },
      measurements: {},
      machine: {},
      calculations: {},
      instructions: {},
      patternProject: {
        title: "Men's pullover round neck",
        notes: "",
        titleCustomized: true,
      },
    },
  };
}

function kidsExpressBuilderSnapshot(): string {
  return JSON.stringify({
    values: {
      who: "kids",
      selectedSize: "8",
      front: "closed",
      neckline: "round",
      fit: "standard",
      style: "straight-pullover",
      shape: "straight",
    },
    openStep: 5,
    maxReachable: 5,
    flowSteps: 5,
    whoSizeCombined: true,
  });
}

describe("hydrateSavedCustomPatternProjectSession", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("restores Express builder from the saved project and clears false dirty state", () => {
    const restoreSpy = vi.spyOn(restoreModule, "safeRestoreSleevelessExpressBuilderFromPattern");

    loadProjectIntoWorkingDraft(mensProject());
    writeActiveCustomPatternProjectId("proj-mens", mensProject().name);
    localStorage.setItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY, kidsExpressBuilderSnapshot());
    captureSavedCustomPatternDirtyBaseline();

    expect(hasUnsavedSavedCustomPatternChanges()).toBe(false);

    hydrateSavedCustomPatternProjectSession(mensProject());

    expect(restoreSpy).toHaveBeenCalled();
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY) ?? "";
    expect(raw).toContain('"who":"men"');
    expect(raw).not.toContain('"who":"kids"');
    expect(hasUnsavedSavedCustomPatternChanges()).toBe(false);
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toContain("Men's pullover");
  });
});

describe("expressBuilderMatchesActiveSavedProject", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("returns false when wizard who disagrees with the canonical draft", () => {
    hydrateSavedCustomPatternProjectSession(mensProject());
    localStorage.setItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY, kidsExpressBuilderSnapshot());
    expect(expressBuilderMatchesActiveSavedProject()).toBe(false);
  });

  it("returns true when wizard storage matches the open saved project", () => {
    hydrateSavedCustomPatternProjectSession(mensProject());
    expect(expressBuilderMatchesActiveSavedProject()).toBe(true);
  });
});

describe("promoteExpressBuilderToCanonicalWhenDrifted", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("syncs wizard ahead of canonical when both differ and wizard has who + size", () => {
    hydrateSavedCustomPatternProjectSession(mensProject());
    localStorage.setItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY, kidsExpressBuilderSnapshot());

    expect(promoteExpressBuilderToCanonicalWhenDrifted()).toBe(true);
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY) ?? "";
    expect(raw).toContain('"who":"kids"');
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toContain('"recipientCategory":"kids"');
  });
});
