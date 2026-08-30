import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { calculateBasicSockPattern, type BasicSockCalc, type BasicSockCalcInput } from "./sockMath";
import {
  SOCK_CANONICAL_ANCHORS,
  SOCK_CANONICAL_POLYGON_POINTS,
  SOCK_CANONICAL_SVG_HREF,
  SOCK_CANONICAL_VB_H,
  SOCK_CANONICAL_VB_W,
  sockCanonicalCalcLabelFields,
  sockCanonicalDiagramFrame,
  sockCanonicalGeometryMarkup,
  sockCanonicalInnerMarkup,
  sockCanonicalLabelPoint,
} from "./sockCanonicalDiagram";

const svgFile = readFileSync(resolve("public/images/patterns/socks/socks-summary.svg"), "utf8");
const dir = dirname(fileURLToPath(import.meta.url));

function mustCalc(overrides: Partial<BasicSockCalcInput> = {}): BasicSockCalc {
  const result = calculateBasicSockPattern({
    footCircumferenceInches: 8.5,
    footLengthInches: 9,
    legCircumferenceInches: 8.5,
    legLengthInches: 4.5,
    stitchGaugeDisplay: 28,
    rowGaugeDisplay: 40,
    displayUnit: "inches",
    constructionDirection: "cuff-to-toe",
    ...overrides,
  });
  expect(result.ok, result.ok ? "" : result.errors.join("; ")).toBe(true);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.calc;
}

describe("canonical socks-summary.svg", () => {
  it("keeps the user polygon points and only adds metadata anchors", () => {
    expect(svgFile).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(svgFile).toContain('id="sock-canonical-outline"');
    expect(svgFile).toContain('id="sock-canonical-anchors"');
    expect(svgFile).toContain('id="anchor-heel"');
    expect(svgFile).toContain('y1="184"');
    expect(svgFile).toContain("stroke-dasharray");
    expect(svgFile).toContain('viewBox="0 0 284 480"');
    expect(SOCK_CANONICAL_VB_W).toBe(284);
    expect(SOCK_CANONICAL_VB_H).toBe(480);
    expect(SOCK_CANONICAL_SVG_HREF).toBe("/images/patterns/socks/socks-summary.svg");
    const inner = sockCanonicalInnerMarkup(svgFile);
    expect(inner).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(inner).not.toMatch(/<\?xml/);
    expect(inner).not.toMatch(/<\/svg>/i);
  });

  it("mirrors Sock 2 with a presentation transform, not a second outline", () => {
    const sock1 = sockCanonicalGeometryMarkup();
    const sock2 = sockCanonicalGeometryMarkup({ mirror: true });
    expect(sock1).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(sock2).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(sock1).not.toContain("scale(-1,1)");
    expect(sock2).toContain(`translate(${SOCK_CANONICAL_VB_W},0) scale(-1,1)`);
    expect(sockCanonicalDiagramFrame().geometryKey).toBe(
      sockCanonicalDiagramFrame({ mirror: true }).geometryKey,
    );
    expect(sockCanonicalDiagramFrame().workHalf).toBe("right");
    expect(sockCanonicalDiagramFrame({ mirror: true }).workHalf).toBe("left");
    const heel1 = sockCanonicalLabelPoint("sectionHeel", false);
    const heel2 = sockCanonicalLabelPoint("sectionHeel", true);
    expect(heel2.x).toBe(SOCK_CANONICAL_VB_W - heel1.x);
    expect(heel2.y).toBe(heel1.y);
    const measure1 = sockCanonicalLabelPoint("measureLeg", false);
    const measure2 = sockCanonicalLabelPoint("measureLeg", true);
    expect(measure2.x).toBe(measure1.x);
    expect(measure2.y).toBe(measure1.y);
  });

  it("flips Cuff-to-Toe vertically on the same polygon without a second SVG", () => {
    const file = sockCanonicalGeometryMarkup();
    const cuff = sockCanonicalGeometryMarkup({ flipVertical: true });
    const both = sockCanonicalGeometryMarkup({ mirror: true, flipVertical: true });
    expect(file).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(cuff).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(both).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(file).not.toContain("scale(");
    expect(cuff).toContain(`translate(0,${SOCK_CANONICAL_VB_H}) scale(1,-1)`);
    expect(both).toContain(`translate(${SOCK_CANONICAL_VB_W},${SOCK_CANONICAL_VB_H}) scale(-1,-1)`);
    const toe = sockCanonicalLabelPoint("sectionToe", false);
    const toeFlipped = sockCanonicalLabelPoint("sectionToe", false, true);
    expect(toeFlipped.x).toBe(toe.x);
    expect(toeFlipped.y).toBe(SOCK_CANONICAL_VB_H - toe.y);
    const heelMirroredFlipped = sockCanonicalLabelPoint("sectionHeel", true, true);
    expect(heelMirroredFlipped.x).toBe(SOCK_CANONICAL_VB_W - SOCK_CANONICAL_ANCHORS.sectionHeel.x);
    expect(heelMirroredFlipped.y).toBe(SOCK_CANONICAL_VB_H - SOCK_CANONICAL_ANCHORS.sectionHeel.y);
    const measureFlipped = sockCanonicalLabelPoint("measureLeg", true, true);
    expect(measureFlipped.x).toBe(SOCK_CANONICAL_ANCHORS.measureLeg.x);
    expect(measureFlipped.y).toBe(SOCK_CANONICAL_VB_H - SOCK_CANONICAL_ANCHORS.measureLeg.y);
  });

  it("does not rebuild construction geometry from calc values", () => {
    const baby = sockCanonicalCalcLabelFields(
      mustCalc({
        footCircumferenceInches: 4,
        footLengthInches: 3.5,
        legCircumferenceInches: 4,
        legLengthInches: 2.5,
      }),
    );
    const adult = sockCanonicalCalcLabelFields(
      mustCalc({
        footCircumferenceInches: 10,
        footLengthInches: 11,
        legCircumferenceInches: 10,
        legLengthInches: 6,
      }),
    );
    expect(adult.tubeStitches).toBeGreaterThan(baby.tubeStitches);
    expect(adult.footRows).toBeGreaterThan(baby.footRows);
    expect(sockCanonicalGeometryMarkup()).toBe(
      sockCanonicalGeometryMarkup({ mirror: false }),
    );
    const cuff = mustCalc({ constructionDirection: "cuff-to-toe" });
    const toeUp = mustCalc({ constructionDirection: "toe-up" });
    expect(sockCanonicalCalcLabelFields(cuff).tubeStitches).toBe(
      sockCanonicalCalcLabelFields(toeUp).tubeStitches,
    );
    expect(sockCanonicalGeometryMarkup()).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(sockCanonicalGeometryMarkup()).not.toContain(" sts");
    expect(sockCanonicalGeometryMarkup()).not.toContain(" rows");
  });
});

