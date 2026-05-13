import { describe, expect, it } from "vitest";
import {
  centerBindOffStitchesFromNeckShoulderChart,
  generateSleevelessBackPattern,
} from "./sleevelessPatternOutput";
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
  it("round neck front chart still includes center bind-off on the first row", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    expect(r.frontNeckShoulderChartUsesLiveRows).toBe(true);
    expect(r.neckShoulderChartUsesLiveRows).toBe(true);
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

  it("print-facing chart data matches online: shared generateSleevelessBackPattern result", () => {
    const r = generateSleevelessBackPattern(basePattern("v-neck"));
    expect(r.frontNeckShoulderShapingChart.rows.length).toBe(r.frontNeckShoulderTimeline?.length ?? 0);
  });
});
