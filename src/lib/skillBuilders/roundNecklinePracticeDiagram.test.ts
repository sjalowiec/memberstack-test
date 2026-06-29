import { describe, expect, it } from "vitest";

import { calculateRoundNecklinePractice } from "./roundNecklinePractice";
import { buildRoundNecklinePracticeCalculationSummary } from "./roundNecklinePracticeCalculationSummary";
import { buildRoundNecklinePracticeDiagramValues } from "./roundNecklinePracticeDiagram";
import {
  buildBottomAnchoredMultilineTspanMarkup,
  neckOpeningCenterX,
  renderSkillBuilderDiagramSvg,
} from "./skillBuilderDiagram";
import { repairIllustratorSplitGarmentPlaceholders } from "../patterns/sleevelessGarmentDiagramSvg";
import { applyGarmentDiagramSvgReplacements } from "../patterns/sleevelessGarmentDiagramSvg";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROUND_NECKLINE_SVG_PATH = path.join(
  process.cwd(),
  "public/images/skill-builders/round-neckline.svg",
);

const DEFAULT_GAUGE = { stitchesPerFourInches: 28, rowsPerFourInches: 44 };

function placeholderKeysInSvg(svgText: string): string[] {
  const repaired = repairIllustratorSplitGarmentPlaceholders(svgText);
  const matches = [...repaired.matchAll(/\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g)];
  return [...new Set(matches.map((m) => m[1]))].sort();
}

function jpShapingTextBlock(rendered: string): string {
  return rendered.match(/<text[^>]*text-anchor="middle"[^>]*>[\s\S]*?<\/text>/i)?.[0] ?? "";
}

describe("neckOpeningCenterX", () => {
  it("reads the horizontal neck-width dimension line from the skill builder SVG", () => {
    const svgText = readFileSync(ROUND_NECKLINE_SVG_PATH, "utf8");
    expect(neckOpeningCenterX(svgText)).toBeCloseTo(99.39, 1);
  });
});

describe("buildBottomAnchoredMultilineTspanMarkup", () => {
  it("stacks lines upward with negative dy from the anchor line", () => {
    const markup = buildBottomAnchoredMultilineTspanMarkup(
      ["bo8", "3s-2r-1x", "1s-2r-3x"],
      ' x="0" y="0"',
      9,
    );
    expect(markup).toBe(
      '<tspan x="0" y="0">bo8</tspan><tspan x="0" dy="-10.8">3s-2r-1x</tspan><tspan x="0" dy="-10.8">1s-2r-3x</tspan>',
    );
  });
});

describe("buildRoundNecklinePracticeDiagramValues", () => {
  it("maps every round-neckline.svg placeholder from the shared result only", () => {
    const result = calculateRoundNecklinePractice(DEFAULT_GAUGE)!;
    const values = buildRoundNecklinePracticeDiagramValues(result);
    const svgText = readFileSync(ROUND_NECKLINE_SVG_PATH, "utf8");
    const expectedKeys = placeholderKeysInSvg(svgText);

    for (const key of expectedKeys) {
      expect(values).toHaveProperty(key);
      expect(String(values[key] ?? "")).toBeDefined();
    }

    expect(values.HEIGHT).toBe(result.rowsBeforeNeckline);
    expect(values.DEPTH).toBe(result.neckDepthRows);
    expect(values["cast-on"]).toBe(result.castOnStitches);
  });

  it("replaces all placeholders in the skill builder SVG template", () => {
    const result = calculateRoundNecklinePractice(DEFAULT_GAUGE)!;
    const values = buildRoundNecklinePracticeDiagramValues(result);
    const svgText = readFileSync(ROUND_NECKLINE_SVG_PATH, "utf8");
    const rendered = renderSkillBuilderDiagramSvg(svgText, values);

    expect(rendered).not.toMatch(/\{\{/);
    expect(rendered).toContain(String(result.castOnStitches));
    expect(rendered).toContain(String(result.neckOpeningStitches));
    expect(rendered).toContain(String(result.leftShoulderStitches));
    expect(rendered).toContain(String(result.neckDepthRows));
    expect(rendered).toContain(String(result.rowsBeforeNeckline));

    for (const line of result.japaneseNotationLines) {
      expect(rendered).toContain(line);
    }
  });

  it("expands JP-SHAPING bottom-up from the Illustrator anchor (bind off on anchor)", () => {
    const result = calculateRoundNecklinePractice(DEFAULT_GAUGE)!;
    const svgText = readFileSync(ROUND_NECKLINE_SVG_PATH, "utf8");
    const rendered = renderSkillBuilderDiagramSvg(svgText, buildRoundNecklinePracticeDiagramValues(result));

    const jpBlock = jpShapingTextBlock(rendered);
    expect(jpBlock).toContain('text-anchor="middle"');
    expect(jpBlock).toContain('transform="translate(99.39 41.44)"');
    expect(jpBlock).toContain(`<tspan x="0" y="0">${result.japaneseNotationLines[0]}</tspan>`);

    const tspans = [...jpBlock.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]!);
    expect(tspans).toEqual(result.japaneseNotationLines);
  });

  it("uses the shared garment diagram replacement helper for measurement tokens", () => {
    const svgText = '<text><tspan>{{NECK_STS}} sts</tspan></text>';
    const out = applyGarmentDiagramSvgReplacements(svgText, { NECK_STS: "36" });
    expect(out).toContain("36 sts");
  });
});

describe("buildRoundNecklinePracticeCalculationSummary", () => {
  it("documents row and stitch checks from the shared result", () => {
    const result = calculateRoundNecklinePractice(DEFAULT_GAUGE)!;
    const summary = buildRoundNecklinePracticeCalculationSummary(result, DEFAULT_GAUGE);

    expect(summary).toContain(
      `${result.rowsBeforeNeckline} + ${result.neckDepthRows} = ${result.totalRows}`,
    );
    expect(summary).toContain(
      `${result.leftShoulderStitches} + ${result.neckOpeningStitches} + ${result.rightShoulderStitches} = ${result.castOnStitches}`,
    );
    expect(summary).toContain(`HEIGHT = ${result.rowsBeforeNeckline}`);
    expect(summary).toContain(`Rows after final neckline shaping = ${result.rowsRemainingAfterFinalNecklineShaping}`);
  });
});
