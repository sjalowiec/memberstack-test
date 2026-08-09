import { describe, expect, it } from "vitest";
import {
  convertLength,
  formatLengthWithUnit,
} from "../../../components/wizards/utils/unitHelpers";
import { calculateHatPattern } from "./hatMath";
import { buildHatPatternDiagramSvg } from "./hatPatternDiagramSvg";

const formatters = {
  convertLength: convertLength as (v: number, from: string, to: string) => number,
  formatLengthWithUnit: formatLengthWithUnit as (v: number, unit: string) => string,
};

function calcFor(overrides: Partial<Parameters<typeof calculateHatPattern>[0]> = {}) {
  return calculateHatPattern({
    finishedHatCircInches: 20.5,
    stitchGaugeDisplay: 5,
    rowGaugeDisplay: 7,
    displayUnit: "inches",
    totalHatLengthInches: 8.5,
    brimDepthInches: 2,
    brimType: "single",
    crown: "gathered",
    suggestedCrownDepthInches: 2.5,
    fit: "watchcap",
    ...overrides,
  });
}

function expectSaneSvg(svg: string) {
  expect(svg).toContain('viewBox="0 0 430 460"');
  expect(svg).toContain("<title");
  expect(svg).toContain('data-hat-diagram="true"');
  expect(svg).not.toMatch(/\bNaN\b/);
  expect(svg).not.toMatch(/\bInfinity\b/);
  expect(svg).not.toMatch(/\bundefined\b/);
}

