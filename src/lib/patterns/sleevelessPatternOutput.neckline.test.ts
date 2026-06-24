import { describe, expect, it } from "vitest";
import { innerNeckDecreaseNotationLinesFromTimeline } from "./notationOverlaySvg";
import { compressStitchDecreasePointsToNotationLines, type StitchDecreasePoint } from "./shapingNotationCompress";
import {
  centerBindOffStitchesFromNeckShoulderChart,
  generateSleevelessBackPattern,
} from "./sleevelessPatternOutput";
import {
  chartDisplayRowsOnePerRc,
  collapsePlainKnitChartRowsForDisplay,
  isFullWidthVNeckFrontStyleChart,
} from "./neckShoulderShapingChart";
import { renderNeckShoulderShapingChartTableOnlyHtml, renderNeckShoulderShapingPrintInstructionTableHtml } from "./neckShoulderShapingChartHtml";
import { neckShoulderChartRowsFromTimeline } from "./neckShoulderShapingChartRows";
import type { NeckShoulderShapingChartRow } from "./neckShoulderShapingChart";
import type { RowEntry } from "./shapingTimeline";

function basePattern(styleNeckline: string): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 3,
        shoulder_width: 4.25,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: {
      recipientCategory: "misses",
      neckline: styleNeckline,
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function parseCenterCell(cell: unknown): number {
  const s = String(cell ?? "").trim();
  if (!s || s === "-") return 0;
  const m = s.match(/^-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseNeckDecreaseCell(cell: unknown): number {
  const text = String(cell ?? "").trim();
  if (!text || text === "-") return 0;
  const normalized = text.replace(/[^\d-]/g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.abs(Math.trunc(n)));
}

function rightInnerNeckPointsFromChartRows(rows: readonly NeckShoulderShapingChartRow[]): StitchDecreasePoint[] {
  return [...rows]
    .sort((a, b) => a.row - b.row)
    .map((row) => ({ row: row.row, amount: parseNeckDecreaseCell(row.rightNeck) }))
    .filter((p) => p.amount > 0);
}

function sumLeftInnerDecreases(timeline: RowEntry[] | undefined): number {
  if (!timeline?.length) return 0;
  let n = 0;
  for (const entry of timeline) {
    for (const ev of entry.events) {
      if (ev.kind === "decrease" && ev.edge === "inner" && ev.side === "left") n += ev.amount;
    }
  }
  return n;
}

describe("generateSleevelessBackPattern neckline routing", () => {
  it("v-neck Express: only the front chart uses V-neck full-width display mode; back never does", () => {
    const r = generateSleevelessBackPattern(basePattern("v-neck"));
    expect(r.neckShoulderShapingChart.sleevelessFullWidthVNeckFront).toBe(false);
    expect(isFullWidthVNeckFrontStyleChart(r.neckShoulderShapingChart)).toBe(false);
    expect(r.frontNeckShoulderShapingChart.sleevelessFullWidthVNeckFront).toBe(true);
    expect(isFullWidthVNeckFrontStyleChart(r.frontNeckShoulderShapingChart)).toBe(true);
  });

  it("v-neck back timeline still uses round-neck center hold (not V-neck center row)", () => {
    const r = generateSleevelessBackPattern(basePattern("v-neck"));
    const tl = r.backNeckShoulderTimeline;
    expect(tl?.length).toBeGreaterThan(0);
    let centerNeckEvents = 0;
    for (const entry of tl!) {
      for (const ev of entry.events) {
        if (ev.side === "center" && (ev.kind === "bindOff" || ev.kind === "hold")) {
          centerNeckEvents += ev.amount;
        }
      }
    }
    expect(centerNeckEvents).toBeGreaterThan(0);
  });

  it("round neck: front chart is not in V-neck full-width display mode", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    expect(r.frontNeckShoulderChartUsesLiveRows).toBe(true);
    expect(r.neckShoulderChartUsesLiveRows).toBe(true);
    expect(r.frontNeckShoulderShapingChart.sleevelessFullWidthVNeckFront).toBe(false);
    expect(isFullWidthVNeckFrontStyleChart(r.frontNeckShoulderShapingChart)).toBe(false);
    expect(r.neckShoulderShapingChart.sleevelessFullWidthVNeckFront).toBe(false);
    expect(isFullWidthVNeckFrontStyleChart(r.neckShoulderShapingChart)).toBe(false);
    const frontCenter = centerBindOffStitchesFromNeckShoulderChart(r.frontNeckShoulderShapingChart);
    expect(frontCenter).toBeGreaterThan(0);
    const backCenter = centerBindOffStitchesFromNeckShoulderChart(r.neckShoulderShapingChart);
    expect(backCenter).toBeGreaterThan(0);
  });

  it("v-neck front chart has no center bind-off in any row", () => {
    for (const neck of ["v-neck", "v"]) {
      const r = generateSleevelessBackPattern(basePattern(neck));
      expect(r.frontNeckShoulderChartUsesLiveRows).toBe(true);
      expect(r.neckShoulderChartUsesLiveRows).toBe(true);
      for (const row of r.frontNeckShoulderShapingChart.rows) {
        expect(parseCenterCell(row.centerNeck)).toBe(0);
      }
      expect(centerBindOffStitchesFromNeckShoulderChart(r.frontNeckShoulderShapingChart)).toBe(0);
      const backCenter = centerBindOffStitchesFromNeckShoulderChart(r.neckShoulderShapingChart);
      expect(backCenter).toBeGreaterThan(0);
    }
  });

  it("v-neck front timeline uses distributed inner-neck decreases (no center bind-off events)", () => {
    const r = generateSleevelessBackPattern(basePattern("v-neck"));
    const tl = r.frontNeckShoulderTimeline;
    expect(tl?.length).toBeGreaterThan(0);
    let centerBindEvents = 0;
    for (const entry of tl!) {
      for (const ev of entry.events) {
        if (ev.side === "center" && ev.kind === "bindOff") centerBindEvents += ev.amount;
      }
    }
    expect(centerBindEvents).toBe(0);
    // 3" × 5 sts/in → 15 → evenized to 14; floor(14/2)=7 per side on chart model
    expect(sumLeftInnerDecreases(tl)).toBe(7);
  });

  it("v-neck front chart data is full row-by-row (no V-neck display compaction or synthetic Neck edge spans)", () => {
    const r = generateSleevelessBackPattern(basePattern("v-neck"));
    const chart = r.frontNeckShoulderShapingChart;
    const tl = r.frontNeckShoulderTimeline!;
    expect(chart.rows.length).toBe(tl.length);
    expect(chart.rows.some((row) => String(row.action).startsWith("Neck edge:"))).toBe(false);
    expect(chart.rows.every((row) => row.chartRowSpanLast === undefined)).toBe(true);
    expect(isFullWidthVNeckFrontStyleChart(chart)).toBe(true);
    const perRc = chartDisplayRowsOnePerRc(chart.rows, { rowLabelStyle: "online" });
    expect(perRc.length).toBe(chart.rows.length);
    expect(perRc.every((d) => !d.rowLabel.includes("\u2013"))).toBe(true);
    expect(perRc.every((d) => !String(d.actionLabel).startsWith("Neck edge:"))).toBe(true);
    const collapsed = collapsePlainKnitChartRowsForDisplay(chart.rows, { rowLabelStyle: "online" });
    expect(collapsed.every((d) => !String(d.actionLabel).startsWith("Neck edge:"))).toBe(true);
    expect(collapsed.length).toBeLessThan(chart.rows.length);
    const htmlFull = renderNeckShoulderShapingChartTableOnlyHtml(chart, "test-ns", undefined, {
      activeSideOnly: false,
      includeDoneColumn: false,
    });
    expect(htmlFull).not.toContain("\u2013");
    const tbody = htmlFull.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
    expect((tbody.match(/<tr/g) ?? []).length).toBe(chart.rows.length);
    const htmlPrintStyle = renderNeckShoulderShapingChartTableOnlyHtml(chart, "test-ns-p", undefined, {
      activeSideOnly: false,
      includeDoneColumn: false,
      compactPlainKnitSpansForPrint: true,
    });
    expect(htmlPrintStyle).not.toContain("\u2013");
    const htmlActive = renderNeckShoulderShapingChartTableOnlyHtml(chart, "test-ns-a", undefined, {
      activeSideOnly: true,
      activeSideRcStart: 0,
    });
    expect(htmlActive).not.toContain("\u2013");
    const printMini = renderNeckShoulderShapingPrintInstructionTableHtml(chart, "test-print-mini", "", {});
    expect(printMini).not.toContain("\u2013");
  });

  it("v-neck inner-neck diagram notation from timeline matches un-compacted chart rows from the same timeline", () => {
    const r = generateSleevelessBackPattern(basePattern("v-neck"));
    const tl = r.frontNeckShoulderTimeline;
    expect(tl?.length).toBeGreaterThan(0);
    const fromTimeline = innerNeckDecreaseNotationLinesFromTimeline(tl!, "right");
    const fullRows = neckShoulderChartRowsFromTimeline(tl!);
    const fromFullChart = compressStitchDecreasePointsToNotationLines(
      rightInnerNeckPointsFromChartRows(fullRows),
    );
    expect(fromTimeline).toEqual(fromFullChart);
  });

  it("v-neck inner-neck notation is compact (no four-way 1s-1r phasing)", () => {
    const r = generateSleevelessBackPattern(basePattern("v-neck"));
    const lines = innerNeckDecreaseNotationLinesFromTimeline(r.frontNeckShoulderTimeline!, "right");
    expect(lines.length).toBeLessThanOrEqual(2);
  });
});
