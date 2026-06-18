import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  loadProjectIntoWorkingDraft,
  savedProjectHasAuthoritativeDropShoulderConstruction,
  savedProjectHasCorruptedSleevelessConstruction,
  shouldBlockDropShoulderConstructionSaveToActiveProject,
} from "./customPatternProjectClient";
import {
  CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  HYDRATED_PROJECT_CONSTRUCTION_BASELINE_KEY,
  writeHydratedConstructionBaseline,
} from "./customPatternProjectConstructionBaseline";
import {
  CONSTRUCTION_AUTHORED_KEY,
  CONSTRUCTION_FAMILY_OVERRIDE_KEY,
  DROP_SHOULDER_CONSTRUCTION,
  hasAuthoritativeDropShoulderConstruction,
  isCorruptedSleevelessConstruction,
  preparePatternRecordForSave,
  sanitizeSavedProjectForHydration,
  withDropShoulderConstructionAuthored,
} from "./patternConstructionIdentity";
import {
  isDropShoulderConstruction,
  resolveMeasurementBlueprintSvgUrl,
  DROP_SHOULDER_MEASUREMENT_BLUEPRINT_SVG_URL,
  SLEEVELESS_MEASUREMENT_BLUEPRINT_SVG_URL,
} from "./measurementBlueprintSvgUrl";
import {
  getCurrentPattern,
  getPatternData,
  PATTERN_BUILDER_DATA_KEY,
  PATTERN_STORAGE_KEY,
  saveCurrentPattern,
  savePatternData,
} from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";

vi.mock("./patternReadingWorkflow", () => ({
  applySleevelessReadingWorkflow: vi.fn(),
}));

const SLEEVELESS_PROJECT_ID = "proj-sleeveless-aubrie";

function stubSessionStorage(): void {
  const store: Record<string, string> = {};
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  });
}

function legacySleevelessStyle() {
  return {
    recipientCategory: "misses",
    bodyShape: "aline",
    frontStyle: "open",
    garmentStyle: "cardigan",
    neckline: "v",
    patternMode: "express",
  };
}

