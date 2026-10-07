import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCurrentPattern } from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  resetExpressSweaterChartsForTests,
  seedExpressSweaterChartsForTests,
  type ChartRow,
} from "./sleevelessExpressSizeChartClient";
import { evenRowCountForShortRowShaping } from "./sidewaysCardiganBodyCalc";
import { readSidewaysCardiganBuilderStateFromDraft } from "./sidewaysCardiganBuilderState";
import { evenPositiveBodyStitches } from "./sleevelessBodyStitchMath";
import { inchesToRows } from "./sleevelessRowAccounting";
import { validateSidewaysCardiganBuilder } from "./sidewaysCardiganBuilderValidation";
import { renderSidewaysCardiganBandSectionHtml } from "./sidewaysCardiganFinishing";
import {
  defaultSidewaysCardiganStyleMeasurements,
  finishedBustInchesFromChartRow,
} from "./sidewaysCardiganStyleMeasurements";
import {
  findSidewaysCardiganChartRow,
  SIDEWAYS_CARDIGAN_CHART_AUDIENCES,
  type SidewaysCardiganChartAudience,
  type SidewaysCardiganChartRow,
} from "./sidewaysCardiganSizeCharts";
import { syncSidewaysCardiganBuilderToPatternStorage } from "./syncSidewaysCardiganBuilderToPatternStorage";
import { loadSidewaysCardiganWorkspaceView } from "./sidewaysCardiganWorkspaceLoad";
import type { SidewaysCardiganGarmentStyle } from "./sidewaysCardiganConstructionIdentity";

function seedRealSweaterCharts(): void {
  for (const audience of SIDEWAYS_CARDIGAN_CHART_AUDIENCES) {
    const rows = JSON.parse(
      readFileSync(resolve(`public/data/sizing_sweaters_${audience}.json`), "utf8"),
    ) as ChartRow[];
    seedExpressSweaterChartsForTests(audience, rows);
  }
}

function chartRow(audience: SidewaysCardiganChartAudience, size: string): SidewaysCardiganChartRow {
  const row = findSidewaysCardiganChartRow(size, audience);
  if (!row) throw new Error(`missing ${audience} size ${size}`);
  return row;
}

function generate(args: {
  audience: SidewaysCardiganChartAudience;
  size: string;
  garmentStyle: SidewaysCardiganGarmentStyle;
  availableNeedles?: string;
  gaugeStitchRaw?: string;
  gaugeRowRaw?: string;
  vNeckDepth?: string;
}) {
  const row = chartRow(args.audience, args.size);
  const styleMeasurements = {
    ...defaultSidewaysCardiganStyleMeasurements({
      row,
      chartAudience: args.audience,
      fitPreference: "standard",
      sleeveLengthChoice: "long",
    }),
    ...(args.vNeckDepth ? { vNeckDepth: args.vNeckDepth } : {}),
  };
  syncSidewaysCardiganBuilderToPatternStorage(
    {
      selectedSize: args.size,
      chartAudience: args.audience,
      fit: "standard",
      styleMeasurements,
      gaugeStitchRaw: args.gaugeStitchRaw ?? "20",
      gaugeRowRaw: args.gaugeRowRaw ?? "28",
      availableNeedles: args.availableNeedles ?? "200",
      unit: "in",
      sleeveLengthChoice: "long",
      garmentStyle: args.garmentStyle,
    },
    row,
  );
  const view = loadSidewaysCardiganWorkspaceView();
  expect(view.ok, view.ok ? "" : view.message).toBe(true);
  if (!view.ok) throw new Error(view.message);
  expect(view.instructions?.garmentStyle).toBe(args.garmentStyle);
  expect(view.instructionError).toBeUndefined();
  expect(view.sleeveError).toBeUndefined();
  expect(getCurrentPattern().style.recipientCategory).toBe(args.audience);
  expect(getCurrentPattern().fit.sizingChart).toBe(args.audience);
  expect(getCurrentPattern().fit.selectedSize).toBe(args.size);
  return { view, row, styleMeasurements };
}

