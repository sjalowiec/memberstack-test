import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDropShoulderBackStitchesRowsSvg } from "./dropShoulderBackPatternDiagramSvg";
import { buildDropShoulderFrontStitchesRowsSvg } from "./dropShoulderFrontPatternDiagramSvg";
import {
  buildDropShoulderDiagramReviewCases,
  kids10YrRelaxedArmhole36Pattern,
  kids10YrRelaxedDropShoulderPattern,
} from "./dropShoulderDiagramReviewFixtures";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { lengthFromRowsForDiagram } from "./sleevelessRowAccounting";

describe("drop shoulder diagram review fixtures", () => {
  it("Kids 10 relaxed uses 21 sts / 32 rows over 4 in", () => {
    const pattern = kids10YrRelaxedDropShoulderPattern();
    const yarn = pattern.yarnGaugeMachine as Record<string, number>;
    expect(yarn.gaugeStitchesPerInch).toBe(5.25);
    expect(yarn.gaugeRowsPerInch).toBe(8);
  });

  it("36-row armhole fixture still produces 36 rows / 4.5 in from the generator", () => {
    const result = generateDropShoulderPattern(kids10YrRelaxedArmhole36Pattern());
    expect(result.debug.armholeRows).toBe(36);
    expect(result.debug.rowsPerInch).toBe(8);
    expect(lengthFromRowsForDiagram(36, 8, "in")).toBe(4.5);
  });

  it("review cases cover real style variations and call the live renderers", () => {
    const cases = buildDropShoulderDiagramReviewCases();
    expect(cases.map((c) => c.id)).toEqual([
      "pullover-round-kids10",
      "pullover-vneck-kids10",
      "cardigan-round-kids10",
      "cardigan-vneck-kids10",
      "pullover-round-misses8",
      "pullover-aline-misses8",
    ]);

    const round = cases.find((c) => c.id === "pullover-round-kids10")!;
    expect(round.frontModel.neckline).toBe("round");
    expect(round.frontModel.garment).toBe("pullover");
    expect(round.backModel.armholeRows).toBe(36);
    expect(round.pieces[0].generatedSvg).toBe(
      buildDropShoulderBackStitchesRowsSvg(round.backModel),
    );
    expect(round.pieces[1].generatedSvg).toBe(
      buildDropShoulderFrontStitchesRowsSvg(round.frontModel),
    );

    const vneck = cases.find((c) => c.id === "pullover-vneck-kids10")!;
    expect(vneck.frontModel.neckline).toBe("v");
    expect(vneck.pieces[1].generatedSvg).toContain('data-neckline="v"');

    const cardigan = cases.find((c) => c.id === "cardigan-round-kids10")!;
    expect(cardigan.frontModel.garment).toBe("cardigan");
    expect(cardigan.pieces[1].generatedSvg).toContain("LEFT FRONT");

    const cardiganV = cases.find((c) => c.id === "cardigan-vneck-kids10")!;
    expect(cardiganV.frontModel.garment).toBe("cardigan");
    expect(cardiganV.frontModel.neckline).toBe("v");

    const misses = cases.find((c) => c.id === "pullover-round-misses8")!;
    expect(misses.values.gauge).toBe("18 sts / 24 rows over 4 in");

    const aline = cases.find((c) => c.id === "pullover-aline-misses8")!;
    expect(aline.frontModel.bodyShape).toBe("aline");
    expect(aline.backModel.hemStitches).toBeGreaterThan(aline.backModel.bodyWidthStitches);
  });
});

describe("Drop Shoulder diagram review route wiring", () => {
  it("dev review page uses the fixture builder and does not load site auth layouts", () => {
    const page = readFileSync(resolve("src/pages/dev/drop-shoulder-diagram-review.astro"), "utf8");
    expect(page).toContain("buildDropShoulderDiagramReviewCases");
    expect(page).toContain("isDropShoulderDiagramReviewProductionBlocked");
    expect(page).toContain("data-review-config-select");
    expect(page).toContain("data-review-piece-btn");
    expect(page).toContain("Debug values");
    expect(page).toContain("<details");
    expect(page).not.toMatch(/layouts\/Layout/);
    expect(page).not.toMatch(/layouts\/BaseLayout/);
    expect(page).not.toMatch(/memberstack\.(js|com)|data-memberstack/i);
  });

  it("middleware 404s the review route on production", () => {
    const middleware = readFileSync(resolve("src/middleware.ts"), "utf8");
    expect(middleware).toContain("isDropShoulderDiagramReviewRoute");
    expect(middleware).toContain("isDropShoulderDiagramReviewProductionBlocked");
  });
});
