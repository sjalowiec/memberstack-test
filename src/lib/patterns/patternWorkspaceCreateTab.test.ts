import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import { loadProjectIntoWorkingDraft } from "./customPatternProjectClient";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { resetSessionForPatternWorkspaceCreateTab } from "./patternWorkspaceCreateTab";
import { syncExpressWizardToPatternStorage } from "./syncExpressWizardToPatternStorage";
import {
  getCurrentPattern,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { loadMeasurementOverrides } from "./sleevelessCustomMeasurementStorage";
import {
  computeDefaultMeasurementsFromChartRow,
  type ChartRow,
} from "./sleevelessExpressSizeChartClient";
import { buildCustomBuildEffectivePatternInput } from "./buildCustomBuildEffectivePatternInput";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { prepareCustomBuildPatternGeneration } from "./prepareCustomBuildPatternGeneration";
import missesChartRows from "../../../public/data/sizing_sweaters_misses.json";

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
        },
        cbMeasurementOverrides: { chestBust: "26", finishedLength: "16" },
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

function seedSavedExpressSessionWithGauge(): void {
  writeActiveCustomPatternProjectId("proj-gauge-test", "Gauge Test Vest");
  localStorage.setItem(
    SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
    JSON.stringify({
      values: {
        who: "women",
        selectedSize: "36",
        front: "closed",
        neckline: "round",
        fit: "standard",
        style: "straight-pullover",
        shape: "straight",
      },
      gaugeStitchRaw: "24",
      gaugeRowRaw: "32",
      cbMeasurementOverrides: { chestBust: "42", hip: "40" },
      flowSteps: 5,
      whoSizeCombined: true,
    }),
  );
  syncExpressWizardToPatternStorage(
    {
      who: "women",
      selectedSize: "36",
      front: "closed",
      neckline: "round",
      fit: "standard",
      style: "straight-pullover",
    },
    null,
    { preferDomGauge: false },
  );
}

describe("pattern workspace Create tab wiring", () => {
  it("delegates Create tab clicks to startNewCustomPatternFromWorkspace", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, "patternWorkspaceCreateTab.ts"), "utf-8");
    expect(src).toContain("startNewCustomPatternFromWorkspace");
    expect(src).toContain("PATTERN_WORKSPACE_EXPRESS_TAB_SELECTOR");
    expect(src).toContain("event.preventDefault()");
  });

  it("is initialized from the pattern workspace library drawer bundle", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      join(dir, "../../components/patterns/PatternWorkspaceLibraryDrawer.astro"),
      "utf-8",
    );
    expect(src).toContain("initPatternWorkspaceCreateTab");
  });
});

describe("pattern workspace Create tab session reset", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("clears express gauge snapshot after entering Create (saved session with gauge)", () => {
    seedSavedExpressSessionWithGauge();
    expect(
      JSON.parse(localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY)!).gaugeStitchRaw,
    ).toBe("24");

    resetSessionForPatternWorkspaceCreateTab();

    expect(localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY)).toBeNull();
    const yg = getCurrentPattern().yarnGauge as Record<string, unknown>;
    expect(yg.stitchGauge).toBeFalsy();
    expect(yg.rowGauge).toBeFalsy();
  });

  it("after child build, entering Create then women size 8 uses misses chart measurements", () => {
    loadProjectIntoWorkingDraft(childProject());
    writeActiveCustomPatternProjectId("proj-child-8", childProject().name);
    const childFit = getCurrentPattern().fit as Record<string, unknown>;
    const childMeas = childFit.selectedMeasurements as Record<string, number>;
    expect(childFit.sizingChart).toBe("kids");
    expect(childMeas.finished_bust_chest).toBe(26);

    resetSessionForPatternWorkspaceCreateTab();

    const missesSize8 = (missesChartRows as ChartRow[]).find((row) => String(row.size) === "8");
    expect(missesSize8).toBeTruthy();
    const chartFit = {
      selectedSize: "8",
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(missesSize8!, "standard", {
        bodyShape: "aline",
      }),
    };

    syncExpressWizardToPatternStorage(
      {
        who: "women",
        selectedSize: "8",
        front: "open",
        neckline: "round",
        fit: "standard",
        style: "shaped-cardigan",
      },
      chartFit,
      { preferDomGauge: false },
    );

    prepareCustomBuildPatternGeneration({ rehydrateSavedProject: false });
    const genInput = buildCustomBuildEffectivePatternInput();
    const result = generateSleevelessBackPattern(genInput);
    const fit = genInput.fit as Record<string, unknown>;
    const style = genInput.style as Record<string, unknown>;

    expect(style.recipientCategory).toBe("misses");
    expect(fit.sizingChart).toBe("misses");
    const selected = fit.selectedMeasurements as Record<string, number> | undefined;
    expect(Number(selected?.finished_bust_chest ?? 0)).toBeGreaterThan(30);
    expect(result.debug).toBeDefined();
  });

  it("clears active saved project identity so the next save does not overwrite", () => {
    loadProjectIntoWorkingDraft(childProject());
    writeActiveCustomPatternProjectId("proj-child-8", childProject().name);

    resetSessionForPatternWorkspaceCreateTab();

    expect(readActiveCustomPatternProjectId()).toBe("");
  });

  it("clears cbMeasurementOverrides and express builder storage on Create entry", () => {
    seedSavedExpressSessionWithGauge();
    expect(loadMeasurementOverrides().chestBust).toBeDefined();

    resetSessionForPatternWorkspaceCreateTab();

    expect(localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY)).toBeNull();
    expect(loadMeasurementOverrides().chestBust).toBeUndefined();
    expect(loadMeasurementOverrides().hip).toBeUndefined();
    const fit = getCurrentPattern().fit as Record<string, unknown>;
    expect(
      (fit.cbMeasurementOverrides as Record<string, string> | undefined)?.chestBust,
    ).toBeUndefined();
  });
});
