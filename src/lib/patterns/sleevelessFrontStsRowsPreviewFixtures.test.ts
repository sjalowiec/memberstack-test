import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSleevelessFrontStsRowsPreviewCases,
  buildSleevelessFrontStsRowsSameSizeVNeckComparisonCases,
} from "./sleevelessFrontStsRowsPreviewFixtures";

function svgAttr(svg: string, name: string): string {
  const re = new RegExp(`${name}="([^"]*)"`);
  return re.exec(svg)?.[1] ?? "";
}

function svgNum(svg: string, name: string): number {
  return Number(svgAttr(svg, name));
}

describe("buildSleevelessFrontStsRowsPreviewCases", () => {
  it("builds generated SVGs for shallow, normal, and deep V fixtures", () => {
    const cases = buildSleevelessFrontStsRowsPreviewCases();
    expect(cases.map((c) => c.id)).toEqual(["shallow-v", "normal-v", "deep-v-overlap"]);
    for (const item of cases) {
      expect(item.svg).toBeTruthy();
      expect(item.svg).toContain('data-sleeveless-front-sts-rows-generated="true"');
      expect(item.svg).not.toMatch(/\bNaN\b/);
    }
    expect(cases[0]?.values.beginsBeforeArmhole).toBe(false);
    expect(cases[2]?.values.beginsBeforeArmhole).toBe(true);
  });
});

describe("buildSleevelessFrontStsRowsSameSizeVNeckComparisonCases", () => {
  it("keeps the upper-body stitch budget identical and only changes V depth and start row", () => {
    const cases = buildSleevelessFrontStsRowsSameSizeVNeckComparisonCases();
    expect(cases.map((c) => c.id)).toEqual([
      "same-size-shallow-v",
      "same-size-overlap-v",
      "same-size-deep-v",
    ]);

    const sharedKeys = [
      "bustStitches",
      "stitchesAfterArmhole",
      "shoulderStitchesPerSide",
      "necklineStitches",
      "armholeStitchesEachSide",
      "armholeBindOffStsEachSide",
      "armholeDecreaseStsEachSide",
      "armholeStartRc",
      "lastArmholeRc",
    ] as const;
    for (const key of sharedKeys) {
      expect(new Set(cases.map((item) => item.values[key])).size).toBe(1);
    }

    const depths = cases.map((item) => Number(item.values.neckDepthRows));
    expect(depths[1]!).toBeGreaterThan(depths[0]!);
    expect(depths[2]!).toBeGreaterThan(depths[1]!);

    const neckStarts = cases.map((item) => item.values.neckStartRc);
    expect(new Set(neckStarts).size).toBe(3);
    expect(Number(neckStarts[1])).toBeLessThan(Number(neckStarts[0]));
    expect(Number(neckStarts[2])).toBeLessThan(Number(neckStarts[1]));

    expect(cases[0]?.values.beginsBeforeArmhole).toBe(false);
    expect(cases[1]?.values.overlapsNeckline).toBe(true);
    expect(cases[2]?.values.beginsBeforeArmhole).toBe(true);
  });

  it("changes the V shape without changing rendered upper-body width", () => {
    const cases = buildSleevelessFrontStsRowsSameSizeVNeckComparisonCases();
    for (const item of cases) {
      expect(item.svg).toBeTruthy();
      expect(item.svg).toContain('data-sleeveless-front-sts-rows-generated="true"');
      expect(item.svg).not.toMatch(/\bNaN\b/);
    }

    const svgs = cases.map((item) => item.svg!);
    const sharedSvgKeys = [
      "data-bust-width",
      "data-after-armhole-width",
      "data-neck-width",
      "data-shoulder-side-width",
    ] as const;
    for (const key of sharedSvgKeys) {
      expect(svgNum(svgs[1]!, key)).toBeCloseTo(svgNum(svgs[0]!, key), 1);
      expect(svgNum(svgs[2]!, key)).toBeCloseTo(svgNum(svgs[0]!, key), 1);
    }

    const depths = svgs.map((svg) => svgNum(svg, "data-neck-start-y") - svgNum(svg, "data-neck-corner-y"));
    expect(depths[1]!).toBeGreaterThan(depths[0]!);
    expect(depths[2]!).toBeGreaterThan(depths[1]!);
    expect(svgNum(svgs[1]!, "data-neck-start-rc")).not.toBe(svgNum(svgs[0]!, "data-neck-start-rc"));
    expect(svgNum(svgs[2]!, "data-neck-start-rc")).not.toBe(svgNum(svgs[1]!, "data-neck-start-rc"));
  });
});

describe("Sleeveless Front Stitches & Rows preview route wiring", () => {
  it("dev preview page uses the fixture builder and does not load site auth layouts", () => {
    const page = readFileSync(resolve("src/pages/dev/sleeveless-front-sts-rows-preview.astro"), "utf8");
    expect(page).toContain("buildSleevelessFrontStsRowsPreviewCases");
    expect(page).toContain("buildSleevelessFrontStsRowsSameSizeVNeckComparisonCases");
    expect(page).toContain("isSleevelessFrontStsRowsPreviewProductionBlocked");
    expect(page).toContain("data-preview-fixture");
    expect(page).toContain("data-preview-section");
    expect(page).toContain("same-size-v-neck");
    expect(page).not.toMatch(/layouts\/Layout/);
    expect(page).not.toMatch(/layouts\/BaseLayout/);
    expect(page).not.toMatch(/memberstack\.(js|com)|data-memberstack/i);
    expect(page).not.toMatch(/sleevelessPatternPageShared/);
  });

  it("middleware 404s the preview route on production", () => {
    const middleware = readFileSync(resolve("src/middleware.ts"), "utf8");
    expect(middleware).toContain("isSleevelessFrontStsRowsPreviewRoute");
    expect(middleware).toContain("isSleevelessFrontStsRowsPreviewProductionBlocked");
  });
});