describe("Sideways sizing families", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    seedRealSweaterCharts();
  });

  afterEach(() => {
    localStorage.clear();
    resetExpressSweaterChartsForTests();
  });

  it.each([
    ["men", "Med", "cardigan"],
    ["men", "Med", "pullover"],
    ["kids", "6 yr", "cardigan"],
    ["kids", "6 yr", "pullover"],
    ["baby", "3 mo", "cardigan"],
    ["baby", "3 mo", "pullover"],
    ["misses", "8", "cardigan"],
    ["plus", "X", "pullover"],
  ] as const)("generates a %s %s %s from the shared chart", (audience, size, garmentStyle) => {
    const { view } = generate({ audience, size, garmentStyle });
    expect(view.calc.garmentLengthStitches).toBeGreaterThan(0);
    expect(view.calc.frontRows).toBeGreaterThan(view.calc.halfNeckRows);
    expect(view.sleeveInstructions?.calc.topSts).toBeGreaterThan(0);
  });

  it("restores saved Men's, Kids', and Baby drafts on Build/Edit", () => {
    generate({ audience: "men", size: "Lg", garmentStyle: "cardigan" });
    expect(readSidewaysCardiganBuilderStateFromDraft().chartAudience).toBe("men");
    expect(readSidewaysCardiganBuilderStateFromDraft().selectedSize).toBe("Lg");

    generate({ audience: "kids", size: "10 yr", garmentStyle: "pullover" });
    expect(readSidewaysCardiganBuilderStateFromDraft().chartAudience).toBe("kids");
    expect(readSidewaysCardiganBuilderStateFromDraft().selectedSize).toBe("10 yr");
    expect(readSidewaysCardiganBuilderStateFromDraft().garmentStyle).toBe("pullover");

    generate({ audience: "baby", size: "3 mo", garmentStyle: "cardigan" });
    const baby = readSidewaysCardiganBuilderStateFromDraft();
    expect(baby.chartAudience).toBe("baby");
    expect(baby.selectedSize).toBe("3 mo");
    expect(baby.garmentStyle).toBe("cardigan");
  });

  it("keeps a saved Misses pattern on the Misses chart with the 1 inch hem and 2 inch band", () => {
    const { view } = generate({ audience: "misses", size: "4", garmentStyle: "cardigan" });
    const restored = readSidewaysCardiganBuilderStateFromDraft();
    expect(restored.chartAudience).toBe("misses");
    expect(restored.selectedSize).toBe("4");
    expect(view.sequenceHtml).toContain("about 1 inch from the hem edge");
    expect(view.sequenceHtml).not.toContain("¾ inch");
    expect(view.sleeveInstructions?.calc.finished.cuffDepthInches).toBe(2);
    const band = renderSidewaysCardiganBandSectionHtml({
      calc: view.calc,
      stitchesPerInch: view.input.stitchesPerInch,
      rowsPerInch: view.input.rowsPerInch,
      chartAudience: "misses",
    });
    expect(band).toContain("about 2 inches wide");
    expect(band).toContain("4-inch strip");
    expect(band).not.toContain("For an adult sweater");
  });

  it("keeps a saved Women's pattern on the plus key with the same finishing depths", () => {
    const { view } = generate({ audience: "plus", size: "2x", garmentStyle: "cardigan" });
    const restored = readSidewaysCardiganBuilderStateFromDraft();
    expect(restored.chartAudience).toBe("plus");
    expect(restored.selectedSize).toBe("2x");
    expect(getCurrentPattern().style.recipientCategory).toBe("plus");
    expect(view.sequenceHtml).toContain("about 1 inch from the hem edge");
    expect(view.sequenceHtml).not.toContain("¾ inch");
    const band = renderSidewaysCardiganBandSectionHtml({
      calc: view.calc,
      stitchesPerInch: view.input.stitchesPerInch,
      rowsPerInch: view.input.rowsPerInch,
      chartAudience: "plus",
    });
    expect(band).toContain("about 2 inches wide");
    expect(band).toContain("4-inch strip");
  });

  it("uses the ¾ inch hem and 2 inch knitted / 1 inch finished band for Baby 3 mo only", () => {
    const cardigan = generate({ audience: "baby", size: "3 mo", garmentStyle: "cardigan" });
    expect(cardigan.view.sequenceHtml).toContain("about ¾ inch from the hem edge");
    expect(cardigan.view.sequenceHtml).not.toContain("about 1 inch from the hem edge");
    expect(cardigan.view.sleeveInstructions?.calc.finished.cuffDepthInches).toBe(1);
    const band = renderSidewaysCardiganBandSectionHtml({
      calc: cardigan.view.calc,
      stitchesPerInch: cardigan.view.input.stitchesPerInch,
      rowsPerInch: cardigan.view.input.rowsPerInch,
      chartAudience: "baby",
    });
    expect(band).toContain("about 1 inch wide");
    expect(band).toContain("2-inch strip");
    expect(band).not.toContain("4-inch strip");
    expect(band).not.toContain("about 2 inches wide");

    const pullover = generate({ audience: "baby", size: "3 mo", garmentStyle: "pullover" });
    expect(pullover.view.sequenceHtml).toContain("about ¾ inch from the hem edge");
    expect(pullover.view.sequenceHtml).not.toContain("FRONT AND NECK BAND");

    const kids = generate({ audience: "kids", size: "4 yr", garmentStyle: "cardigan" });
    expect(kids.view.sequenceHtml).toContain("about 1 inch from the hem edge");
    expect(kids.view.sequenceHtml).not.toContain("¾ inch");
    const kidsBand = renderSidewaysCardiganBandSectionHtml({
      calc: kids.view.calc,
      stitchesPerInch: kids.view.input.stitchesPerInch,
      rowsPerInch: kids.view.input.rowsPerInch,
      chartAudience: "kids",
    });
    expect(kidsBand).toContain("4-inch strip");
    expect(kidsBand).toContain("about 2 inches wide");
  });

  it("warns when a large Men's body is longer than the needle bed", () => {
    const row = chartRow("men", "5X");
    const style = defaultSidewaysCardiganStyleMeasurements({
      row,
      chartAudience: "men",
      fitPreference: "standard",
      sleeveLengthChoice: "long",
    });
    const finishedBust = finishedBustInchesFromChartRow(row, "standard");
    const values = {
      chartAudience: "men" as const,
      selectedSize: "5X",
      fit: "standard",
      garmentStyle: "cardigan",
      finishedLengthInches: style.finishedLength,
      vNeckDepthInches: style.vNeckDepth,
      neckOpeningWidthInches: style.neckOpeningWidth,
      finishedUpperArmInches: style.finishedUpperArm,
      sleeveLengthInches: style.sleeveLength,
      wristInches: style.wrist,
      finishedBustInches: finishedBust,
      stitchesPerInch: 7,
      rowsPerInch: 10,
      availableNeedles: 200,
    };
    const blocked = validateSidewaysCardiganBuilder(values);
    expect(blocked?.code).toBe("needles-exceeded");
    expect(blocked?.message).toMatch(/204 needles/);
    expect(blocked?.message).toMatch(/garment length/i);

    expect(
      validateSidewaysCardiganBuilder({ ...values, availableNeedles: 220 }),
    ).toBeNull();
    expect(
      validateSidewaysCardiganBuilder({ ...values, stitchesPerInch: 5, rowsPerInch: 7 }),
    ).toBeNull();

    const misses = chartRow("misses", "8");
    const missesStyle = defaultSidewaysCardiganStyleMeasurements({
      row: misses,
      chartAudience: "misses",
      fitPreference: "standard",
      sleeveLengthChoice: "long",
    });
    expect(
      validateSidewaysCardiganBuilder({
        ...values,
        chartAudience: "misses",
        selectedSize: "8",
        finishedLengthInches: missesStyle.finishedLength,
        vNeckDepthInches: missesStyle.vNeckDepth,
        neckOpeningWidthInches: missesStyle.neckOpeningWidth,
        finishedUpperArmInches: missesStyle.finishedUpperArm,
        sleeveLengthInches: missesStyle.sleeveLength,
        wristInches: missesStyle.wrist,
        finishedBustInches: finishedBustInchesFromChartRow(misses, "standard"),
      }),
    ).toBeNull();
  });

  it("keeps a saved Baby V depth when the chart default is deeper", () => {
    const { view } = generate({
      audience: "baby",
      size: "3 mo",
      garmentStyle: "pullover",
      vNeckDepth: "1.5",
    });
    expect(readSidewaysCardiganBuilderStateFromDraft().styleMeasurements.vNeckDepth).toBe("1.5");
    expect(getCurrentPattern().fit.selectedMeasurements.front_neck_depth).toBe(1.5);
    expect(view.input.vNeckDepthInches).toBe(1.5);
    expect(view.summary.rows.find((row) => row.term === "V-neck depth")?.def).toContain("1.5 in");
  });

  it.each([
    ["3 mo", 4.5, 1.75, 8.75],
    ["6 mo", 5, 2, 9.75],
    ["12 mo", 5.5, 2.25, 10.25],
    ["18 mo", 5.75, 2.25, 10.75],
    ["24 mo", 5.75, 2.25, 11.25],
  ] as const)(
    "shapes Baby %s every other row at every investigated gauge",
    (size, neckOpening, vDepth, length) => {
      const row = chartRow("baby", size);
      expect(row.neck_opening).toBe(neckOpening);
      expect(row.front_neck_depth).toBe(vDepth);
      expect(row.garment_back_length).toBe(length);

      const gauges = [
        [16, 24],
        [20, 28],
        [24, 32],
        [28, 36],
        [28, 40],
        [32, 44],
        [36, 48],
      ] as const;

      for (const garmentStyle of ["cardigan", "pullover"] as const) {
        for (const [stitches, rows] of gauges) {
          const spi = stitches / 4;
          const rpi = rows / 4;
          const { view } = generate({
            audience: "baby",
            size,
            garmentStyle,
            gaugeStitchRaw: String(stitches),
            gaugeRowRaw: String(rows),
          });
          const { instructions } = view;
          if (!instructions) throw new Error(`${size} ${garmentStyle} ${stitches}x${rows} missing instructions`);

          expect(view.input.vNeckDepthInches).toBe(vDepth);
          expect(view.input.neckOpeningWidthInches).toBe(neckOpening);
          expect(view.calc.vNeckDepthStitches).toBe(evenPositiveBodyStitches(vDepth * spi));
          expect(view.calc.halfNeckRows).toBe(
            evenRowCountForShortRowShaping(inchesToRows(neckOpening / 2, rpi)),
          );
          expect(view.calc.garmentLengthStitches).toBe(evenPositiveBodyStitches(length * spi));
          expect(instructions.startingFrontStitches).toBeGreaterThan(0);
          expect(instructions.startingFrontStitches).toBe(
            view.calc.garmentLengthStitches - view.calc.vNeckDepthStitches,
          );

          const increase = instructions.increaseSequence;
          const decrease = instructions.decreaseSequence;
          expect(decrease).toEqual([...increase].reverse());
          expect(increase.length).toBe(instructions.firstV.shapingActions);
          expect(decrease.length).toBe(instructions.secondV.shapingActions);
          expect(increase.every((stitchesOnAction) => stitchesOnAction >= 1)).toBe(true);
          expect(increase.reduce((sum, n) => sum + n, 0)).toBe(view.calc.vNeckDepthStitches);
          expect(instructions.firstV.rowInterval).toBe(2);
          expect(instructions.secondV.rowInterval).toBe(2);
          expect(instructions.firstV.rows).toBe(view.calc.halfNeckRows);
          expect(instructions.secondV.rows).toBe(view.calc.halfNeckRows);

          const depthLabel = view.summary.rows.find((entry) => entry.term === "V-neck depth")?.def ?? "";
          expect(depthLabel).toContain(`${vDepth} in`);
          expect(view.sequenceHtml.length).toBeGreaterThan(0);

          if (garmentStyle === "pullover") {
            expect(instructions.secondV.rowsBeforeFirstAction).toBe(2);
            expect(instructions.pulloverCenterV?.castOnNecklineStitches).toBe(
              view.calc.vNeckDepthStitches,
            );
            expect(instructions.pulloverCenterV?.boundOffNecklineStitches).toBe(
              view.calc.vNeckDepthStitches,
            );
          }
        }
      }
    },
  );

  it("leaves Misses, Women's, Kids', and Men's V depths on their current charts", () => {
    expect(chartRow("misses", "4").front_neck_depth).toBe(5);
    expect(chartRow("plus", "X").front_neck_depth).toBe(5);
    expect(chartRow("kids", "6 yr").front_neck_depth).toBe(3);
    expect(chartRow("men", "Med").front_neck_depth).toBe(4.25);

    const misses = generate({ audience: "misses", size: "4", garmentStyle: "cardigan" });
    expect(misses.view.input.vNeckDepthInches).toBe(5);
    expect(misses.view.instructions?.increaseSequence.every((n) => n >= 1)).toBe(true);

    const plus = generate({ audience: "plus", size: "2x", garmentStyle: "pullover" });
    expect(plus.view.input.vNeckDepthInches).toBe(5.5);
    expect(plus.view.instructions?.decreaseSequence).toEqual(
      [...(plus.view.instructions?.increaseSequence ?? [])].reverse(),
    );
  });
});