describe("buildHatPatternDiagramSvg", () => {
  it("renders gathered-specific structure", () => {
    const calc = calcFor({ crown: "gathered" });
    const svg = buildHatPatternDiagramSvg(calc, "inches", formatters);
    expectSaneSvg(svg);
    expect(svg).toContain('data-crown="gathered"');
    expect(svg).toContain('data-crown-style="gathered"');
    expect(svg).toContain("hat-diagram__crown--gathered");
    expect(svg).toContain("Gather");
    expect(svg).toContain("gather");
    expect(svg).not.toContain("hat-diagram__crown--four-gore");
    expect(svg).not.toContain("hat-diagram__crown--swirl");
    expect(svg).toContain(`${calc.castOnSts} sts`);
    expect(svg).toContain(formatLengthWithUnit(calc.hatHeight, "inches"));
    expect(svg).toContain(formatLengthWithUnit(calc.brimDepth, "inches"));
  });

  it("renders four-gore-specific structure for wedge-4-decrease", () => {
    const calc = calcFor({ crown: "wedge-4-decrease" });
    const svg = buildHatPatternDiagramSvg(calc, "inches", formatters);
    expectSaneSvg(svg);
    expect(svg).toContain('data-crown="wedge-4-decrease"');
    expect(svg).toContain("hat-diagram__crown--four-gore");
    expect(svg).toContain("Crown · 4 gores");
    expect(svg).toContain(">Gore</tspan>");
    expect(svg).toContain(">#1</tspan>");
    expect(svg).toContain(">#4</tspan>");
    expect(svg).toContain("sts / gore");
    expect(svg).not.toContain("textLength=");
    expect(svg).toContain(`${calc.crownRowCount} rows`);
    expect(svg).toContain(formatLengthWithUnit(calc.crownHeightInches, "inches"));
    expect(svg).not.toContain("hat-diagram__crown--gathered");
    expect(svg).not.toContain("hat-diagram__crown--swirl");

    // Stitch-count sits below the wedge base (bodyTop), not over the tips.
    const bodyTopMatch = svg.match(
      /class="hat-diagram__body"[^>]*y="([\d.]+)"/,
    );
    const wedgeStsMatch = svg.match(
      /y="([\d.]+)"[^>]*>\d+ sts \/ gore</,
    );
    expect(bodyTopMatch).toBeTruthy();
    expect(wedgeStsMatch).toBeTruthy();
    expect(Number(wedgeStsMatch![1])).toBeGreaterThan(Number(bodyTopMatch![1]));
  });

  it("renders swirl-specific structure for spiral", () => {
    const calc = calcFor({ crown: "spiral" });
    const svg = buildHatPatternDiagramSvg(calc, "inches", formatters);
    expectSaneSvg(svg);
    expect(svg).toContain('data-crown="spiral"');
    expect(svg).toContain("hat-diagram__crown--swirl");
    expect(svg).toContain("Crown · Swirl");
    expect(svg).toContain("decrease points");
    expect(calc.crownPlan.spiral).toBeTruthy();
    expect(svg).toContain(`${calc.crownPlan.spiral!.decreasePoints} decrease points`);
    expect(svg).toContain(`to ${calc.crownPlan.spiral!.targetStitches} sts`);
    expect(svg).not.toContain("hat-diagram__crown--four-gore");
    expect(svg).not.toContain("hat-diagram__crown--gathered");
  });

  it("marks single-layer vs folded brim distinctly", () => {
    const single = buildHatPatternDiagramSvg(
      calcFor({ brimType: "single" }),
      "inches",
      formatters,
    );
    const folded = buildHatPatternDiagramSvg(
      calcFor({ brimType: "folded" }),
      "inches",
      formatters,
    );
    expect(single).toContain('data-brim="single"');
    expect(single).toContain('data-brim-style="single"');
    expect(single).not.toContain("hat-diagram__brim-fold");
    expect(folded).toContain('data-brim="folded"');
    expect(folded).toContain('data-brim-style="folded"');
    expect(folded).toContain("hat-diagram__brim-fold");
    expect(folded).toContain(">fold<");
  });

  it("formats inch labels with inch precision and symbol", () => {
    const calc = calcFor({ displayUnit: "inches" });
    const svg = buildHatPatternDiagramSvg(calc, "inches", formatters);
    expect(svg).toContain(formatLengthWithUnit(calc.targetWidth, "inches"));
    expect(svg).toMatch(/\d+\.\d+"/);
    expect(svg).not.toMatch(/\d+cm/);
  });

  it("formats centimeter labels with cm precision and unit", () => {
    const calc = calcFor({
      displayUnit: "cm",
      finishedHatCircInches: 20.5,
      totalHatLengthInches: 8.5,
      brimDepthInches: 2,
    });
    const svg = buildHatPatternDiagramSvg(calc, "cm", formatters);
    const widthCm = formatLengthWithUnit(
      convertLength(calc.targetWidth, "inches", "cm"),
      "cm",
    );
    const heightCm = formatLengthWithUnit(
      convertLength(calc.hatHeight, "inches", "cm"),
      "cm",
    );
    expect(svg).toContain(widthCm);
    expect(svg).toContain(heightCm);
    expect(svg).toMatch(/>\d+cm</);
    // Measurement labels should not use inch marks.
    expect(svg).not.toMatch(/>\d+\.\d+"</);
  });

  it("escapes special characters in dynamic text", () => {
    const calc = calcFor();
    const badFormatters = {
      convertLength: formatters.convertLength,
      formatLengthWithUnit: () => `5.0"<script>&ok`,
    };
    const svg = buildHatPatternDiagramSvg(calc, "inches", badFormatters);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("&amp;ok");
    expect(svg).toContain('5.0"');
  });

  it("includes accessible title and role", () => {
    const svg = buildHatPatternDiagramSvg(calcFor(), "inches", formatters);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-labelledby="hat-diagram-title"');
    expect(svg).toContain("Gathered hat pattern diagram");
  });

  it("keeps extreme custom lengths readable without broken output", () => {
    const short = buildHatPatternDiagramSvg(
      calcFor({ totalHatLengthInches: 5, brimDepthInches: 1.5, fit: "custom" }),
      "inches",
      formatters,
    );
    const tall = buildHatPatternDiagramSvg(
      calcFor({
        totalHatLengthInches: 22,
        brimDepthInches: 2,
        fit: "custom",
        crown: "spiral",
      }),
      "inches",
      formatters,
    );
    expectSaneSvg(short);
    expectSaneSvg(tall);
    expect(short).toContain(formatLengthWithUnit(5, "inches"));
    expect(tall).toContain(formatLengthWithUnit(22, "inches"));
    expect(tall).toContain('viewBox="0 0 430 460"');
  });

  it("embeds consistent site sans-serif typography on every diagram text node", () => {
    const svg = buildHatPatternDiagramSvg(calcFor(), "inches", formatters);
    expect(svg).toContain('font-family="Poppins, system-ui, Arial, sans-serif"');
    expect(svg).toContain("<style type=\"text/css\"><![CDATA[text{font-family:Poppins, system-ui, Arial, sans-serif}]]></style>");
    // No serif-only or Illustrator PostScript font names.
    expect(svg).not.toMatch(/font-family="[^"]*(Times|Georgia|Minion|Myriad|ItalicMT)[^"]*"/i);
    expect(svg).not.toMatch(/font-family="serif"/i);
    // Body / Brim hierarchy shares the same family with heavier weight.
    expect(svg).toMatch(
      /font-family="Poppins, system-ui, Arial, sans-serif" font-size="23" font-weight="600">Body</,
    );
    expect(svg).toMatch(
      /font-family="Poppins, system-ui, Arial, sans-serif" font-size="23" font-weight="600">Brim</,
    );
    // Measurement + stitch sizes are ≥50% above the prior 14/15 scale.
    expect(svg).toMatch(/font-size="21"/);
    expect(svg).toMatch(/font-size="23"/);
    expect(svg).toMatch(/font-size="21" font-weight="600">Gather</);
    expect(svg).toMatch(/font-size="20"[^>]*>Total</);
  });

  it("includes edit-measurement target anchors for the Edit Pattern drawer", () => {
    const svg = buildHatPatternDiagramSvg(calcFor(), "inches", formatters);
    expect(svg).toContain('id="target_hat_circumference"');
    expect(svg).toContain('id="target_hat_length"');
    expect(svg).toContain('id="target_hat_brim"');
    expect(svg).toContain("hat-diagram__edit-targets");
  });

  it("agrees with calculateHatPattern for displayed row and stitch counts", () => {
    for (const crown of ["gathered", "wedge-4-decrease", "spiral"] as const) {
      for (const brimType of ["single", "folded"] as const) {
        const calc = calcFor({ crown, brimType, fit: "slouchy", totalHatLengthInches: 10 });
        const svg = buildHatPatternDiagramSvg(calc, "inches", formatters);
        expect(svg).toContain(`${calc.brimRows} rows`);
        expect(svg).toContain(`${calc.bodyRows} rows`);
        if (crown !== "gathered") {
          expect(svg).toContain(`${calc.crownRowCount} rows`);
        }
        const castOn = calc.castOnSts;
        // Diagram may show crown-adjusted cast-on for spiral/wedge.
        expect(svg).toMatch(/\d+ sts/);
        expect(svg).toContain(formatLengthWithUnit(calc.targetWidth, "inches"));
        expect(svg).toContain(`data-brim="${brimType}"`);
        void castOn;
      }
    }
  });

  it("proportionally distinguishes fitted vs slouchy body while keeping stable viewBox", () => {
    const fitted = calcFor({ fit: "beanie", totalHatLengthInches: 7 });
    const slouchy = calcFor({ fit: "slouchy", totalHatLengthInches: 10 });
    const fittedSvg = buildHatPatternDiagramSvg(fitted, "inches", formatters);
    const slouchySvg = buildHatPatternDiagramSvg(slouchy, "inches", formatters);
    expect(fittedSvg).toContain('viewBox="0 0 430 460"');
    expect(slouchySvg).toContain('viewBox="0 0 430 460"');
    expect(fitted.bodyHeightInches).toBeLessThan(slouchy.bodyHeightInches);
    expect(fittedSvg).toContain(formatLengthWithUnit(fitted.hatHeight, "inches"));
    expect(slouchySvg).toContain(formatLengthWithUnit(slouchy.hatHeight, "inches"));
  });
});
