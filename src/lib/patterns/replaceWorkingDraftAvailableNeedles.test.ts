import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { loadProjectIntoWorkingDraft } from "./customPatternProjectClient";
import {
  CONSTRUCTION_FAMILY_OVERRIDE_KEY,
  DROP_SHOULDER_CONSTRUCTION,
  withDropShoulderConstructionAuthored,
} from "./patternConstructionIdentity";
import {
  ensureSavedCustomPatternSessionHydratedOnPatternPage,
  hydrateSavedCustomPatternProjectSession,
} from "./hydrateSavedCustomPatternProject";
import { OPEN_PATTERN_HREF } from "./customPatternProjectNavigation";
import { validatePatternBuilderRequired } from "./patternBuilderValidation";
import { prepareCustomBuildPatternGeneration } from "./prepareCustomBuildPatternGeneration";
import { getCurrentPattern, getPatternData } from "./patternStorage";
import { loadExpressPersisted } from "./sleevelessExpressResume";
import { stubLocalStorage } from "./test/stubLocalStorage";

vi.mock("./patternReadingWorkflow", () => ({
  applySleevelessReadingWorkflow: vi.fn(),
}));

function dropShoulderSavedProject(availableNeedles: string | number): CustomPatternProject {
  return {
    id: "proj-ds",
    name: "Drop shoulder test",
    family: "sleeveless",
    source: "express",
    notes: "",
    customOverrides: { [CONSTRUCTION_FAMILY_OVERRIDE_KEY]: DROP_SHOULDER_CONSTRUCTION },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    version: 1,
    pattern: {
      id: "pattern-ds",
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      style: withDropShoulderConstructionAuthored(
        {
          recipientCategory: "misses",
          bodyShape: "straight",
          frontStyle: "closed",
          garmentStyle: "pullover",
          neckline: "round",
          patternMode: "express",
        },
        "long",
      ),
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
      patternProject: { title: "Drop shoulder test", notes: "", titleCustomized: true },
    },
  };
}

describe("saved drop-shoulder hydration — availableNeedles mirrors", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("mirrors machine.availableNeedles into all builder stores and passes validation after edit prep", () => {
    loadProjectIntoWorkingDraft(dropShoulderSavedProject("220"));

    expect(String(getCurrentPattern().machine.availableNeedles)).toBe("220");
    expect(String((getPatternData().machine as Record<string, unknown>).availableNeedles)).toBe("220");
    expect(String((getPatternData().yarnGaugeMachine as Record<string, unknown>).availableNeedles)).toBe(
      "220",
    );

    prepareCustomBuildPatternGeneration({ rehydrateSavedProject: false });

    expect(String((getPatternData().yarnGaugeMachine as Record<string, unknown>).availableNeedles)).toBe(
      "220",
    );

    const validation = validatePatternBuilderRequired(getPatternData());
    expect(validation.missingItems.some((item) => item.id === "availableNeedles")).toBe(false);
  });

  it("hydrateSavedCustomPatternProjectSession restores Express wizard snapshot needles", () => {
    hydrateSavedCustomPatternProjectSession(dropShoulderSavedProject(198), {
      editChoicesReopen: true,
    });

    const persisted = loadExpressPersisted();
    expect(persisted?.availableNeedles).toBe("198");
  });

  it("mirrors when only canonical machine has needles (legacy yarnGaugeMachine mirror missing)", () => {
    const project = dropShoulderSavedProject("176");
    loadProjectIntoWorkingDraft(project);

    // Simulate stale mirror: machine section populated, yarnGaugeMachine dropped.
    const pb = getPatternData();
    const { yarnGaugeMachine: _drop, ...pbWithoutYgm } = pb;
    localStorage.setItem("patternBuilderData", JSON.stringify(pbWithoutYgm));

    loadProjectIntoWorkingDraft(project);

    expect(String((getPatternData().yarnGaugeMachine as Record<string, unknown>).availableNeedles)).toBe(
      "176",
    );
    expect(
      validatePatternBuilderRequired(getPatternData()).missingItems.some((i) => i.id === "availableNeedles"),
    ).toBe(false);
  });

  it("re-mirrors needles on shared /patterns/sleeveless/pattern/ workspace after stale builder mirrors", () => {
    hydrateSavedCustomPatternProjectSession(dropShoulderSavedProject("214"), { editChoicesReopen: true });

    const pb = getPatternData();
    localStorage.setItem(
      "patternBuilderData",
      JSON.stringify({
        ...pb,
        machine: { ...(pb.machine as Record<string, unknown>), availableNeedles: "" },
        yarnGaugeMachine: { ...(pb.yarnGaugeMachine as Record<string, unknown>), availableNeedles: "" },
      }),
    );
    localStorage.setItem(
      "kbm_sleeveless_express_builder",
      JSON.stringify({
        ...(JSON.parse(localStorage.getItem("kbm_sleeveless_express_builder") ?? "{}") as object),
        availableNeedles: "",
      }),
    );

    ensureSavedCustomPatternSessionHydratedOnPatternPage();

    expect(String(getCurrentPattern().machine.availableNeedles)).toBe("214");
    expect(String((getPatternData().machine as Record<string, unknown>).availableNeedles)).toBe("214");
    expect(String((getPatternData().yarnGaugeMachine as Record<string, unknown>).availableNeedles)).toBe(
      "214",
    );
    expect(loadExpressPersisted()?.availableNeedles).toBe("214");
    expect(
      validatePatternBuilderRequired(getPatternData()).missingItems.some((i) => i.id === "availableNeedles"),
    ).toBe(false);
    expect(OPEN_PATTERN_HREF).toBe("/patterns/sleeveless/pattern/");
  });
});
