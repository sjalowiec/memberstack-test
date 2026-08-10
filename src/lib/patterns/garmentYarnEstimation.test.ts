import { describe, expect, it, vi } from "vitest";
import {
  buildGarmentYarnDimensionsDetail,
  buildGarmentYarnEstimationSnapshot,
  dispatchGarmentYarnDimensions,
  dropShoulderBothSleevesAreaSquareInches,
  garmentBodyFabricAreaSquareInches,
  garmentYarnDimensionsAreValid,
  sleeveInchesFromDropShoulderDebug,
} from "./garmentYarnEstimation";
import {
  estimateYarnWeightWithBuffer,
  YARN_DIMENSIONS_EVENT,
  YARN_REQUIREMENT_BUFFER,
} from "../tools/yarnRequirementDimensions";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sleevelessPatternPage = readFileSync(
  resolve("src/pages/patterns/sleeveless/pattern/index.astro"),
  "utf8",
);
const dropShoulderPatternPage = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/pattern/index.astro"),
  "utf8",
);
const sleevelessBuilderPage = readFileSync(resolve("src/pages/patterns/sleeveless/builder.astro"), "utf8");
const dropShoulderBuilderPage = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/builder.astro"),
  "utf8",
);
const expressBuilderPage = readFileSync(resolve("src/pages/patterns/sleeveless-express.astro"), "utf8");
const sharedPageScript = readFileSync(resolve("src/scripts/sleevelessPatternPageShared.ts"), "utf8");
const editDrawerScript = readFileSync(
  resolve("src/scripts/sleevelessPatternEditDrawerPrototype.ts"),
  "utf8",
);

function sleevelessPattern(overrides: {
  bust?: number;
  length?: number;
  chestOverride?: string;
  lengthOverride?: string;
  mode?: "express" | "custom-build";
} = {}): Record<string, unknown> {
  const bust = overrides.bust ?? 40;
  const length = overrides.length ?? 22;
  const mode = overrides.mode ?? "express";
  return {
    fit: {
      selectedMeasurements: {
        finished_bust_chest: bust,
        back_neck_to_hem: length,
      },
      ...(overrides.chestOverride || overrides.lengthOverride
        ? {
            cbMeasurementOverrides: {
              ...(overrides.chestOverride ? { chestBust: overrides.chestOverride } : {}),
              ...(overrides.lengthOverride ? { finishedLength: overrides.lengthOverride } : {}),
            },
          }
        : {}),
    },
    style: {
      construction: "sleeveless",
      constructionAuthored: "sleeveless",
      patternMode: mode,
      recipientCategory: "misses",
    },
  };
}

