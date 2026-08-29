import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { kids10YrRelaxedArmhole36Pattern } from "./dropShoulderDiagramReviewFixtures";
import { tryBuildLiveDropShoulderBackStsRowsDiagramSvg } from "./dropShoulderBackPatternDiagramSvg";
import { tryBuildLiveDropShoulderFrontStsRowsDiagramSvg } from "./dropShoulderFrontPatternDiagramSvg";
import { tryBuildLiveDropShoulderBackNotationSvg } from "./dropShoulderBackShapingNotationDiagramSvg";
import { tryBuildLiveDropShoulderFrontNotationSvg } from "./dropShoulderFrontShapingNotationDiagramSvg";
import {
  buildDropShoulderFrontFullWidthFrame,
  buildFullWidthFrame,
  dropShoulderFrontPulloverRoundBodyPath,
  dropShoulderPulloverRoundBodyPath,
  fmtNum,
} from "./dropShoulderPatternDiagramSvgShared";
import {
  buildDropShoulderBackStitchesRowsModel,
  buildDropShoulderFrontStitchesRowsModel,
} from "./dropShoulderPatternDiagramModel";

function withStyle(
  base: Record<string, unknown>,
  styleOverrides: Record<string, unknown>,
): Record<string, unknown> {
  const style = (base.style ?? {}) as Record<string, unknown>;
  return { ...base, style: { ...style, ...styleOverrides } };
}

/** XML start tags must not repeat an attribute name (DOMParser well-formedness). */
function duplicateXmlAttributes(svg: string): string[] {
  const dups: string[] = [];
  const tagRe = /<([A-Za-z][\w:-]*)([^>]*?)\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(svg))) {
    const tag = match[1]!;
    const attrChunk = match[2] ?? "";
    const names = [...attrChunk.matchAll(/([:\w-]+)\s*=/g)].map((m) => m[1]!);
    const seen = new Set<string>();
    for (const name of names) {
      if (seen.has(name)) dups.push(`${tag}.${name}`);
      seen.add(name);
    }
  }
  return dups;
}

function assertWellFormedGeneratedSvg(svg: string | null) {
  expect(svg).toBeTruthy();
  const markup = svg!;
  expect(markup).toContain("<svg");
  expect(markup).not.toMatch(/\bNaN\b/);
  expect(duplicateXmlAttributes(markup)).toEqual([]);
  expect(markup).not.toMatch(/\bdata-rc="[^"]*"\s+data-rc="/);
}

const BASE = kids10YrRelaxedArmhole36Pattern();
const PULLOVER_ROUND = BASE;
const CARDIGAN_ROUND = withStyle(BASE, { frontStyle: "open", garmentStyle: "cardigan" });
const PULLOVER_V = withStyle(BASE, { neckline: "v-neck" });

