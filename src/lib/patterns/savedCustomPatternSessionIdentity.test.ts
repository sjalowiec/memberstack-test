import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import { loadProjectIntoWorkingDraft } from "./customPatternProjectClient";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { captureSavedCustomPatternDirtyBaseline } from "./customPatternSavedProjectDirtyState";
import {
  buildSizingIdentityFromCanonicalDraft,
  buildSizingIdentityFromExpressValues,
  detachActiveSavedProjectWhenChartAudienceDrifts,
  hasChartAudienceDrift,
  readSavedSizingIdentityBaseline,
  sizingIdentityEquals,
} from "./savedCustomPatternSessionIdentity";
import {
  expressBuilderMatchesActiveSavedProject,
  promoteExpressBuilderToCanonicalWhenDrifted,
} from "./hydrateSavedCustomPatternProject";
import { smartSaveCustomPatternProject } from "./customPatternSavedProjectsPanel";
import { buildCustomBuildEffectivePatternInput } from "./buildCustomBuildEffectivePatternInput";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { prepareCustomBuildPatternGeneration } from "./prepareCustomBuildPatternGeneration";
import { applyStartNewCustomPatternSession } from "./startNewCustomPatternWorkflow";
import { syncExpressWizardToPatternStorage } from "./syncExpressWizardToPatternStorage";
import {
  getCurrentPattern,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { startFreshSleevelessExpressPattern } from "./sleevelessExpressFreshStart";

vi.mock("./customPatternProjectClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./customPatternProjectClient")>();
  return {
    ...actual,
    createCustomPatternProject: vi.fn(),
    updateCustomPatternProject: vi.fn(),
    buildSavePayloadFromWorkingDraft: vi.fn((name: string) => ({
      name,
      notes: "",
      family: "sleeveless",
      source: "express",
      pattern: getCurrentPattern(),
      customOverrides: {},
    })),
  };
});

import {
  createCustomPatternProject,
  updateCustomPatternProject,
} from "./customPatternProjectClient";

function childProject(): CustomPatternProject {
  return {
    id: "proj-child-8",
    name: "Child Age 8 Cardigan",
    family: "sleeveless",
    source: "express",
    notes: "",
    customOverrides: {},
    createdAt: "t1",
    updatedAt: "t1",
    version: 1,
    pattern: {
      id: "pat-child",
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "t1",
      updatedAt: "t1",
      style: {
        patternMode: "express",
        recipientCategory: "kids",
        bodyShape: "aline",
        frontStyle: "open",
        garmentStyle: "cardigan",
        neckline: "round",
      },
      fit: {
        selectedSize: "8",
        easeChoice: "standard",
        sizingChart: "kids",
        selectedMeasurements: {
          finished_bust_chest: 26,
          back_neck_to_hem: 16,
          armhole_depth: 6,
          neck_opening: 2.5,
          shoulder_width: 3,
          front_neck_depth: 2.5,
          back_neck_depth: 0.75,
        },
      },
      yarnGauge: { stitchGauge: "6", rowGauge: "8", gaugeRawUnit: "in" },
      measurements: {},
      machine: { availableNeedles: "200" },
      calculations: {},
      instructions: {},
      patternProject: {
        title: "Child Age 8 Cardigan",
        notes: "",
        titleCustomized: true,
      },
    },
  };
}

function ladiesExpressBuilderSnapshot(): string {
  return JSON.stringify({
    values: {
      who: "women",
      selectedSize: "8",
      front: "open",
      neckline: "round",
      fit: "standard",
      style: "shaped-cardigan",
      shape: "aline",
    },
    openStep: 5,
    maxReachable: 5,
    flowSteps: 5,
    whoSizeCombined: true,
    gaugeStitchRaw: "24",
    gaugeRowRaw: "32",
  });
}

describe("saved custom pattern sizing identity", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("treats child and ladies size 8 as distinct identities", () => {
    const child = { chartAudience: "kids", selectedSize: "8" };
    const ladies = { chartAudience: "misses", selectedSize: "8" };
    expect(sizingIdentityEquals(child, ladies)).toBe(false);
  });

  it("detects chart audience drift but not same-chart size change", () => {
    const baseline = { chartAudience: "kids", selectedSize: "8" };
    expect(
      hasChartAudienceDrift(baseline, { chartAudience: "misses", selectedSize: "8" }),
    ).toBe(true);
    expect(
      hasChartAudienceDrift(baseline, { chartAudience: "kids", selectedSize: "10" }),
    ).toBe(false);
  });

  it("detaches the active saved project when audience changes from kids to misses", () => {
    loadProjectIntoWorkingDraft(childProject());
    writeActiveCustomPatternProjectId("proj-child-8", "Child Age 8 Cardigan");
    captureSavedCustomPatternDirtyBaseline();
    expect(readSavedSizingIdentityBaseline()).toEqual({
      chartAudience: "kids",
      selectedSize: "8",
    });

    const detached = detachActiveSavedProjectWhenChartAudienceDrifts({
      chartAudience: "misses",
      selectedSize: "8",
    });

    expect(detached).toBe(true);
    expect(readActiveCustomPatternProjectId()).toBe("");
  });

  it("keeps the active project when only size changes within the same chart", () => {
    loadProjectIntoWorkingDraft(childProject());
    writeActiveCustomPatternProjectId("proj-child-8", "Child Age 8 Cardigan");
    captureSavedCustomPatternDirtyBaseline();

    expect(
      detachActiveSavedProjectWhenChartAudienceDrifts({
        chartAudience: "kids",
        selectedSize: "10",
      }),
    ).toBe(false);
    expect(readActiveCustomPatternProjectId()).toBe("proj-child-8");
  });

  it("keeps the active project when canonical draft still matches baseline chart", () => {
    loadProjectIntoWorkingDraft(childProject());
    writeActiveCustomPatternProjectId("proj-child-8", "Child Age 8 Cardigan");
    captureSavedCustomPatternDirtyBaseline();

    const identity = buildSizingIdentityFromCanonicalDraft();
    expect(identity).toEqual({ chartAudience: "kids", selectedSize: "8" });
    expect(detachActiveSavedProjectWhenChartAudienceDrifts(identity)).toBe(false);
    expect(readActiveCustomPatternProjectId()).toBe("proj-child-8");
  });
});

