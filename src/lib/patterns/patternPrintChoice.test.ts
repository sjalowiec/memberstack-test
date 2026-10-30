import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { displayRcFromGarmentRc } from "./frontArmholeNecklineComposition";
import { PATTERN_PRINT_CHOICE_REMINDER, PATTERN_PRINT_CHOICES } from "./patternPrintChoice";
import { renderPatternDisplayRowsHtml } from "./sleevelessPatternDisplayHtml";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { generateSetInSleevePattern } from "./setInSleevePatternOutput";
import { withSetInSleeveConstructionAuthored } from "./setInSleeveConstructionIdentity";
import type { RowEntry } from "./shapingTimeline";

const MISSES_7: ChartRow = {
  bust_or_chest: 40,
  waist: 32,
  hip: 42,
  garment_back_length: 24.5,
  armhole_depth: 7.75,
  shoulder_width: 13.75,
  neck_opening: 7.5,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

function pattern(bodyShape: "straight" | "aline" = "straight"): Record<string, unknown> {
  const measurements = computeDefaultMeasurementsFromChartRow(MISSES_7, "standard", { bodyShape });
  return {
    fit: {
      sizingChart: "misses",
      easeChoice: "standard",
      selectedMeasurements: measurements,
    },
    style: withSetInSleeveConstructionAuthored(
      {
        recipientCategory: "misses",
        garmentStyle: "pullover",
        neckline: "round",
        bodyShape,
      },
      "long",
    ),
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function printParagraphs(rows: readonly { kind: string; printInstructionParagraphs?: string[] }[]): string {
  return rows
    .flatMap((row) => (row.kind === "block" ? row.printInstructionParagraphs ?? [] : []))
    .join("\n");
}

function shapingRcCovered(written: string, rc: number): boolean {
  const label = String(rc).padStart(3, "0");
  if (written.includes(`RC: ${label}`)) return true;
  for (const match of written.matchAll(/RC: (\d{3})–(\d{3})/g)) {
    const from = Number(match[1]);
    const to = Number(match[2]);
    if (rc >= from && rc <= to) return true;
  }
  return false;
}

function expectTimelineRcs(written: string, timeline: readonly RowEntry[] | undefined, origin: number): void {
  expect(timeline?.length).toBeGreaterThan(0);
  const shapingRows = (timeline ?? []).filter((entry) => entry.events.some((event) => event.amount > 0));
  expect(shapingRows.length).toBeGreaterThan(0);
  for (const entry of shapingRows) {
    const local = displayRcFromGarmentRc(entry.row, origin);
    expect(shapingRcCovered(written, local), `missing RC ${local} from garment ${entry.row}`).toBe(true);
    for (const event of entry.events) {
      if (event.amount > 1) expect(written).toContain(String(event.amount));
    }
  }
}

describe("pattern print choices", () => {
  it("names the three print options and the on-screen reminder", () => {
    expect(PATTERN_PRINT_CHOICES.map((choice) => choice.id)).toEqual(["instructions", "charts", "both"]);
    expect(PATTERN_PRINT_CHOICES.every((choice) => choice.explanation.length > 40)).toBe(true);
    expect(PATTERN_PRINT_CHOICE_REMINDER).toBe(
      "You can also follow your pattern on a computer, tablet, or phone beside your knitting machine, with access to videos and interactive help.",
    );
    const personalization = readFileSync("src/scripts/patternPrintPersonalization.ts", "utf8");
    expect(personalization).toContain("openPatternPrintChoiceDialog");
    expect(personalization).toContain("applyPatternPrintLayout");
    const css = readFileSync("src/styles/patterns/pattern-print-choice.css", "utf8");
    expect(css).toContain('html[data-pattern-print-choice="instructions"]');
    expect(css).toContain('html[data-pattern-print-choice="charts"]');
    expect(css).toContain('html[data-pattern-print-choice="both"]');
    expect(css).toContain("table-header-group");
    expect(css).toContain("break-inside: avoid");
    expect(css).toContain("pattern-video-modal-link");
    expect(readFileSync("src/styles/print.css", "utf8")).toContain("pattern-print-choice.css");
  });

  it("keeps the on-screen checklist and adds matching written shaping for print", () => {
    const result = generateSetInSleevePattern(pattern());
    const origin = Math.floor(result.debug.armholeStartRow ?? 0);
    const html = renderPatternDisplayRowsHtml(result.displayRows, { pieceSectionId: "back" });
    expect(html).toContain("Use the checklist below for row-by-row neckline and shoulder shaping.");
    expect(html).toContain('class="sleeveless-pattern-line pattern-print-checklist-pointer"');
    expect(html).toContain('class="pattern-print-written-shaping" hidden');

    const backWritten = printParagraphs(result.displayRows);
    const frontWritten = printParagraphs(result.frontDisplayRows);
    expect(backWritten).toMatch(/First Shoulder/);
    expect(backWritten).toMatch(/Second Shoulder/);
    expect(backWritten).toMatch(/Carriage at the/);
    expect(backWritten).toMatch(/Knit in pattern at all other rows/);
    expect(backWritten).not.toMatch(/checklist below/i);
    expect(frontWritten).toMatch(/First Shoulder/);
    expect(frontWritten).toMatch(/Second Shoulder/);
    const repeatedDecrease = frontWritten
      .split("\n")
      .filter((line) => line.includes("Decrease 1 stitch at the neck edge"));
    expect(repeatedDecrease.length).toBe(1);
    expect(repeatedDecrease[0]?.match(/RC: \d{3}/g)?.length ?? 0).toBeGreaterThan(1);
    expectTimelineRcs(backWritten, result.backNeckShoulderTimeline, origin);
    expectTimelineRcs(frontWritten, result.frontNeckShoulderTimeline, origin);

    const sleeveText = result.sleeveDisplayRows
      .flatMap((row) => (row.kind === "block" ? row.paragraphs ?? [] : []))
      .join("\n");
    const sleeveChartRows = result.sleeveDisplayRows.flatMap((row) =>
      row.kind === "block" ? row.sleeveShapingChartRows ?? [] : [],
    );
    expect(sleeveChartRows.length).toBeGreaterThan(0);
    const increases = sleeveChartRows.filter((row) => /increase/i.test(row.action));
    expect(increases.length).toBeGreaterThan(0);
    for (const row of increases) {
      expect(sleeveText).toContain(String(row.rc).padStart(3, "0"));
    }
    const capBindOff = sleeveChartRows.find((row) => /bind off the remaining/i.test(row.action));
    expect(capBindOff).toBeTruthy();
    expect(sleeveText).toContain(capBindOff!.action);
  });

  it("writes A-line readings from the same chart rows without removing the chart", () => {
    const result = generateSetInSleevePattern(pattern("aline"));
    const chartRows = result.displayRows.flatMap((row) =>
      row.kind === "block" ? row.bodyShapingChartRows ?? [] : [],
    );
    expect(chartRows.length).toBeGreaterThan(0);
    const html = renderPatternDisplayRowsHtml(result.displayRows, { pieceSectionId: "back" });
    expect(html).toContain("sleeveless-body-shaping-chart");
    expect(html).toContain("pattern-print-written-shaping");
    for (const row of chartRows) {
      expect(html).toContain(`RC: ${String(row.rc).padStart(3, "0")}`);
      expect(html).toContain(`${row.stitchesRemaining} stitches remain`);
      expect(html).toContain(row.action.replace(/\bDec\b/g, "Decrease").replace(/\bInc\b/g, "Increase"));
    }
  });
});