describe("canonical diagram module does not recreate Socks math or old schematic", () => {
  it("does not import calculators or generate hourglass paths", () => {
    const src = readFileSync(resolve(dir, "sockCanonicalDiagram.ts"), "utf8");
    expect(src).not.toMatch(/magicFormulaIntervals/);
    expect(src).not.toMatch(/remainingStitchesAtOneThird/);
    expect(src).not.toMatch(/roundToEvenPreferUp/);
    expect(src).not.toMatch(/computeMagicFormulaPairedShaping/);
    expect(src).not.toMatch(/calculateShortRowShaping/);
    expect(src).not.toMatch(/calculateBasicSockPattern/);
    expect(src).not.toContain("sockDiagramHourglassPath");
    expect(src).not.toContain("sockDiagramSchematicMarkup");
    expect(src).toContain("socks-summary.svg");
    expect(src).toContain("BasicSockCalc");
  });
});

describe("Summary/Edit stays on the static WebP", () => {
  it("does not load the canonical construction SVG", () => {
    const summaryPage = readFileSync(
      resolve("src/pages/patterns/socks/summary/index.astro"),
      "utf8",
    );
    const summaryScript = readFileSync(resolve("src/scripts/socks-summary-page.ts"), "utf8");
    expect(summaryPage).not.toContain("socks-summary.svg");
    expect(summaryPage).not.toContain("sockCanonicalGeometryMarkup");
    expect(summaryScript).not.toContain("socks-summary.svg");
    expect(summaryScript).not.toContain("buildSockPatternDiagramSvg");
    expect(summaryPage).toContain("SOCK_SUMMARY_ART_SRC");
  });
});