describe("child then ladies express drift", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("promotes ladies size 8 wizard choices into canonical storage for generation", () => {
    loadProjectIntoWorkingDraft(childProject());
    writeActiveCustomPatternProjectId("proj-child-8", childProject().name);
    captureSavedCustomPatternDirtyBaseline();
    localStorage.setItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY, ladiesExpressBuilderSnapshot());

    expect(expressBuilderMatchesActiveSavedProject()).toBe(false);
    expect(promoteExpressBuilderToCanonicalWhenDrifted()).toBe(true);

    const style = getCurrentPattern().style as Record<string, unknown>;
    const fit = getCurrentPattern().fit as Record<string, unknown>;
    expect(style.recipientCategory).toBe("misses");
    expect(fit.selectedSize).toBe("8");
    expect(fit.sizingChart).toBe("misses");
    expect(readActiveCustomPatternProjectId()).toBe("");
  });

  it("generates with adult chart audience after child saved project and ladies wizard", () => {
    loadProjectIntoWorkingDraft(childProject());
    writeActiveCustomPatternProjectId("proj-child-8", childProject().name);
    captureSavedCustomPatternDirtyBaseline();
    localStorage.setItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY, ladiesExpressBuilderSnapshot());

    syncExpressWizardToPatternStorage(
      {
        who: "women",
        selectedSize: "8",
        front: "open",
        neckline: "round",
        fit: "standard",
        style: "shaped-cardigan",
      },
      {
        selectedSize: "8",
        selectedMeasurements: {
          finished_bust_chest: 34,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          neck_opening: 3,
          shoulder_width: 4.25,
          front_neck_depth: 3,
          back_neck_depth: 1,
        },
      },
      { preferDomGauge: false },
    );

    prepareCustomBuildPatternGeneration({ rehydrateSavedProject: true });
    const genInput = buildCustomBuildEffectivePatternInput();
    const result = generateSleevelessBackPattern(genInput);
    const fit = genInput.fit as Record<string, unknown>;
    const style = genInput.style as Record<string, unknown>;

    expect(style.recipientCategory).toBe("misses");
    expect(fit.sizingChart).toBe("misses");
    expect(result.debug).toBeDefined();
    const selected = fit.selectedMeasurements as Record<string, number> | undefined;
    expect(Number(selected?.finished_bust_chest ?? 0)).toBeGreaterThan(30);
  });

  it("save new project after ladies drift creates a record and does not update the child project", async () => {
    loadProjectIntoWorkingDraft(childProject());
    writeActiveCustomPatternProjectId("proj-child-8", childProject().name);
    captureSavedCustomPatternDirtyBaseline();
    localStorage.setItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY, ladiesExpressBuilderSnapshot());

    syncExpressWizardToPatternStorage(
      {
        who: "women",
        selectedSize: "8",
        front: "open",
        neckline: "round",
        fit: "standard",
        style: "shaped-cardigan",
      },
      null,
      { preferDomGauge: false },
    );

    vi.mocked(createCustomPatternProject).mockResolvedValue({
      ok: true,
      project: {
        ...childProject(),
        id: "proj-ladies-8",
        name: "Adult Ladies Size 8 Cardigan",
        pattern: {
          ...childProject().pattern,
          style: { ...childProject().pattern.style, recipientCategory: "misses" },
          fit: { ...childProject().pattern.fit, sizingChart: "misses" },
          patternProject: {
            title: "Adult Ladies Size 8 Cardigan",
            notes: "",
            titleCustomized: true,
          },
        },
      },
    });

    const res = await smartSaveCustomPatternProject({
      mode: "create",
      resolveName: () => "Adult Ladies Size 8 Cardigan",
    });

    expect(res.ok).toBe(true);
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
    expect(createCustomPatternProject).toHaveBeenCalled();
    expect(readActiveCustomPatternProjectId()).toBe("proj-ladies-8");
  });
});

describe("start new pattern session identity", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("clears active saved project id when starting a fresh express session", () => {
    writeActiveCustomPatternProjectId("proj-child-8", "Child Age 8 Cardigan");
    captureSavedCustomPatternDirtyBaseline();
    startFreshSleevelessExpressPattern();
    expect(readActiveCustomPatternProjectId()).toBe("");
  });

  it("clears active saved project id via applyStartNewCustomPatternSession", () => {
    writeActiveCustomPatternProjectId("proj-child-8", "Child Age 8 Cardigan");
    applyStartNewCustomPatternSession();
    expect(readActiveCustomPatternProjectId()).toBe("");
  });
});

describe("buildSizingIdentityFromExpressValues", () => {
  it("maps women who to misses chart audience", () => {
    expect(
      buildSizingIdentityFromExpressValues({ who: "women", selectedSize: "8" }),
    ).toEqual({ chartAudience: "misses", selectedSize: "8" });
  });
});
