import { describe, expect, it } from "vitest";
import {
  convertLength,
  formatLength,
  formatLengthWithUnit,
} from "../../../components/wizards/utils/unitHelpers";
import { calculateHatPattern, hatCrownStartRow, hatKnittedFinishedCircumferenceInches } from "./hatMath";
import {
  formatHatDiagramSectionLengthFromRows,
  hatDiagramSectionInchesFromRows,
} from "./hatDiagram";
import { buildHatPatternHtml } from "./hatInstructions";
import {
  buildHatPatternDiagramSvg,
  HAT_PATTERN_DIAGRAM_MODE_PATTERN,
  HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
  HAT_SUMMARY_EDIT_DIAGRAM_LEFT_PAD,
} from "./hatPatternDiagramSvg";

const formatters = {
  convertLength: convertLength as (v: number, from: string, to: string) => number,
  formatLengthWithUnit: formatLengthWithUnit as (v: number, unit: string) => string,
};

function displayedCircumference(
  calc: ReturnType<typeof calculateHatPattern>,
  unit: "inches" | "cm" = "inches",
): string {
  const inches = hatKnittedFinishedCircumferenceInches(calc);
  const value = unit === "inches" ? inches : convertLength(inches, "inches", "cm");
  return formatLengthWithUnit(value, unit);
}

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

function rowDerivedLength(
  rows: number,
  calc: ReturnType<typeof calculateHatPattern>,
  unit: "inches" | "cm" = "inches",
): string {
  return formatHatDiagramSectionLengthFromRows(
    rows,
    calc.rowGaugePerInch,
    unit,
    formatters,
  );
}