function sampleProject(overrides: Partial<CustomPatternProject> = {}): CustomPatternProject {
  return {
    id: SLEEVELESS_PROJECT_ID,
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
      style: legacySleevelessStyle(),
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

function seedDropShoulderWorkingDraft(): void {
  const style = withDropShoulderConstructionAuthored({}, "long");
  saveCurrentPattern({ style });
  savePatternData("style", style);
}

describe("pattern construction identity regressions", () => {
  beforeEach(() => {
    stubLocalStorage();
    stubSessionStorage();
    vi.clearAllMocks();
  });

  it("1. loading legacy sleeveless after a drop-shoulder working draft does not retain drop-shoulder construction", () => {
    seedDropShoulderWorkingDraft();
    expect(isDropShoulderConstruction()).toBe(true);

    loadProjectIntoWorkingDraft(sampleProject());

    const canonStyle = getCurrentPattern().style as Record<string, unknown>;
    const pbStyle = (getPatternData().style ?? {}) as Record<string, unknown>;
    expect(canonStyle.construction).toBeUndefined();
    expect(canonStyle[CONSTRUCTION_AUTHORED_KEY]).toBeUndefined();
    expect(canonStyle.sleeveDirection).toBeUndefined();
    expect(pbStyle.construction).toBeUndefined();
    expect(isDropShoulderConstruction()).toBe(false);
    expect(resolveMeasurementBlueprintSvgUrl()).toBe(SLEEVELESS_MEASUREMENT_BLUEPRINT_SVG_URL);
  });

  it("2. updating with drop-shoulder draft drift is blocked for the previous sleeveless active project id", () => {
    seedDropShoulderWorkingDraft();
    writeActiveCustomPatternProjectId(SLEEVELESS_PROJECT_ID, "For Aubrie");
    writeHydratedConstructionBaseline(sampleProject());

    expect(localStorage.getItem(CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY)).toBe(SLEEVELESS_PROJECT_ID);
    expect(shouldBlockDropShoulderConstructionSaveToActiveProject()).toBe(true);
  });

  it("3. a sleeveless saved project with no construction renders sleeveless diagrams", () => {
    loadProjectIntoWorkingDraft(sampleProject());

    expect(savedProjectHasCorruptedSleevelessConstruction(sampleProject())).toBe(false);
    expect(savedProjectHasAuthoritativeDropShoulderConstruction(sampleProject())).toBe(false);
    expect(isDropShoulderConstruction()).toBe(false);
    expect(resolveMeasurementBlueprintSvgUrl()).toBe(SLEEVELESS_MEASUREMENT_BLUEPRINT_SVG_URL);
  });

  it("4. a valid drop-shoulder saved project renders drop-shoulder diagrams", () => {
    const validDropShoulder = sampleProject({
      customOverrides: { [CONSTRUCTION_FAMILY_OVERRIDE_KEY]: DROP_SHOULDER_CONSTRUCTION },
      pattern: {
        ...sampleProject().pattern,
        style: withDropShoulderConstructionAuthored(legacySleevelessStyle(), "long"),
      },
    });

    loadProjectIntoWorkingDraft(validDropShoulder);

    expect(savedProjectHasAuthoritativeDropShoulderConstruction(validDropShoulder)).toBe(true);
    expect(isDropShoulderConstruction()).toBe(true);
    expect(resolveMeasurementBlueprintSvgUrl()).toBe(DROP_SHOULDER_MEASUREMENT_BLUEPRINT_SVG_URL);
  });

  it("5. sleeveless-shaped blob with accidental construction is corrected unless it has authoritative markers", () => {
    const corrupted = sampleProject({
      pattern: {
        ...sampleProject().pattern,
        style: {
          ...legacySleevelessStyle(),
          construction: DROP_SHOULDER_CONSTRUCTION,
          sleeveDirection: "cuff-up",
          sleeveLength: "long",
        },
      },
    });

    expect(isCorruptedSleevelessConstruction(corrupted.pattern, corrupted.customOverrides)).toBe(true);
    expect(savedProjectHasCorruptedSleevelessConstruction(corrupted)).toBe(true);

    const sanitized = sanitizeSavedProjectForHydration(corrupted);
    expect((sanitized.pattern.style as Record<string, unknown>).construction).toBeUndefined();

    loadProjectIntoWorkingDraft(corrupted);
    expect(isDropShoulderConstruction()).toBe(false);

    const authored = sampleProject({
      customOverrides: { [CONSTRUCTION_FAMILY_OVERRIDE_KEY]: DROP_SHOULDER_CONSTRUCTION },
      pattern: {
        ...corrupted.pattern,
        style: {
          ...legacySleevelessStyle(),
          construction: DROP_SHOULDER_CONSTRUCTION,
          sleeveDirection: "cuff-up",
          sleeveLength: "long",
        },
      },
    });
    expect(isCorruptedSleevelessConstruction(authored.pattern, authored.customOverrides)).toBe(false);
    expect(hasAuthoritativeDropShoulderConstruction(authored.pattern.style, authored.customOverrides)).toBe(
      true,
    );
  });

  it("preparePatternRecordForSave strips accidental drop-shoulder keys when not allowDropShoulder", () => {
    const accidental = {
      ...getCurrentPattern(),
      style: {
        construction: DROP_SHOULDER_CONSTRUCTION,
        sleeveDirection: "cuff-up",
        sleeveLength: "long",
      },
    };
    const stripped = preparePatternRecordForSave(accidental, { allowDropShoulder: false });
    expect((stripped.style as Record<string, unknown>).construction).toBeUndefined();
  });

  it("hydration baseline is written when loading a saved project", () => {
    loadProjectIntoWorkingDraft(sampleProject());
    const raw = sessionStorage.getItem(HYDRATED_PROJECT_CONSTRUCTION_BASELINE_KEY);
    expect(raw).toBeTruthy();
    const baseline = JSON.parse(raw!);
    expect(baseline.projectId).toBe(SLEEVELESS_PROJECT_ID);
    expect(baseline.hadAuthoritativeDropShoulder).toBe(false);
  });

  it("replace hydration does not shallow-merge prior draft sections from localStorage", () => {
    seedDropShoulderWorkingDraft();
    localStorage.setItem(
      PATTERN_STORAGE_KEY,
      JSON.stringify({
        ...getCurrentPattern(),
        fit: { selectedSize: "L", easeChoice: "loose", strayField: "stale" },
      }),
    );
    localStorage.setItem(
      PATTERN_BUILDER_DATA_KEY,
      JSON.stringify({
        style: withDropShoulderConstructionAuthored({}, "short"),
        fit: { selectedSize: "L", strayField: "stale" },
      }),
    );

    loadProjectIntoWorkingDraft(sampleProject());

    const fit = getCurrentPattern().fit as Record<string, unknown>;
    expect(fit.selectedSize).toBe("M");
    expect(fit.strayField).toBeUndefined();
    expect(isDropShoulderConstruction()).toBe(false);
  });
});