function dropShoulderPattern(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedSize: "1",
      selectedMeasurements: {
        finished_bust_chest: 36,
        back_neck_to_hem: 22,
        armhole_depth: 7,
        shoulder_width: 12,
        neck_opening: 6,
        front_neck_depth: 4,
        back_neck_depth: 1,
        upper_arm: 12,
        wrist: 6,
        sleeve_length: 17,
      },
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "misses",
      neckline: "round",
      bodyShape: "straight",
      frontStyle: "closed",
      garmentStyle: "pullover",
      sleeveLength: "long",
      ...overrides,
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

describe("finished sweater How Much Yarn? markup", () => {
  it("shows How Much Yarn on sleeveless and drop-shoulder finished pattern pages", () => {
    for (const page of [sleevelessPatternPage, dropShoulderPatternPage]) {
      expect(page).toContain('data-testid="garment-pattern-how-much-yarn"');
      expect(page).toContain("How Much Yarn?");
      expect(page).toContain("express-yarn-drawer");
      expect(page).toContain("GarmentPatternYarnDrawer");
      expect(page).toContain("yarn-requirement-drawer-shell.css");
    }
  });

  it("places How Much Yarn before Edit Pattern in the finished-pattern action bar", () => {
    for (const page of [sleevelessPatternPage, dropShoulderPatternPage]) {
      const actionsStart = page.indexOf('data-sleeveless-pattern-actions');
      const yarnIdx = page.indexOf('data-testid="garment-pattern-how-much-yarn"', actionsStart);
      const editIdx = page.indexOf('data-testid="button-edit-pattern"', actionsStart);
      expect(actionsStart).toBeGreaterThan(-1);
      expect(yarnIdx).toBeGreaterThan(actionsStart);
      expect(editIdx).toBeGreaterThan(yarnIdx);
    }
  });

  it("hides the yarn action and drawer from print", () => {
    const drawer = readFileSync(
      resolve("src/components/patterns/GarmentPatternYarnDrawer.astro"),
      "utf8",
    );
    expect(drawer).toContain('class="hat-yarn-drawer no-print"');
    for (const page of [sleevelessPatternPage, dropShoulderPatternPage]) {
      expect(page).toContain('class="pattern-action-bar no-print"');
      const yarnBtnSlice = page.slice(
        page.indexOf('id="express-yarn-drawer-open"'),
        page.indexOf("How Much Yarn?") + "How Much Yarn?".length,
      );
      expect(yarnBtnSlice).toContain("no-print");
    }
  });

  it("embeds YarnRequirement with garment drawer variant", () => {
    const drawer = readFileSync(
      resolve("src/components/patterns/GarmentPatternYarnDrawer.astro"),
      "utf8",
    );
    expect(drawer).toContain('variant="garment"');
    expect(drawer).toContain('presentation="drawer"');
    expect(drawer).toContain("YarnRequirement");
  });

  it("does not mount the yarn drawer on builders or inside Edit Pattern markup", () => {
    for (const page of [sleevelessBuilderPage, dropShoulderBuilderPage, expressBuilderPage]) {
      expect(page).not.toContain("GarmentPatternYarnDrawer");
      expect(page).not.toContain("garment-pattern-how-much-yarn");
      expect(page).not.toContain('variant="garment"');
    }
    // Yarn drawer is page-level (after </main>), not nested in the Edit Pattern overlay.
    for (const page of [sleevelessPatternPage, dropShoulderPatternPage]) {
      const editIdx = page.indexOf('data-sl-edit-drawer');
      const yarnIdx = page.indexOf("<GarmentPatternYarnDrawer");
      const mainCloseIdx = page.indexOf("</main>");
      expect(editIdx).toBeGreaterThan(-1);
      expect(yarnIdx).toBeGreaterThan(mainCloseIdx);
      expect(yarnIdx).toBeGreaterThan(editIdx);
      const editSlice = page.slice(editIdx, mainCloseIdx);
      expect(editSlice).not.toContain("GarmentPatternYarnDrawer");
      expect(editSlice).not.toContain("express-yarn-drawer");
    }
    expect(editDrawerScript).not.toContain("dispatchGarmentYarnDimensions");
    expect(editDrawerScript).not.toContain("express-yarn-drawer");
  });

  it("wires drawer init, post-render dispatch, clear-on-failure, and Edit Pattern refresh", () => {
    expect(sharedPageScript).toContain("initGarmentPatternYarnDrawer");
    expect(sharedPageScript).toContain("syncGarmentPatternYarnFromRender");
    expect(sharedPageScript).toContain("dispatchGarmentYarnDimensions");
    expect(sharedPageScript).toContain("setGarmentPatternYarnActionVisible");
    expect(sharedPageScript).toContain("clearGarmentPatternYarnAction");

    // Initial render and Edit Pattern regeneration share refreshPatternTabContent.
    const syncIdx = sharedPageScript.indexOf("syncGarmentPatternYarnFromRender(genInput, unit, result)");
    const renderMountIdx = sharedPageScript.indexOf("await renderMount(");
    expect(syncIdx).toBeGreaterThan(renderMountIdx);

    expect(sharedPageScript.match(/clearGarmentPatternYarnAction\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);

    // Edit Pattern save regenerates via the shared refresh hook (not a separate yarn path).
    expect(editDrawerScript).toContain("kbmRefreshSleevelessPattern");
    expect(sharedPageScript).toContain("window.kbmRefreshSleevelessPattern = refreshPatternTabContent");

    // Opening the drawer re-dispatches the last successful dimensions.
    expect(sharedPageScript).toContain("onOpen:");
    expect(sharedPageScript).toContain("garmentPatternLastYarnPatternData");
  });

  it("starts the How Much Yarn control hidden until dimensions are valid", () => {
    for (const page of [sleevelessPatternPage, dropShoulderPatternPage]) {
      const btnStart = page.indexOf('id="express-yarn-drawer-open"');
      const btnEnd = page.indexOf("</button>", btnStart);
      const btn = page.slice(btnStart, btnEnd);
      expect(btn).toMatch(/\bhidden\b/);
    }
  });
});

describe("garmentYarnEstimation body (sleeveless)", () => {
  it("uses finished bust × garment length for body area", () => {
    const snap = buildGarmentYarnEstimationSnapshot(sleevelessPattern({ bust: 40, length: 22 }));
    expect(snap).not.toBeNull();
    expect(snap!.finishedBustInches).toBe(40);
    expect(snap!.garmentLengthInches).toBe(22);
    expect(snap!.bodyAreaSquareInches).toBe(40 * 22);
    expect(snap!.fabricAreaSquareInches).toBe(40 * 22);
    expect(snap!.includesSleeves).toBe(false);
    expect(garmentBodyFabricAreaSquareInches(40, 22)).toBe(880);
  });

  it("converts display units to cm while keeping area in square inches", () => {
    const snap = buildGarmentYarnEstimationSnapshot(sleevelessPattern({ bust: 40, length: 22 }));
    expect(snap).not.toBeNull();
    const detail = buildGarmentYarnDimensionsDetail(snap!, "cm");
    expect(detail.lengthUnit).toBe("cm");
    expect(detail.projectWidth).toBe(101.6);
    expect(detail.projectLength).toBe(55.9);
    expect(detail.projectAreaSquareInches).toBe(880);
    expect(garmentYarnDimensionsAreValid(detail)).toBe(true);
  });

  it("returns null for missing or invalid dimensions", () => {
    expect(buildGarmentYarnEstimationSnapshot(sleevelessPattern({ bust: 0, length: 22 }))).toBeNull();
    expect(
      buildGarmentYarnEstimationSnapshot({
        fit: { selectedMeasurements: {} },
        style: { construction: "sleeveless", constructionAuthored: "sleeveless" },
      }),
    ).toBeNull();
    expect(garmentYarnDimensionsAreValid(null)).toBe(false);
    expect(
      garmentYarnDimensionsAreValid({
        projectWidth: 0,
        projectLength: 0,
        lengthUnit: "in",
        source: "custom",
        projectAreaSquareInches: 0,
      }),
    ).toBe(false);
  });

  it("honors custom-build effective bust/length overrides", () => {
    const snap = buildGarmentYarnEstimationSnapshot(
      sleevelessPattern({
        bust: 40,
        length: 22,
        mode: "custom-build",
        chestOverride: "44",
        lengthOverride: "24",
      }),
    );
    expect(snap).not.toBeNull();
    expect(snap!.finishedBustInches).toBe(44);
    expect(snap!.garmentLengthInches).toBe(24);
    expect(snap!.fabricAreaSquareInches).toBe(44 * 24);
  });

  it("applies the shared 10% yarn buffer on body area", () => {
    expect(YARN_REQUIREMENT_BUFFER).toBe(1.1);
    const yarn = estimateYarnWeightWithBuffer({
      swatchWidthInches: 4,
      swatchLengthInches: 4,
      swatchWeight: 10,
      projectAreaSquareInches: 880,
    });
    expect(yarn).toBeCloseTo((10 / 16) * 880 * 1.1, 5);
  });

  it("dispatches kbm:yarnDimensions with valid area after a successful sleeveless snapshot", () => {
    class FakeCustomEvent {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    }
    const dispatchEvent = vi.fn();
    vi.stubGlobal("CustomEvent", FakeCustomEvent);
    vi.stubGlobal("window", { dispatchEvent });
    try {
      const detail = dispatchGarmentYarnDimensions(sleevelessPattern({ bust: 40, length: 22 }), "in");
      expect(detail).not.toBeNull();
      expect(detail!.projectAreaSquareInches).toBe(880);
      expect(dispatchEvent).toHaveBeenCalledTimes(1);
      const evt = dispatchEvent.mock.calls[0][0] as FakeCustomEvent;
      expect(evt.type).toBe(YARN_DIMENSIONS_EVENT);
      expect((evt.detail as { projectWidth: number }).projectWidth).toBe(40);
      expect((evt.detail as { projectLength: number }).projectLength).toBe(22);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("dispatches empty dimensions and returns null when snapshot is invalid", () => {
    class FakeCustomEvent {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    }
    const dispatchEvent = vi.fn();
    vi.stubGlobal("CustomEvent", FakeCustomEvent);
    vi.stubGlobal("window", { dispatchEvent });
    try {
      const detail = dispatchGarmentYarnDimensions(
        { fit: { selectedMeasurements: {} }, style: { construction: "sleeveless" } },
        "in",
      );
      expect(detail).toBeNull();
      expect(dispatchEvent).toHaveBeenCalledTimes(1);
      const evt = dispatchEvent.mock.calls[0][0] as FakeCustomEvent;
      const payload = evt.detail as {
        projectWidth: number;
        projectLength: number;
        projectAreaSquareInches?: number;
      };
      expect(payload.projectWidth).toBe(0);
      expect(payload.projectLength).toBe(0);
      expect(garmentYarnDimensionsAreValid(payload as never)).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("garmentYarnEstimation drop-shoulder sleeves", () => {
  it("reads sleeve inches from generator debug and adds trapezoid sleeve area", () => {
    const pattern = dropShoulderPattern();
    const result = generateDropShoulderPattern(pattern);
    const sleeves = sleeveInchesFromDropShoulderDebug(result.debug);
    expect(sleeves).not.toBeNull();
    expect(sleeves!.upperArmInches).toBeGreaterThan(0);
    expect(sleeves!.wristInches).toBeGreaterThan(0);
    expect(sleeves!.sleeveLengthInches).toBeGreaterThan(0);

    const snap = buildGarmentYarnEstimationSnapshot(pattern, {
      dropShoulderDebug: result.debug,
    });
    expect(snap).not.toBeNull();
    expect(snap!.includesSleeves).toBe(true);
    const body = garmentBodyFabricAreaSquareInches(36, 22);
    const sleeveArea = dropShoulderBothSleevesAreaSquareInches(sleeves!);
    expect(snap!.bodyAreaSquareInches).toBe(body);
    expect(snap!.sleeveAreaSquareInches).toBe(sleeveArea);
    expect(snap!.fabricAreaSquareInches).toBe(body + sleeveArea);
    expect(snap!.fabricAreaSquareInches).toBeGreaterThan(body);
  });

  it("documents both-sleeves trapezoid as (upperArm + wrist) × sleeveLength", () => {
    const sleeves = { upperArmInches: 12, wristInches: 6, sleeveLengthInches: 17 };
    // One sleeve = avg width × length; both = (12+6)/2 * 17 * 2 = (12+6)*17
    expect(dropShoulderBothSleevesAreaSquareInches(sleeves)).toBe(18 * 17);
  });

  it("does not ship a body-only estimate when Drop Shoulder sleeve debug is missing", () => {
    expect(buildGarmentYarnEstimationSnapshot(dropShoulderPattern())).toBeNull();
    expect(
      buildGarmentYarnEstimationSnapshot(dropShoulderPattern(), {
        dropShoulderDebug: { dropShoulderUpperArmInches: 12 },
      }),
    ).toBeNull();
  });

  it("counts more yarn for body+sleeves than body alone with the shared buffer", () => {
    const pattern = dropShoulderPattern();
    const result = generateDropShoulderPattern(pattern);
    const snap = buildGarmentYarnEstimationSnapshot(pattern, {
      dropShoulderDebug: result.debug,
    });
    expect(snap).not.toBeNull();
    const swatch = { swatchWidthInches: 4, swatchLengthInches: 4, swatchWeight: 10 };
    const bodyOnly = estimateYarnWeightWithBuffer({
      ...swatch,
      projectAreaSquareInches: snap!.bodyAreaSquareInches,
    });
    const withSleeves = estimateYarnWeightWithBuffer({
      ...swatch,
      projectAreaSquareInches: snap!.fabricAreaSquareInches,
    });
    expect(withSleeves).toBeGreaterThan(bodyOnly);
  });
});