describe("generated Drop Shoulder SVG is well-formed XML", () => {
  it("Front Shaping Notation round-neck SVG has unique attributes", () => {
    const result = generateDropShoulderPattern(PULLOVER_ROUND);
    const svg = tryBuildLiveDropShoulderFrontNotationSvg(result, PULLOVER_ROUND);
    assertWellFormedGeneratedSvg(svg);
    expect(svg).toContain('data-role="rc-reset"');
    expect(svg).toContain('data-role="neck-start-rc"');
    expect(svg).toMatch(/data-role="rc-reset"[^>]*data-rc="/);
    expect(svg).not.toMatch(/data-role="rc-reset"[^>]*data-rc="[^"]*"[^>]*data-rc="/);
    expect(svg).not.toMatch(/data-role="neck-start-rc"[^>]*data-rc="[^"]*"[^>]*data-rc="/);
  });

  it("cardigan round Front Shaping Notation SVG has unique attributes", () => {
    const result = generateDropShoulderPattern(CARDIGAN_ROUND);
    assertWellFormedGeneratedSvg(tryBuildLiveDropShoulderFrontNotationSvg(result, CARDIGAN_ROUND));
  });

  it("V-neck Front Shaping Notation SVG is well-formed when RC labels are present", () => {
    const result = generateDropShoulderPattern(PULLOVER_V);
    const svg = tryBuildLiveDropShoulderFrontNotationSvg(result, PULLOVER_V);
    assertWellFormedGeneratedSvg(svg);
    if (svg?.includes('data-role="neck-start-rc"') || svg?.includes('data-role="rc-reset"')) {
      expect(svg).not.toMatch(/data-rc="[^"]*"\s+data-rc="/);
    }
  });

  it("Back Shaping Notation SVG is well-formed when RC labels are present", () => {
    const result = generateDropShoulderPattern(PULLOVER_ROUND);
    const svg = tryBuildLiveDropShoulderBackNotationSvg(result, PULLOVER_ROUND);
    assertWellFormedGeneratedSvg(svg);
    expect(svg).toContain('data-role="rc-reset"');
    expect(svg).toContain('data-role="neck-start-rc"');
    expect(svg).toMatch(/data-role="rc-reset"[^>]*data-rc="/);
    expect(svg).not.toMatch(/data-role="rc-reset"[^>]*data-rc="[^"]*"[^>]*data-rc="/);
    expect(svg).not.toMatch(/data-role="neck-start-rc"[^>]*data-rc="[^"]*"[^>]*data-rc="/);
  });

  it("Back and Front Stitches & Rows SVGs remain well-formed", () => {
    const result = generateDropShoulderPattern(PULLOVER_ROUND);
    assertWellFormedGeneratedSvg(
      tryBuildLiveDropShoulderBackStsRowsDiagramSvg(result, PULLOVER_ROUND, "in"),
    );
    assertWellFormedGeneratedSvg(
      tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(result, PULLOVER_ROUND, "in"),
    );
  });
});

describe("Drop Shoulder generated-SVG parse failure does not take down the pattern", () => {
  const pageScript = readFileSync(resolve("src/scripts/sleevelessPatternPageShared.ts"), "utf8");

  it("mount helper returns false instead of throwing on parse failure", () => {
    const start = pageScript.indexOf("function mountDropShoulderStsRowsSvgMarkup");
    const end = pageScript.indexOf("async function hydrateDropShoulderBackDiagram");
    const fn = pageScript.slice(start, end > start ? end : start + 1800);
    expect(fn).toContain("return false");
    expect(fn).toContain("try {");
    expect(fn).not.toContain("throw new Error");
    expect(fn).toContain("Drop shoulder generated diagram parse failed");
  });

  it("Front Shaping Notation falls through to Illustrator when generated parse fails", () => {
    const start = pageScript.indexOf("async function inlineDropShoulderFrontNotationSvg");
    const end = pageScript.indexOf("function mountDropShoulderStsRowsSvgMarkup");
    const fn = pageScript.slice(start, end > start ? end : start + 3500);
    expect(fn).toContain("generatedSvg &&");
    expect(fn).toContain("mountDropShoulderStsRowsSvgMarkup");
    expect(fn.indexOf("mountDropShoulderStsRowsSvgMarkup")).toBeLessThan(
      fn.indexOf("applyJapaneseNotationSvgReplacements"),
    );
    expect(fn).toContain("resolveDropShoulderFrontDiagramSvg(\"shaping-notation\"");
    expect(fn).not.toContain("We could not render your pattern");
  });

  it("Back Shaping Notation falls through to Illustrator when generated parse fails", () => {
    const start = pageScript.indexOf("async function inlineDropShoulderBackNotationSvg");
    const end = pageScript.indexOf("async function inlineDropShoulderFrontNotationSvg");
    const fn = pageScript.slice(start, end > start ? end : start + 3500);
    expect(fn).toContain("tryBuildLiveDropShoulderBackNotationSvg");
    expect(fn).toContain("generatedSvg &&");
    expect(fn).toContain("mountDropShoulderStsRowsSvgMarkup");
    expect(fn.indexOf("mountDropShoulderStsRowsSvgMarkup")).toBeLessThan(
      fn.indexOf("applyJapaneseNotationSvgReplacements"),
    );
    expect(fn).toContain("resolveDropShoulderBackDiagramSvg(\"shaping-notation\"");
    expect(fn).not.toContain("We could not render your pattern");
  });

  it("Back and Front Stitches & Rows still have Illustrator fallback after a failed generated mount", () => {
    const backStart = pageScript.indexOf("async function hydrateDropShoulderBackDiagram");
    const frontStart = pageScript.indexOf("async function hydrateDropShoulderFrontDiagram");
    const bindStart = pageScript.indexOf("function bindDropShoulderBodyDiagramMode");
    const backFn = pageScript.slice(backStart, frontStart);
    const frontFn = pageScript.slice(frontStart, bindStart);
    expect(backFn).toContain("generatedSvg &&");
    expect(backFn).toContain("inlineSvgWithReplacements");
    expect(frontFn).toContain("generatedSvg &&");
    expect(frontFn).toContain("inlineSvgWithReplacements");
    expect(backFn).not.toContain("We could not render your pattern");
    expect(frontFn).not.toContain("We could not render your pattern");
  });

  it("keeps the generic pattern-render error only on the outer refresh catch", () => {
    const refreshStart = pageScript.indexOf("async function refreshPatternTabContent");
    const refreshFn = pageScript.slice(refreshStart);
    expect(refreshFn).toContain("We could not render your pattern");
    const mountStart = pageScript.indexOf("async function renderDropShoulderMount");
    const mountEnd = pageScript.indexOf("async function renderMount(");
    const mountFn = pageScript.slice(mountStart, mountEnd > mountStart ? mountEnd : mountStart + 8000);
    expect(mountFn).not.toContain("We could not render your pattern");
  });
});

