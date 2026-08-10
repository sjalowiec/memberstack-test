import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateHatPattern } from "./hatMath";
import {
  buildHatYarnDimensionsDetail,
  buildHatYarnEstimationSnapshot,
  hatBrimFabricLayerCount,
  hatBrimKnittedDepthInches,
  hatCrownYarnEquivalentHeightInches,
  hatYarnFabricAreaSquareInches,
} from "./hatYarnEstimation";
import { estimateYarnWeightWithBuffer } from "../../tools/yarnRequirementDimensions";

const patternPage = readFileSync(resolve("src/pages/patterns/hat/pattern.astro"), "utf8");
const pageScript = readFileSync(resolve("src/scripts/hat-pattern-page.ts"), "utf8");

const baseInput = {
  finishedHatCircInches: 20.5,
  stitchGaugeDisplay: 5,
  rowGaugeDisplay: 7,
  displayUnit: "inches" as const,
  totalHatLengthInches: 11,
  brimDepthInches: 2,
  suggestedCrownDepthInches: 2,
  fit: "watchcap",
  crown: "gathered" as const,
};

function calcWith(
  overrides: Partial<typeof baseInput> & { brimType: "rolled" | "single" | "folded"; crown?: string },
) {
  return calculateHatPattern({ ...baseInput, ...overrides });
}

describe("finished hat How Much Yarn? markup", () => {
  it("shows the How Much Yarn control on the completed hat pattern page", () => {
    expect(patternPage).toContain('data-testid="hat-pattern-how-much-yarn"');
    expect(patternPage).toContain("How Much Yarn?");
    expect(patternPage).toContain("express-yarn-drawer");
    expect(patternPage).toContain('variant="hat"');
    expect(patternPage).toContain("YarnRequirement");
  });

  it("does not gate yarn estimation on membership or a saved pattern ID", () => {
    expect(patternPage).toMatch(/Finished Hat Pattern page \(free \/ ungated\)/);
    expect(patternPage).not.toContain("SleevelessPatternMemberGate");
    expect(patternPage).not.toContain("patternId");
    expect(pageScript).toContain("dispatchHatYarnDimensions");
    expect(pageScript).toContain("initHatPatternYarnDrawer");
  });
});

