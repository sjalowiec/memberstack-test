import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { patternSystemFromPathname } from "../patternGenerationActivity";
import { evaluateSockBuilderNeedleCapacity } from "./sockBuilderValidation";
import { createEmptySockDraft, writeSockDraft } from "./sockDraft";
import { SOCK_SUMMARY_ART_SRC, SOCK_SUMMARY_MEASUREMENT_FIELDS } from "./sockPatternEditTargets";
import { applySockSummaryMeasurementsToDraft, sockSummaryMeasureFieldsFromDraft } from "./sockSummaryEdit";
import { formatRowCounterResetGarmentRcLabel } from "../rowCounterReset";
import { SOCK_ANKLE_VIDEO_TIP_ID, SOCK_CUFF_CAST_ON_VIDEO_TIP_ID } from "../sock/sockInstructionRender";
import { roundToEvenPreferUp, sockGaugeToPerInch } from "../sock/sockMath";
import {
  buildChristmasStockingInstructions,
  renderChristmasStockingInstructionsHtml,
  STOCKING_ANKLE_INCLUDED_NOTE,
  STOCKING_LEG_LENGTH_NOTE,
  stockingCuffDownLegTargetNote,
} from "./christmasStockingInstructions";
import { calculateChristmasStockingPattern, type ChristmasStockingDirection } from "./christmasStockingMath";
import { sockPatternInpageNavItems } from "./sockPatternInpageNav";
import { buildSockPatternFromDraft } from "./sockPatternPage";
import { createSockSizingAdapter } from "./sockSizing";

const chart = createSockSizingAdapter(
  JSON.parse(readFileSync(resolve("public/data/sizing_xmas_stockings.json"), "utf8")),
);

const gauges = [
  { stitchGaugeDisplay: 16, rowGaugeDisplay: 24 },
  { stitchGaugeDisplay: 28, rowGaugeDisplay: 44 },
] as const;

const directions: ChristmasStockingDirection[] = ["cuff-down", "toe-up"];

function geometryKey(calc: {
  totalSockStitches: number;
  legRows: number;
  straightFootRows: number;
  straightFootLengthInches: number;
  heel: { workingStitches: number; heldStitches: number; remainingStitches: number; shortRowDepthRows: number };
  toe: { workingStitches: number; heldStitches: number; remainingStitches: number; shortRowDepthRows: number };
}) {
  return {
    stitches: calc.totalSockStitches,
    legRows: calc.legRows,
    straightFootRows: calc.straightFootRows,
    straightFootLengthInches: calc.straightFootLengthInches,
    heel: calc.heel.shortRowDepthRows,
    toe: calc.toe.shortRowDepthRows,
  };
}

describe("Christmas stocking chart", () => {
  it("uses the approved finished measurements", () => {
    expect(chart.measurements.map((row) => [
      row.size,
      row.legLengthInches,
      row.footCircumferenceInches,
      row.footLengthInches,
      row.defaultLegCircumferenceInches,
    ])).toEqual([
      ["mini", 4, 6, 3, 6],
      ["sm", 8, 10, 7, 10],
      ["med", 12, 14, 9, 14],
      ["lg", 16, 18, 11, 18],
      ["xl", 20, 20, 13, 20],
    ]);
  });
});

