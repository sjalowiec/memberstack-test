import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC,
  DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC,
  buildDropShoulderBodyDiagramReplacements,
} from "./dropShoulderBodyNotationSvg";
import {
  applyGarmentDiagramSvgReplacements,
  repairMissingHemDepthMeasurementLabels,
  svgNeedsHemDepthMeasurementLabels,
} from "./sleevelessGarmentDiagramSvg";

const DROP_SHOULDER_PATTERN = {
  style: {
    construction: "drop-shoulder",
    frontStyle: "closed",
    garmentStyle: "pullover",
    neckline: "round",
    bodyShape: "straight",
  },
  fit: {
    selectedSize: "M",
    selectedMeasurements: {
      finished_bust_chest: 40,
      finished_length: 24,
      armhole_depth: 8,
    },
  },
} as const;

function textInSvgGroup(svgText: string, groupId: string): string | undefined {
  const groupRe = new RegExp(`id="${groupId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[\\s\\S]*?(?=id="|<\\/svg>)`, "i");
  const groupMatch = svgText.match(groupRe);
  if (!groupMatch) return undefined;
  const textMatch = groupMatch[0].match(/<text[^>]*>([\s\S]*?)<\/text>/i);
  if (!textMatch) return undefined;
  return textMatch[1]!
    .replace(/<tspan[^>]*>/gi, "")
    .replace(/<\/tspan>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

describe("applyGarmentDiagramSvgReplacements", () => {
  it("replaces placeholders split across Illustrator tspans", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text><tspan>{{SHOULDER_BINDOFF_S</tspan><tspan>T</tspan><tspan>S}} sts</tspan></text></svg>`;
    const out = applyGarmentDiagramSvgReplacements(svg, { SHOULDER_BINDOFF_STS: "15" });
    expect(out).toContain("15 sts");
    expect(out).not.toMatch(/\{\{/);
  });
});

describe("repairMissingHemDepthMeasurementLabels", () => {
  it("detects straight drop-shoulder body SVGs that need hem labels", () => {
    const backSvg = readFileSync(resolve(process.cwd(), "public" + DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC), "utf8");
    const frontSvg = readFileSync(resolve(process.cwd(), "public" + DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC), "utf8");
    expect(svgNeedsHemDepthMeasurementLabels(backSvg)).toBe(true);
    expect(svgNeedsHemDepthMeasurementLabels(frontSvg)).toBe(true);
  });

  it("does not modify SVGs that already include HEM_ROWS placeholders", () => {
    const shapedBack = readFileSync(
      resolve(process.cwd(), "public/images/patterns/drop-shoulder/drop-body-back-shaped.svg"),
      "utf8",
    );
    expect(svgNeedsHemDepthMeasurementLabels(shapedBack)).toBe(false);
    expect(repairMissingHemDepthMeasurementLabels(shapedBack)).toBe(shapedBack);
  });

  it("injects and hydrates hem-depth labels on straight back and front diagrams", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const backRepl = buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData: DROP_SHOULDER_PATTERN,
      measurementPiece: "back",
    });
    const frontRepl = buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData: DROP_SHOULDER_PATTERN,
      measurementPiece: "front",
    });

    expect(backRepl.HEM_ROWS).toBeTruthy();
    expect(backRepl.HEM_INCHES).toBeTruthy();

    const backSvg = readFileSync(resolve(process.cwd(), "public" + DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC), "utf8");
    const frontSvg = readFileSync(resolve(process.cwd(), "public" + DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC), "utf8");

    const backRepaired = repairMissingHemDepthMeasurementLabels(backSvg);
    const frontRepaired = repairMissingHemDepthMeasurementLabels(frontSvg);

    expect(backRepaired).toContain('transform="translate(7.5 284.71)"');
    expect(backRepaired).toContain('transform="translate(3.1 295.51)"');
    expect(frontRepaired).toContain('transform="translate(16.95 266.47)"');
    expect(frontRepaired).toContain('transform="translate(12.55 277.27)"');

    const backOut = applyGarmentDiagramSvgReplacements(backSvg, backRepl);
    const frontOut = applyGarmentDiagramSvgReplacements(frontSvg, frontRepl);

    expect(backOut).toContain('id="HEM_MEASUREMENT"');
    expect(frontOut).toContain('id="HEM_MEASUREMENT"');
    expect(textInSvgGroup(backOut, "HEM_MEASUREMENT")).toBe(`${backRepl.HEM_ROWS} rows`);
    expect(textInSvgGroup(frontOut, "HEM_MEASUREMENT")).toBe(`${frontRepl.HEM_ROWS} rows`);
    expect(backOut).toContain(`(${backRepl.HEM_INCHES} in)`);
    expect(frontOut).toContain(`(${frontRepl.HEM_INCHES} in)`);
    expect(backOut).not.toContain("{{HEM_ROWS}}");
    expect(frontOut).not.toContain("{{HEM_INCHES}}");
  });
});