describe("Drop Shoulder geometry and Front timing remain unchanged", () => {
  it("keeps the vertical marker-to-shoulder side on generated Back and Front paths", () => {
    const pattern = kids10YrRelaxedArmhole36Pattern();
    const result = generateDropShoulderPattern(pattern);
    const backModel = buildDropShoulderBackStitchesRowsModel(result, "in")!;
    const frontModel = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    const backFrame = buildFullWidthFrame(backModel);
    const frontFrame = buildDropShoulderFrontFullWidthFrame(frontModel);
    const backPath = dropShoulderPulloverRoundBodyPath(backFrame);
    const frontPath = dropShoulderFrontPulloverRoundBodyPath(frontFrame);
    const backSvg = tryBuildLiveDropShoulderBackStsRowsDiagramSvg(result, pattern, "in")!;
    const frontSvg = tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(result, pattern, "in")!;
    const backNotation = tryBuildLiveDropShoulderBackNotationSvg(result, pattern)!;
    expect(backSvg).toContain(backPath);
    expect(frontSvg).toContain(frontPath);
    expect(backNotation).toContain(backPath);
    expect(backPath).toContain(`L ${fmtNum(backFrame.left)} ${fmtNum(backFrame.armholeMarkerY)}`);
    expect(backPath).toContain(`L ${fmtNum(backFrame.left)} ${fmtNum(backFrame.top)}`);
  });

  it("does not change Front deep-neck timing or Sleeveless generation", () => {
    const deep = generateDropShoulderPattern({
      fit: {
        sizingChart: "women",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 24,
          upper_arm: 16,
          wrist: 8,
          sleeve_length: 12,
          shoulder_width: 16,
          neck_opening: 7,
          back_neck_depth: 1,
          front_neck_depth: 12,
        },
      },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 6,
        availableNeedles: 200,
      },
      style: {
        construction: "drop-shoulder",
        frontStyle: "closed",
        neckline: "round",
      },
    });
    expect(deep.debug.frontNecklineStartRC).toBeLessThan(deep.debug.armholeStartRow!);
    expect(deep.debug.backNecklineStartRC).toBeGreaterThanOrEqual(deep.debug.armholeStartRow!);

    const sleeveless = generateSleevelessBackPattern({
      ...PULLOVER_ROUND,
      style: { ...(PULLOVER_ROUND.style as Record<string, unknown>), construction: "sleeveless" },
    });
    expect(sleeveless.frontDisplayRows.length).toBeGreaterThan(0);
  });
});
