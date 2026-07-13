import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { buildDropShoulderBodyDiagramReplacements } from "./dropShoulderBodyNotationSvg";
import {
  isCustomBuildDiagramFieldActiveForConstruction,
  isCustomBuildDiagramFieldRenderedOnSummary,
  isDropShoulderDisplayOnlySummaryField,
  isDropShoulderHiddenSummaryField,
} from "./customBuildDiagramFieldPolicy";

describe("customBuildDiagramFieldPolicy", () => {
  it("hides shoulderWidth on drop-shoulder summary but keeps it for sleeveless", () => {
    expect(isDropShoulderHiddenSummaryField("shoulderWidth")).toBe(true);
    expect(isDropShoulderHiddenSummaryField("armholeDepth")).toBe(false);
    expect(isDropShoulderDisplayOnlySummaryField("armholeDepth")).toBe(true);
    expect(isDropShoulderDisplayOnlySummaryField("sleeveLength")).toBe(true);
    expect(isDropShoulderDisplayOnlySummaryField("shoulderWidth")).toBe(false);
  });

  it("makes sleeveLength picker-driven read-only on drop-shoulder builder/review (not editable)", () => {
    const sleeveLength = { key: "sleeveLength", dropShoulderOnly: true };
    expect(isCustomBuildDiagramFieldActiveForConstruction(sleeveLength, true)).toBe(false);
    expect(isCustomBuildDiagramFieldRenderedOnSummary(sleeveLength, true)).toBe(true);
  });

  it("makes sleeveLength editable on the Drop Shoulder Edit Pattern workspace", () => {
    const sleeveLength = { key: "sleeveLength", dropShoulderOnly: true };
    expect(
      isCustomBuildDiagramFieldActiveForConstruction(sleeveLength, true, {
        dropShoulderEditWorkspace: true,
      }),
    ).toBe(true);
    expect(isDropShoulderDisplayOnlySummaryField("sleeveLength", { dropShoulderEditWorkspace: true })).toBe(
      false,
    );
    expect(isDropShoulderDisplayOnlySummaryField("sleeveLength")).toBe(true);
  });

  it("excludes shoulderWidth from active and rendered drop-shoulder fields", () => {
    const shoulder = { key: "shoulderWidth" };
    const armhole = { key: "armholeDepth" };
    const bust = { key: "chestBust" };
    const upperArm = { key: "upperArm", dropShoulderOnly: true };

    expect(isCustomBuildDiagramFieldActiveForConstruction(shoulder, true)).toBe(false);
    expect(isCustomBuildDiagramFieldRenderedOnSummary(shoulder, true)).toBe(false);

    expect(isCustomBuildDiagramFieldActiveForConstruction(armhole, true)).toBe(false);
    expect(isCustomBuildDiagramFieldRenderedOnSummary(armhole, true)).toBe(true);

    expect(isCustomBuildDiagramFieldActiveForConstruction(bust, true)).toBe(true);
    expect(isCustomBuildDiagramFieldRenderedOnSummary(bust, true)).toBe(true);

    expect(isCustomBuildDiagramFieldActiveForConstruction(upperArm, false)).toBe(false);
    expect(isCustomBuildDiagramFieldActiveForConstruction(upperArm, true)).toBe(true);

    expect(isCustomBuildDiagramFieldActiveForConstruction(shoulder, false)).toBe(true);
    expect(isCustomBuildDiagramFieldRenderedOnSummary(shoulder, false)).toBe(true);
  });
});

describe("drop-shoulder cross-shoulder diagram math", () => {
  it("uses finished bust ÷ 2 for cross-shoulder (example: 34.5 → 17.25)", () => {
    const pattern = {
      fit: {
        selectedMeasurements: {
          finished_bust_chest: 34.5,
          back_neck_to_hem: 24,
          upper_arm: 14,
          wrist: 8,
          sleeve_length: 12,
          neck_opening: 7,
          back_neck_depth: 1,
          front_neck_depth: 4,
        },
      },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
      style: {
        construction: "drop-shoulder",
        frontStyle: "closed",
        neckline: "round",
      },
    };

    const result = generateDropShoulderPattern(pattern);
    expect(result.debug.finishedBustChest).toBe(34.5);
    expect(result.debug.backStitches).toBe(86);

    const repl = buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData: pattern,
      measurementPiece: "back",
    });

    expect(34.5 / 2).toBe(17.25);
    expect(repl["cross-shoulder"]).toBe("17.2");
    expect(repl.BUST_WIDTH).toBe("17.3");
    expect(repl["cross-shoulder-width"]).toBe("86");
  });
});