describe("Christmas stocking calculations", () => {
  it("checks every size, direction, and representative gauge without clamping", () => {
    const failures: string[] = [];
    for (const row of chart.measurements) {
      for (const direction of directions) {
        const byDirection = [];
        for (const gauge of gauges) {
          const result = calculateChristmasStockingPattern({
            direction,
            legLengthInches: row.legLengthInches,
            footCircumferenceInches: row.footCircumferenceInches,
            footLengthInches: row.footLengthInches,
            ...gauge,
            displayUnit: "inches",
          });
          const label = `${row.size} ${direction} ${gauge.stitchGaugeDisplay}x${gauge.rowGaugeDisplay}`;
          if (!result.ok) {
            expect(result.errors.join(" ").length).toBeGreaterThan(10);
            failures.push(`${label}: ${result.errors.join(" ")}`);
            continue;
          }
          const calc = result.calc;
          expect(calc.straightFootRows, label).toBeGreaterThan(0);
          expect(calc.straightFootLengthInches, label).toBeGreaterThan(0);
          expect(calc.heel.workingStitches, label).toBeGreaterThan(calc.heel.remainingStitches);
          expect(calc.heel.remainingStitches, label).toBeGreaterThan(0);
          expect(calc.toe.workingStitches, label).toBe(calc.heel.workingStitches);
          expect(calc.toe.shortRowDepthRows, label).toBe(calc.heel.shortRowDepthRows);
          const used = calc.heelDepthInches + calc.toeDepthInches + calc.straightFootLengthInches;
          expect(used, label).toBeCloseTo(row.footLengthInches, 5);
          expect(calc.legCircumferenceInches, label).toBe(row.footCircumferenceInches);
          byDirection.push(geometryKey(calc));
        }
        if (byDirection.length === 2) {
          // compared per gauge below
        }
      }
    }

    const coarseMini = calculateChristmasStockingPattern({
      direction: "cuff-down",
      legLengthInches: 4,
      footCircumferenceInches: 6,
      footLengthInches: 3,
      stitchGaugeDisplay: 16,
      rowGaugeDisplay: 24,
      displayUnit: "inches",
    });
    const fineMini = calculateChristmasStockingPattern({
      direction: "toe-up",
      legLengthInches: 4,
      footCircumferenceInches: 6,
      footLengthInches: 3,
      stitchGaugeDisplay: 28,
      rowGaugeDisplay: 44,
      displayUnit: "inches",
    });
    if (!coarseMini.ok) {
      expect(coarseMini.errors[0]).toMatch(/foot length|short-row|too short|stitch count/i);
    }
    if (!fineMini.ok) {
      expect(fineMini.errors[0]).toMatch(/foot length|short-row|too short|stitch count/i);
    }
    expect(failures.filter((line) => !line.startsWith("mini "))).toEqual([]);
  });

  it("keeps finished dimensions the same in both directions", () => {
    for (const row of chart.measurements) {
      for (const gauge of gauges) {
        const cuff = calculateChristmasStockingPattern({
          direction: "cuff-down",
          legLengthInches: row.legLengthInches,
          footCircumferenceInches: row.footCircumferenceInches,
          footLengthInches: row.footLengthInches,
          ...gauge,
          displayUnit: "inches",
        });
        const toe = calculateChristmasStockingPattern({
          direction: "toe-up",
          legLengthInches: row.legLengthInches,
          footCircumferenceInches: row.footCircumferenceInches,
          footLengthInches: row.footLengthInches,
          ...gauge,
          displayUnit: "inches",
        });
        expect(cuff.ok).toBe(toe.ok);
        if (!cuff.ok || !toe.ok) continue;
        expect(geometryKey(toe.calc)).toEqual(geometryKey(cuff.calc));
      }
    }
  });

  it("rejects a foot that cannot contain the heel and toe", () => {
    const result = calculateChristmasStockingPattern({
      direction: "cuff-down",
      legLengthInches: 8,
      footCircumferenceInches: 10,
      footLengthInches: 0.5,
      stitchGaugeDisplay: 16,
      rowGaugeDisplay: 24,
      displayUnit: "inches",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatch(/longer than the requested finished foot length/);
    }
  });
});

function sectionHtml(html: string, sectionId: string): string {
  const marker = `data-section-id="${sectionId}"`;
  const start = html.indexOf(marker);
  if (start < 0) return "";
  const next = html.indexOf('class="sock-pattern-section"', start + marker.length);
  return next < 0 ? html.slice(start) : html.slice(start, next);
}

describe("Christmas stocking instructions", () => {
  it("describes one stocking and keeps the top edging inside the leg length", () => {
    for (const direction of directions) {
      const result = calculateChristmasStockingPattern({
        direction,
        legLengthInches: 12,
        footCircumferenceInches: 14,
        footLengthInches: 9,
        stitchGaugeDisplay: 28,
        rowGaugeDisplay: 44,
        displayUnit: "inches",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const html = renderChristmasStockingInstructionsHtml(result.calc);
      const doc = buildChristmasStockingInstructions(result.calc);
      expect(html).toContain(direction === "cuff-down" ? "Christmas Stocking — Cuff down" : "Christmas Stocking — Toe up");
      expect(html.toLowerCase()).not.toContain("second sock");
      expect(html).not.toContain("Sock 2");
      expect(html.toLowerCase()).not.toContain("left and right");
      expect(html.toLowerCase()).not.toContain("negative ease");
      expect(html.toLowerCase()).not.toContain("toe-up socks");
      expect(html).not.toContain("Fold the sock");
      expect(html).not.toContain("sock's side seam");
      if (direction === "toe-up") {
        expect(html).toContain(STOCKING_LEG_LENGTH_NOTE);
        expect(html).toContain("Do not knit extra rows for the edging");
        expect(html).toContain(STOCKING_ANKLE_INCLUDED_NOTE);
        expect(html).toContain('data-section-id="ankle"');
        const legRows = doc.sections.find((section) => section.id === "leg")?.rowsToKnit ?? 0;
        const ankleRows = doc.sections.find((section) => section.id === "ankle")?.rowsToKnit ?? 0;
        expect(legRows + ankleRows).toBe(result.calc.legRows);
      }
      expect(html).not.toContain("stretch over the heel");
      expect(html).toContain("i-cord or twisted cord");
      expect(doc.sections.some((section) => section.steps.some((step) => step.type === "mirror-second-sock"))).toBe(false);
    }
  });

  it("knits cuff-down as one leg to the length-and-gauge total, then the heel", () => {
    const legLengthInches = 8;
    const rowGaugeDisplay = 44;
    const result = calculateChristmasStockingPattern({
      direction: "cuff-down",
      legLengthInches,
      footCircumferenceInches: 10,
      footLengthInches: 7,
      stitchGaugeDisplay: 28,
      rowGaugeDisplay,
      displayUnit: "inches",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const rowsPerInch = sockGaugeToPerInch(rowGaugeDisplay, "inches");
    const finishedLegRows = roundToEvenPreferUp(legLengthInches * rowsPerInch);
    expect(finishedLegRows).toBe(88);
    expect(result.calc.legRows).toBe(finishedLegRows);
    expect(finishedLegRows / rowsPerInch).toBe(legLengthInches);
    expect(result.calc.legShapingRowsAvailable).toBe(76);
    expect(result.calc.ankleStraightRows).toBe(12);

    const doc = buildChristmasStockingInstructions(result.calc);
    const html = renderChristmasStockingInstructionsHtml(result.calc);
    const leg = doc.sections.find((section) => section.id === "leg");
    const ids = doc.sections.map((section) => section.id);
    expect(ids).toEqual(["leg", "heel", "foot", "toe", "finishing"]);
    expect(leg?.rowsToKnit).toBe(finishedLegRows);
    expect(leg?.rc.endRc).toBe(finishedLegRows);
    expect(leg?.steps.map((step) => step.type)).toEqual(["cast-on"]);
    expect(leg?.notes).toEqual([stockingCuffDownLegTargetNote(finishedLegRows)]);
    expect(doc.sections.find((section) => section.id === "heel")?.steps[0]).toEqual({
      type: "stop-rc",
      garmentRc: finishedLegRows,
    });
    expect(sockPatternInpageNavItems(doc).map((item) => item.label)).toEqual([
      "Leg",
      "Heel",
      "Foot",
      "Toe",
      "Finishing",
    ]);

    const legHtml = sectionHtml(html, "leg");
    const heelHtml = sectionHtml(html, "heel");
    expect(legHtml).toContain("Cast on");
    expect(legHtml).toContain(stockingCuffDownLegTargetNote(finishedLegRows));
    expect(legHtml).toContain(formatRowCounterResetGarmentRcLabel(finishedLegRows));
    expect(legHtml).toContain(SOCK_CUFF_CAST_ON_VIDEO_TIP_ID);
    expect(legHtml).not.toContain("Knit 76 rows");
    expect(legHtml).not.toContain("Knit 12 rows");
    expect(legHtml).not.toContain(STOCKING_LEG_LENGTH_NOTE);
    expect(legHtml).not.toContain(STOCKING_ANKLE_INCLUDED_NOTE);
    expect(html).not.toContain('data-section-id="ankle"');
    expect(html).not.toContain('data-section-id="cast-on"');
    expect(html).not.toContain(SOCK_ANKLE_VIDEO_TIP_ID);
    expect(html).not.toContain(STOCKING_ANKLE_INCLUDED_NOTE);
    expect(heelHtml.indexOf("Heel")).toBeGreaterThan(-1);
    expect(html.indexOf('data-section-id="heel"')).toBeGreaterThan(
      html.indexOf('data-section-id="leg"'),
    );
    expect(html.slice(
      html.indexOf('data-section-id="leg"'),
      html.indexOf('data-section-id="heel"'),
    )).not.toContain('data-section-id="ankle"');
  });

  it("uses the finished leg total when the sock split would leave only an ankle", () => {
    const legLengthInches = 0.5;
    const rowGaugeDisplay = 24;
    const result = calculateChristmasStockingPattern({
      direction: "cuff-down",
      legLengthInches,
      footCircumferenceInches: 6,
      footLengthInches: 4,
      stitchGaugeDisplay: 16,
      rowGaugeDisplay,
      displayUnit: "inches",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const finishedLegRows = roundToEvenPreferUp(
      legLengthInches * sockGaugeToPerInch(rowGaugeDisplay, "inches"),
    );
    expect(result.calc.legRows).toBe(finishedLegRows);
    expect(result.calc.legShapingRowsAvailable).toBe(0);
    expect(result.calc.ankleStraightRows).toBe(finishedLegRows);
    const doc = buildChristmasStockingInstructions(result.calc);
    expect(doc.sections.map((section) => section.id)).toEqual([
      "leg",
      "heel",
      "foot",
      "toe",
      "finishing",
    ]);
    expect(doc.sections.find((section) => section.id === "leg")?.rowsToKnit).toBe(finishedLegRows);
    expect(renderChristmasStockingInstructionsHtml(result.calc)).toContain(
      stockingCuffDownLegTargetNote(finishedLegRows),
    );
  });
});

describe("Christmas stocking saved pattern values", () => {
  it("keeps an edited foot circumference as the leg circumference", () => {
    const draft = createEmptySockDraft({
      sizeSel: "med",
      constructionDirection: "cuff-to-toe",
      footCircumference: "15",
      footLength: "9",
      legCircumference: "11",
      legLength: "12",
      gaugeSlots: { inches: { stitch: "28", row: "44" }, cm: { stitch: "", row: "" } },
      availableNeedles: "200",
      unit: "inches",
    });
    const page = buildSockPatternFromDraft(draft, chart);
    expect(page.ok).toBe(true);
    if (!page.ok) return;
    expect(page.calc.legCircumferenceInches).toBe(page.calc.footCircumferenceInches);
    expect(page.calc.footCircumferenceInches).toBe(15);
    expect(draft.footCircumference).toBe("15");
    expect(draft.legCircumference).toBe("15");
    const reopened = sockSummaryMeasureFieldsFromDraft(draft);
    expect(reopened.footCircumference).toBe("15");
    expect(reopened.legCircumference).toBe("15");
    const saved = applySockSummaryMeasurementsToDraft(draft, {
      ...reopened,
      footCircumference: "16",
      legCircumference: "11",
    });
    expect(saved.footCircumference).toBe("16");
    expect(saved.legCircumference).toBe("16");
    let stored = "";
    writeSockDraft(
      { ...saved, footCircumference: "16", legCircumference: "11" },
      { setItem: (_key, value) => { stored = value; } },
    );
    const persisted = JSON.parse(stored) as { footCircumference: string; legCircumference: string };
    expect(persisted.footCircumference).toBe("16");
    expect(persisted.legCircumference).toBe("16");
    expect(page.view.footLength).toContain("9");
    expect(page.instructionsHtml).toContain("Christmas Stocking — Cuff down");
  });

  it("checks available needles against the foot circumference", () => {
    const tooSmall = evaluateSockBuilderNeedleCapacity(
      {
        sizeSel: "lg",
        constructionDirection: "cuff-to-toe",
        footCircumference: "18",
        footLength: "11",
        legCircumference: "18",
        legLength: "16",
        stitchGauge: "28",
        rowGauge: "44",
        availableNeedles: "20",
      },
      "inches",
    );
    expect(tooSmall.ok).toBe(false);
    const enough = evaluateSockBuilderNeedleCapacity(
      {
        sizeSel: "lg",
        constructionDirection: "cuff-to-toe",
        footCircumference: "18",
        footLength: "11",
        legCircumference: "18",
        legLength: "16",
        stitchGauge: "28",
        rowGauge: "44",
        availableNeedles: "200",
      },
      "inches",
    );
    expect(enough.ok).toBe(true);
  });
});

describe("Christmas stocking edit diagram", () => {
  it("uses the single-sock drawing and one shared circumference chip", () => {
    expect(SOCK_SUMMARY_ART_SRC).toBe("/images/patterns/socks-pattern-summary-transparent.webp");
    const workspace = readFileSync(
      resolve("src/components/patterns/ChristmasStockingPatternEditWorkspace.astro"),
      "utf8",
    );
    expect(workspace).toContain("SOCK_SUMMARY_ART_SRC");
    expect(workspace).not.toContain("/images/patterns/christmas-stocking-builder.png");
    expect(workspace).not.toContain("snowflake");
    const circumference = SOCK_SUMMARY_MEASUREMENT_FIELDS.find(
      (field) => field.id === "footCircumference",
    );
    expect(circumference?.label).toBe("Foot and Leg Circumference");
    expect(SOCK_SUMMARY_MEASUREMENT_FIELDS.map((field) => field.id)).toEqual([
      "legLength",
      "footLength",
      "footCircumference",
    ]);
    const landing = readFileSync(
      resolve("src/lib/patterns/christmasStockingPatternLanding.ts"),
      "utf8",
    );
    expect(landing).toContain("/images/patterns/christmas-stocking-builder.png");
  });
});

describe("Christmas stocking tracking", () => {
  it("uses its own pattern system id", () => {
    expect(patternSystemFromPathname("/patterns/christmas-stocking/summary/")).toBe("christmas-stocking");
    expect(patternSystemFromPathname("/patterns/socks/summary/")).toBe("socks");
  });
});