function expectRowPairedSectionLengths(
  svg: string,
  calc: ReturnType<typeof calculateHatPattern>,
  unit: "inches" | "cm" = "inches",
): void {
  expect(svg).toContain(`${calc.brimRows} rows`);
  expect(svg).toContain(rowDerivedLength(calc.brimRows, calc, unit));
  expect(svg).toContain(`${calc.bodyRows} rows`);
  expect(svg).toContain(rowDerivedLength(calc.bodyRows, calc, unit));
  const isGathered =
    calc.crown !== "wedge-4" &&
    calc.crown !== "wedge-4-decrease" &&
    calc.crown !== "spiral";
  if (!isGathered) {
    expect(svg).toContain(`${calc.crownRowCount} rows`);
    expect(svg).toContain(rowDerivedLength(calc.crownRowCount, calc, unit));
  }
  expect(svg).toContain(
    unit === "inches"
      ? formatLengthWithUnit(calc.hatHeight, "inches")
      : formatLengthWithUnit(convertLength(calc.hatHeight, "inches", "cm"), "cm"),
  );
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
    expect(svg).toContain(rowDerivedLength(calc.brimRows, calc));
  });

  it("renders four-gore-specific structure for wedge-4-decrease", () => {
    const calc = calcFor({ crown: "wedge-4-decrease" });
    const svg = buildHatPatternDiagramSvg(calc, "inches", formatters);
    expectSaneSvg(svg);
    expect(svg).toContain('data-crown="wedge-4-decrease"');
    expect(svg).toContain("hat-diagram__crown--four-gore");
    expect(svg).toContain("Crown · 4 gores");
    expect(svg).toContain(">#1<");
    expect(svg).toContain(">#2<");
    expect(svg).toContain(">#3<");
    expect(svg).toContain(">#4<");
    expect(svg).not.toContain("Gore #");
    expect(svg).not.toContain(">Gore<");
    expect(svg).toContain("sts / gore");
    expect(svg).not.toContain("textLength=");
    expect(svg).toContain(`${calc.crownRowCount} rows`);
    expect(svg).toContain(rowDerivedLength(calc.crownRowCount, calc));
    expect(svg).not.toContain("hat-diagram__crown--gathered");
    expect(svg).not.toContain("hat-diagram__crown--swirl");

    // Full-height measurement value remains; "Total" caption is omitted for four-gore.
    expect(svg).toContain(formatLengthWithUnit(calc.hatHeight, "inches"));
    expect(svg).not.toContain(">Total<");

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
    expect(calc.crownPlan.spiral).toBeTruthy();
    const spiralPlan = calc.crownPlan.spiral!;
    expect(spiralPlan.decreasePoints).toBe(6);

    // Calculated one-sided sections; shared trailing decrease direction.
    expect(svg).toContain(`data-swirl-section-count="${spiralPlan.decreasePoints}"`);
    expect(svg).toContain('data-swirl-decrease-edge="trailing"');
    const sectionMatches = svg.match(/class="hat-diagram__swirl-section"/g) ?? [];
    expect(sectionMatches).toHaveLength(spiralPlan.decreasePoints);
    for (let i = 1; i <= spiralPlan.decreasePoints; i += 1) {
      expect(svg).toMatch(
        new RegExp(
          `hat-diagram__swirl-section"[^>]*data-section-index="${i}"[^>]*data-decrease-edge="trailing"[^>]*data-non-decrease-edge="leading"`,
        ),
      );
    }

    // Schedule-driven section count + one instruction-line transfer icon.
    expect(svg).toContain(`>${spiralPlan.decreasePoints} sections<`);
    expect(svg).toContain(
      `data-swirl-section-label="${spiralPlan.decreasePoints} sections"`,
    );
    expect(svg).toContain("decrease at one edge");
    expect(svg).not.toContain("decrease at one edge of each section");
    expect(svg).toContain('data-swirl-label-placement="above-crown"');
    expect(svg).toContain('data-swirl-instruction="decrease-one-edge"');
    expect(svg).toContain("hat-diagram__swirl-instruction-icon");
    expect(svg).toContain("/icons/patterns/transfer-step.svg");
    // One instruction-line icon element (href + xlink:href both reference the asset).
    expect(svg.match(/class="hat-diagram__swirl-instruction-icon"/g)?.length).toBe(1);
    expect(svg.match(/<image[^>]*hat-diagram__swirl-instruction-icon/g)?.length).toBe(1);
    // No per-section transfer markers on the crown drawing.
    expect(svg).not.toContain("hat-diagram__swirl-decrease-marker");
    expect(svg).not.toContain("decrease points");
    expect(svg).not.toContain("6 decrease points");

    // Ending stitch-total label removed from the diagram only.
    expect(svg).not.toMatch(/to \d+ sts/);
    expect(svg).not.toContain(`to ${spiralPlan.targetStitches} sts`);
    expect(svg).not.toContain("hat-diagram__swirl-target");

    // Full-height measurement value remains; "Total" caption is omitted for swirl.
    expect(svg).toContain(formatLengthWithUnit(calc.hatHeight, "inches"));
    expect(svg).not.toContain(">Total<");

    // Label sits above the crown outline; title precedes the supporting callout.
    const titleIdx = svg.indexOf("hat-diagram__swirl-title");
    const labelIdx = svg.indexOf("hat-diagram__swirl-section-label");
    const instructionIdx = svg.indexOf("hat-diagram__swirl-instruction");
    const outlineIdx = svg.indexOf("hat-diagram__swirl-outline");
    expect(titleIdx).toBeGreaterThan(-1);
    expect(labelIdx).toBeGreaterThan(titleIdx);
    expect(instructionIdx).toBeGreaterThan(labelIdx);
    expect(outlineIdx).toBeGreaterThan(instructionIdx);

    // Supporting text uses the smaller small-token size; heading uses crownTitle.
    expect(svg).toMatch(/hat-diagram__swirl-title"[^>]*font-size="21"/);
    expect(svg).toMatch(/hat-diagram__swirl-section-label"[^>]*font-size="18"/);
    expect(svg).toMatch(/hat-diagram__swirl-instruction-text"[^>]*font-size="18"/);

    expect(svg).not.toContain("hat-diagram__crown--four-gore");
    expect(svg).not.toContain("hat-diagram__crown--gathered");
  });

  it("keeps four-gore and gathered crowns unchanged relative to swirl geometry", () => {
    const gathered = buildHatPatternDiagramSvg(
      calcFor({ crown: "gathered" }),
      "inches",
      formatters,
    );
    const fourGore = buildHatPatternDiagramSvg(
      calcFor({ crown: "wedge-4-decrease" }),
      "inches",
      formatters,
    );
    expect(gathered).toContain("hat-diagram__crown--gathered");
    expect(gathered).not.toContain("hat-diagram__swirl-section");
    expect(gathered).not.toContain("hat-diagram__swirl-instruction-icon");
    expect(gathered).not.toContain("decrease at one edge");
    expect(gathered).toContain(">Total<");
    expect(fourGore).toContain("hat-diagram__crown--four-gore");
    expect(fourGore).toContain(">#1<");
    expect(fourGore).toContain("sts / gore");
    expect(fourGore).not.toContain("hat-diagram__swirl-section");
    expect(fourGore).not.toContain("hat-diagram__swirl-instruction-icon");
    expect(fourGore).not.toContain("decrease at one edge");
    expect(fourGore).not.toContain(">Total<");
  });

  it("marks single-layer vs folded vs rolled brim distinctly", () => {
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
    const rolled = buildHatPatternDiagramSvg(
      calcFor({ brimType: "rolled", brimDepthInches: 1 }),
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
    expect(rolled).toContain('data-brim="rolled"');
    expect(rolled).toContain('data-brim-style="rolled"');
    expect(rolled).toContain("hat-diagram__brim-roll");
    expect(rolled).toContain(">Rolled Brim<");
    expect(rolled).not.toContain("hat-diagram__brim-fold");
    expect(rolled).not.toContain(">fold<");
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
    // Anchors remain for chip positioning but must not paint as visible orange dots.
    expect(svg).toMatch(
      /id="target_hat_circumference"[^>]*fill="none"/,
    );
    expect(svg).toMatch(/id="target_hat_length"[^>]*fill="none"/);
    expect(svg).toMatch(/id="target_hat_brim"[^>]*fill="none"/);
    expect(svg).not.toMatch(/id="target_hat_[^"]+"[^>]*fill="#c2614e"/);
    expect(svg).not.toContain('fill="#c2614e"');
  });

  it("keeps measurement targets available for Summary/Edit overlays", () => {
    for (const mode of [
      HAT_PATTERN_DIAGRAM_MODE_PATTERN,
      HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
    ] as const) {
      for (const crown of ["gathered", "wedge-4-decrease", "spiral"] as const) {
        for (const brimType of ["rolled", "single", "folded"] as const) {
          const svg = buildHatPatternDiagramSvg(
            calcFor({ crown, brimType, fit: "slouchy", totalHatLengthInches: 10 }),
            "inches",
            formatters,
            mode,
          );
          expect(svg).toContain('id="target_hat_circumference"');
          expect(svg).toContain('id="target_hat_length"');
          expect(svg).toContain('id="target_hat_brim"');
          expect(svg).toContain("hat-diagram__edit-targets");
          expect(svg).not.toContain('fill="#c2614e"');
          const paintedTargets = svg.match(
            /<circle id="target_hat_[^"]+"[^>]*fill="(?!none)[^"]+"/g,
          );
          expect(paintedTargets).toBeNull();

          const hatLeft = 96;
          const hatRight = 296;
          const hatMidX = (hatLeft + hatRight) / 2;
          const hatBottom = 340;
          const circ = svg.match(
            /id="target_hat_circumference"\s+cx="([-\d.]+)"\s+cy="([-\d.]+)"/,
          );
          const length = svg.match(
            /id="target_hat_length"\s+cx="([-\d.]+)"\s+cy="([-\d.]+)"/,
          );
          const brim = svg.match(
            /id="target_hat_brim"\s+cx="([-\d.]+)"\s+cy="([-\d.]+)"/,
          );
          expect(circ).toBeTruthy();
          expect(length).toBeTruthy();
          expect(brim).toBeTruthy();
          expect(Number(circ![1])).toBeCloseTo(hatMidX, 0);
          expect(Number(circ![2])).toBeGreaterThan(hatBottom);
          expect(Number(length![1])).toBeLessThan(hatLeft);
          if (mode === HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT) {
            // Anchors sit on the dimension arrows; chips translate beside the lines.
            expect(Number(circ![2])).toBeCloseTo(hatBottom + 24, 0);
            expect(Number(length![1])).toBeCloseTo(54, 0);
            expect(Number(brim![1])).toBeCloseTo(338, 0);
            expect(svg).toContain(
              `viewBox="-${HAT_SUMMARY_EDIT_DIAGRAM_LEFT_PAD} 0 ${430 + HAT_SUMMARY_EDIT_DIAGRAM_LEFT_PAD} 460"`,
            );
          } else {
            expect(Number(circ![2])).toBeGreaterThan(hatBottom + 40);
            expect(Number(length![1])).toBeLessThan(54);
            expect(Number(brim![1])).toBeGreaterThan(338);
          }
        }
      }
    }
  });

  it("agrees with calculateHatPattern for displayed row and stitch counts in pattern mode", () => {
    for (const crown of ["gathered", "wedge-4-decrease", "spiral"] as const) {
      for (const brimType of ["rolled", "single", "folded"] as const) {
        const calc = calcFor({ crown, brimType, fit: "slouchy", totalHatLengthInches: 10 });
        const svg = buildHatPatternDiagramSvg(calc, "inches", formatters);
        expect(svg).toContain(`${calc.brimRows} rows`);
        expect(svg).toContain(`${calc.bodyRows} rows`);
        if (crown !== "gathered") {
          expect(svg).toContain(`${calc.crownRowCount} rows`);
        }
        expectRowPairedSectionLengths(svg, calc);
        expect(svg).toMatch(/\d+ sts/);
        expect(svg).toContain(displayedCircumference(calc));
        expect(svg).toContain(`data-brim="${brimType}"`);
      }
    }
  });

  it("summaryEdit mode omits stitch/row counts and inch/cm measurement text", () => {
    for (const crown of ["gathered", "wedge-4-decrease", "spiral"] as const) {
      for (const brimType of ["rolled", "single", "folded"] as const) {
        for (const unit of ["inches", "cm"] as const) {
          const calc = calcFor({
            crown,
            brimType,
            fit: "slouchy",
            totalHatLengthInches: 10,
            displayUnit: unit,
          });
          const svg = buildHatPatternDiagramSvg(
            calc,
            unit,
            formatters,
            HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
          );
          expect(svg).toContain('data-hat-diagram-mode="summaryEdit"');
          expect(svg).not.toMatch(/\d+\s*sts/);
          expect(svg).not.toMatch(/\d+\s*rows/);
          expect(svg).not.toContain("sts / gore");
          expect(svg).not.toContain("decrease points");
          // No finished inch or cm values in text nodes — editable chips are the only source.
          expect(svg).not.toMatch(/>\d+(?:\.\d+)?"</);
          expect(svg).not.toMatch(/>\d+(?:\.\d+)?\s*cm</i);
          expect(svg).not.toContain(
            formatLengthWithUnit(calc.hatHeight, "inches"),
          );
          expect(svg).not.toContain(
            formatLengthWithUnit(calc.targetWidth, "inches"),
          );
          expect(svg).not.toContain(displayedCircumference(calc, unit));
          expect(svg).not.toContain(
            formatLengthWithUnit(calc.brimDepth, "inches"),
          );
          // Section labels remain.
          expect(svg).toContain(">Body<");
          expect(svg).toMatch(/>Brim<|>Rolled Brim</);
          // Shared length chip owns the label; no SVG "Total" caption in any crown.
          expect(svg).not.toContain(">Total<");
          // Three measurement arrows remain (length / brim / width).
          expect(svg).toMatch(/x1="54"[^>]*stroke="#52682d"/);
          expect(svg).toMatch(/x1="338"[^>]*y1="[^"]+"[^>]*y2="[^"]+"[^>]*stroke="#52682d"/);
          expect(svg).toMatch(
            new RegExp(`y1="${340 + 24}"[^>]*stroke="#52682d"`),
          );
          // Targets for the three editable fields remain.
          expect(svg).toContain('id="target_hat_circumference"');
          expect(svg).toContain('id="target_hat_length"');
          expect(svg).toContain('id="target_hat_brim"');
          if (crown === "gathered") {
            expect(svg).toContain("Gather");
            // No duplicate right-side construction "gather" in summaryEdit.
            expect(svg).not.toMatch(/>gather</);
          }
          if (crown === "wedge-4-decrease") {
            expect(svg).toContain("Crown · 4 gores");
            expect(svg).toContain(">#1<");
            expect(svg).not.toContain("decrease points");
          }
          if (crown === "spiral") {
            expect(svg).toContain("Crown · Swirl");
            expect(svg).not.toContain("decrease points");
            expect(svg).not.toMatch(/to \d+ sts/);
          }
        }
      }
    }
  });

  it("pattern mode keeps stitch counts, row counts, and finished measurements", () => {
    const calc = calcFor({ crown: "wedge-4-decrease", brimType: "folded" });
    const patternSvg = buildHatPatternDiagramSvg(
      calc,
      "inches",
      formatters,
      HAT_PATTERN_DIAGRAM_MODE_PATTERN,
    );
    const summarySvg = buildHatPatternDiagramSvg(
      calc,
      "inches",
      formatters,
      HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
    );
    expect(patternSvg).toContain('data-hat-diagram-mode="pattern"');
    expect(summarySvg).toContain('data-hat-diagram-mode="summaryEdit"');
    expect(patternSvg).toContain(`${calc.brimRows} rows`);
    expect(patternSvg).toContain(`${calc.bodyRows} rows`);
    expect(patternSvg).toMatch(/\d+ sts/);
    expect(patternSvg).toContain("sts / gore");
    expect(patternSvg).toContain(formatLengthWithUnit(calc.hatHeight, "inches"));
    expect(patternSvg).toContain(displayedCircumference(calc));
    expect(patternSvg).toContain(rowDerivedLength(calc.brimRows, calc));
    expect(summarySvg).not.toMatch(/\d+\s*rows/);
    expect(summarySvg).not.toMatch(/\d+\s*sts/);
    expect(summarySvg).not.toMatch(/>\d+(?:\.\d+)?"</);
    expect(summarySvg).not.toContain(formatLengthWithUnit(calc.hatHeight, "inches"));
    // Same silhouette / generator; summaryEdit widens the left gutter for the length chip.
    expect(patternSvg).toContain('viewBox="0 0 430 460"');
    expect(summarySvg).toContain(
      `viewBox="-${HAT_SUMMARY_EDIT_DIAGRAM_LEFT_PAD} 0 ${430 + HAT_SUMMARY_EDIT_DIAGRAM_LEFT_PAD} 460"`,
    );
    expect(patternSvg).toContain('data-crown="wedge-4-decrease"');
    expect(summarySvg).toContain('data-crown="wedge-4-decrease"');
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

  it("scales silhouette width with finished circumference", () => {
    const narrow = calcFor({ finishedHatCircInches: 14 });
    const wide = calcFor({ finishedHatCircInches: 28 });
    const narrowSvg = buildHatPatternDiagramSvg(
      narrow,
      "inches",
      formatters,
      HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
    );
    const wideSvg = buildHatPatternDiagramSvg(
      wide,
      "inches",
      formatters,
      HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
    );
    const widthOf = (svg: string) => {
      const m = svg.match(/class="hat-diagram__body"[^>]*\swidth="([\d.]+)"/);
      expect(m).toBeTruthy();
      return Number(m![1]);
    };
    expect(widthOf(wideSvg)).toBeGreaterThan(widthOf(narrowSvg));
  });

  it("gathered summaryEdit omits the Total caption where the Finished hat length chip sits", () => {
    const fourGoreSummary = buildHatPatternDiagramSvg(
      calcFor({ crown: "wedge-4-decrease" }),
      "inches",
      formatters,
      HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
    );

    for (const unit of ["inches", "cm"] as const) {
      const calc = calcFor({ crown: "gathered", displayUnit: unit });
      const svg = buildHatPatternDiagramSvg(
        calc,
        unit,
        formatters,
        HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
      );

      expect(svg).toContain('data-crown="gathered"');
      expect(svg).toContain('data-hat-diagram-mode="summaryEdit"');
      // Length arrow remains; the shared chip is the only length label/value.
      expect(svg).toMatch(/x1="54"[^>]*stroke="#52682d"/);
      expect(svg).toContain('id="target_hat_length"');
      expect(svg).not.toContain(">Total<");
      expect(svg).not.toMatch(/rotate\(-90[^)]*\)"[^>]*>Total</);
      const heightLabel =
        unit === "inches"
          ? formatLengthWithUnit(calc.hatHeight, "inches")
          : formatLengthWithUnit(
              convertLength(calc.hatHeight, "inches", "cm"),
              "cm",
            );
      expect(svg).not.toContain(heightLabel);
      expect(svg).not.toMatch(/>\d+(?:\.\d+)?"</);
      expect(svg).not.toMatch(/>\d+(?:\.\d+)?\s*cm</i);
    }

    // Four-Gore Summary/Edit already omitted this caption — leave it unchanged.
    expect(fourGoreSummary).toContain('data-crown="wedge-4-decrease"');
    expect(fourGoreSummary).not.toContain(">Total<");
    expect(fourGoreSummary).toMatch(/x1="54"[^>]*stroke="#52682d"/);
    expect(fourGoreSummary).toContain('id="target_hat_length"');

    // Pattern-mode Gathered still shows the rotated Total caption beside the arrow.
    const gatheredPattern = buildHatPatternDiagramSvg(
      calcFor({ crown: "gathered" }),
      "inches",
      formatters,
    );
    expect(gatheredPattern).toContain(">Total<");
  });
});

const babyBeanieGathered16x24 = () =>
  calculateHatPattern({
    finishedHatCircInches: 16,
    stitchGaugeDisplay: 16,
    rowGaugeDisplay: 24,
    displayUnit: "inches",
    totalHatLengthInches: 6.2,
    brimDepthInches: 1,
    brimType: "single",
    crown: "gathered",
    suggestedCrownDepthInches: 1,
    fit: "beanie",
  });

describe("hat diagram section lengths from generated rows", () => {
  it("formats 26 rows at 6 rows/inch as 4.3\" and 6 rows as 1.0\"", () => {
    expect(hatDiagramSectionInchesFromRows(26, 6)).toBeCloseTo(26 / 6, 10);
    expect(formatHatDiagramSectionLengthFromRows(26, 6, "inches", formatters)).toBe(
      '4.3"',
    );
    expect(formatHatDiagramSectionLengthFromRows(6, 6, "inches", formatters)).toBe(
      '1.0"',
    );
    expect(formatLength(26 / 6, "inches")).toBe("4.3");
  });

  it("Baby / 16×24 / Beanie / 1\" Single / Gathered shows body 26 rows / 4.3\" with Total 6.2\"", () => {
    const calc = babyBeanieGathered16x24();
    expect(calc.rowGaugePerInch).toBe(6);
    expect(calc.castOnSts).toBe(64);
    expect(calc.bodyRows).toBe(26);
    expect(calc.brimRows).toBe(6);
    expect(calc.crownRowCount).toBe(6);
    expect(calc.bodyHeightInches).toBeCloseTo(4.2, 10);
    expect(calc.hatHeight).toBe(6.2);
    expect(hatCrownStartRow(calc)).toBe(32);

    const svg = buildHatPatternDiagramSvg(calc, "inches", formatters);
    expectSaneSvg(svg);
    expect(svg).toContain("26 rows");
    expect(svg).toContain('4.3"');
    expect(svg).toContain("6 rows");
    expect(svg).toContain('1.0"');
    expect(svg).toContain('6.2"');
    expect(svg).toContain("gather");
    expect(svg).not.toContain("12 rows");
    expect(svg).not.toContain(`>${formatLengthWithUnit(calc.bodyHeightInches, "inches")}<`);
    expectRowPairedSectionLengths(svg, calc);

    const html = buildHatPatternHtml({
      calc,
      currentUnit: "inches",
      scrapOffPatternTooltip: "Scrap Off",
      tipsIntroHtml: "",
      showTips: false,
      formatters: {
        convertLength: convertLength as (v: number, from: string, to: string) => number,
        formatLength: formatLength as (v: number, unit: string) => string,
      },
    });
    expect(html).toContain("Work 6 rows in your chosen brim finish.");
    expect(html).toContain("Work 26 rows in pattern after the brim.");
    expect(html).toContain("Begin crown shaping at RC 32.");
    expect(html).toContain("Knit 6 rows. RC is now 38.");
  });

  it("pairs section inches with generated rows for Gathered, Four-Gore, and Swirl", () => {
    const gauges = [
      { stitchGaugeDisplay: 5, rowGaugeDisplay: 7 },
      { stitchGaugeDisplay: 7, rowGaugeDisplay: 10 },
      { stitchGaugeDisplay: 16, rowGaugeDisplay: 24 },
      { stitchGaugeDisplay: 20, rowGaugeDisplay: 28 },
    ] as const;
    const crowns = ["gathered", "wedge-4-decrease", "spiral"] as const;
    let evenUpMismatchCases = 0;

    for (const gauge of gauges) {
      for (const crown of crowns) {
        const calc = calculateHatPattern({
          finishedHatCircInches: 16,
          stitchGaugeDisplay: gauge.stitchGaugeDisplay,
          rowGaugeDisplay: gauge.rowGaugeDisplay,
          displayUnit: "inches",
          totalHatLengthInches: 6.2,
          brimDepthInches: 1,
          brimType: "single",
          crown,
          suggestedCrownDepthInches: 1,
          fit: "beanie",
        });
        const svg = buildHatPatternDiagramSvg(calc, "inches", formatters);
        expectSaneSvg(svg);
        expectRowPairedSectionLengths(svg, calc);

        const plannedBody = formatLengthWithUnit(calc.bodyHeightInches, "inches");
        const displayedBody = rowDerivedLength(calc.bodyRows, calc);
        if (plannedBody !== displayedBody) {
          evenUpMismatchCases += 1;
          expect(svg).toContain(`>${displayedBody}<`);
          expect(svg).not.toContain(`>${plannedBody}<`);
        }

        const plannedBrim = formatLengthWithUnit(calc.brimDepth, "inches");
        const displayedBrim = rowDerivedLength(calc.brimRows, calc);
        if (plannedBrim !== displayedBrim) {
          evenUpMismatchCases += 1;
          expect(svg).toContain(`>${displayedBrim}<`);
          expect(svg).not.toContain(`>${plannedBrim}<`);
        }

        if (crown !== "gathered") {
          const plannedCrown = formatLengthWithUnit(calc.crownHeightInches, "inches");
          const displayedCrown = rowDerivedLength(calc.crownRowCount, calc);
          if (plannedCrown !== displayedCrown) {
            evenUpMismatchCases += 1;
            expect(svg).toContain(`>${displayedCrown}<`);
            expect(svg).not.toContain(`>${plannedCrown}<`);
          }
        }

        expect(svg).toContain(`>${formatLengthWithUnit(calc.hatHeight, "inches")}<`);
      }
    }

    expect(evenUpMismatchCases).toBeGreaterThan(0);
  });
});