describe("hatYarnEstimation fabric area", () => {
  it("supplies finished circumference and length to the yarn dimensions payload", () => {
    const calc = calcWith({ brimType: "single" });
    const detail = buildHatYarnDimensionsDetail(calc, "in");
    expect(detail.projectWidth).toBe(20.5);
    expect(detail.projectLength).toBe(11);
    expect(detail.lengthUnit).toBe("in");
    expect(detail.source).toBe("custom");
    expect(detail.projectAreaSquareInches).toBeGreaterThan(0);
    expect(detail.projectAreaSquareInches).toBe(hatYarnFabricAreaSquareInches(calc));
  });

  it("works from an in-memory calc without a saved pattern ID", () => {
    const calc = calcWith({ brimType: "single" });
    const snap = buildHatYarnEstimationSnapshot(calc);
    expect(snap.finishedCircumferenceInches).toBe(calc.targetWidth);
    expect(snap.finishedLengthInches).toBe(calc.hatHeight);
    expect(snap.fabricAreaSquareInches).toBeGreaterThan(0);
  });

  it("folded / doubled brim produces more fabric area than an otherwise identical single-layer brim", () => {
    const single = calcWith({ brimType: "single" });
    const folded = calcWith({ brimType: "folded" });
    const singleArea = hatYarnFabricAreaSquareInches(single);
    const foldedArea = hatYarnFabricAreaSquareInches(folded);
    expect(folded.brimRows).toBe(single.brimRows * 2);
    expect(foldedArea).toBeGreaterThan(singleArea);
    // Extra area ≈ circumference × extra brim depth (visible depth once more)
    const delta = foldedArea - singleArea;
    expect(delta).toBeCloseTo(20.5 * (folded.brimRows - single.brimRows) / folded.rowGaugePerInch, 5);
  });

  it("hung hem includes its hidden fabric (same doubled layer model as folded hem)", () => {
    expect(hatBrimFabricLayerCount("hung-hem")).toBe(2);
    expect(hatBrimFabricLayerCount("folded")).toBe(2);
    expect(hatBrimFabricLayerCount("single")).toBe(1);
    expect(hatBrimKnittedDepthInches({ visibleBrimDepthInches: 2, brimType: "hung-hem" })).toBe(4);
    expect(hatBrimKnittedDepthInches({ visibleBrimDepthInches: 2, brimType: "single" })).toBe(2);
    // Pattern calc uses Folded Hem for hung-hem fabric; knitted brim height > visible depth
    const folded = calcWith({ brimType: "folded" });
    const single = calcWith({ brimType: "single" });
    expect(folded.brimRows).toBeGreaterThan(single.brimRows);
    expect(hatYarnFabricAreaSquareInches(folded)).toBeGreaterThan(hatYarnFabricAreaSquareInches(single));
    expect(folded.brimRows / folded.rowGaugePerInch).toBeGreaterThan(folded.brimDepth);
  });

  it("rolled brim uses actual knitted depth (single layer, not doubled)", () => {
    const rolled = calcWith({ brimType: "rolled", brimDepthInches: 1 });
    const single = calcWith({ brimType: "single", brimDepthInches: 1 });
    expect(rolled.brimRows).toBe(single.brimRows);
    expect(hatBrimFabricLayerCount("rolled")).toBe(1);
    const snap = buildHatYarnEstimationSnapshot(rolled);
    expect(snap.knittedBrimDepthInches).toBeCloseTo(rolled.brimRows / rolled.rowGaugePerInch, 5);
    expect(snap.knittedBrimDepthInches).toBeGreaterThan(0);
    expect(snap.fabricAreaSquareInches).toBe(hatYarnFabricAreaSquareInches(single));
  });

  it("crown shaping uses half-rectangle equivalent instead of a full crown rectangle", () => {
    const gathered = calcWith({ brimType: "single", crown: "gathered" });
    const wedge = calcWith({ brimType: "single", crown: "wedge-4" });
    expect(hatCrownYarnEquivalentHeightInches(gathered)).toBe(0);
    expect(wedge.crownHeightInches).toBeGreaterThan(0);
    expect(hatCrownYarnEquivalentHeightInches(wedge)).toBeCloseTo(
      (wedge.crownRowCount / wedge.rowGaugePerInch) * 0.5,
      5,
    );
    const fullCrownRectangleArea =
      wedge.targetWidth *
      (wedge.brimRows / wedge.rowGaugePerInch +
        wedge.bodyRows / wedge.rowGaugePerInch +
        wedge.crownRowCount / wedge.rowGaugePerInch);
    expect(hatYarnFabricAreaSquareInches(wedge)).toBeLessThan(fullCrownRectangleArea);
  });

  it("changing hat size or length changes the supplied yarn-estimation area", () => {
    const base = calcWith({ brimType: "single", finishedHatCircInches: 20.5, totalHatLengthInches: 11 });
    const wider = calcWith({ brimType: "single", finishedHatCircInches: 22, totalHatLengthInches: 11 });
    const longer = calcWith({ brimType: "single", finishedHatCircInches: 20.5, totalHatLengthInches: 13 });
    const baseArea = hatYarnFabricAreaSquareInches(base);
    expect(hatYarnFabricAreaSquareInches(wider)).toBeGreaterThan(baseArea);
    expect(hatYarnFabricAreaSquareInches(longer)).toBeGreaterThan(baseArea);
    expect(buildHatYarnDimensionsDetail(wider).projectWidth).toBe(22);
    expect(buildHatYarnDimensionsDetail(longer).projectLength).toBe(13);
  });

  it("shared yarn engine with fabric area yields more yarn for folded than single", () => {
    const single = calcWith({ brimType: "single" });
    const folded = calcWith({ brimType: "folded" });
    const swatch = { swatchWidthInches: 4, swatchLengthInches: 4, swatchWeight: 10 };
    const singleYarn = estimateYarnWeightWithBuffer({
      ...swatch,
      projectAreaSquareInches: hatYarnFabricAreaSquareInches(single),
    });
    const foldedYarn = estimateYarnWeightWithBuffer({
      ...swatch,
      projectAreaSquareInches: hatYarnFabricAreaSquareInches(folded),
    });
    expect(foldedYarn).toBeGreaterThan(singleYarn);
  });
});
