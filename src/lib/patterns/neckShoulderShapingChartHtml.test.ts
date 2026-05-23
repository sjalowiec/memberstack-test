import { describe, expect, it } from "vitest";
import { NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL, plainKnitSpanCarriageEdgeDisplay } from "./neckShoulderShapingChart";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
  buildSecondShoulderInstructionTableRows,
  compactActiveSideInstructionRowsForPrint,
  neckShoulderChartHasCarriagePositionColumn,
  renderCarriagePositionPatternTipHtml,
  renderNeckShoulderShapingChartTableOnlyHtml,
  renderNeckShoulderShapingPrintInstructionTableHtml,
} from "./neckShoulderShapingChartHtml";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

type ChecklistRow = {
  rc: number;
  rcEnd?: number;
  carriagePosition: string;
};

function secondShoulderCarriageAtRc(rc: number): "Right" | "Left" {
  return rc % 2 === 0 ? "Left" : "Right";
}

function expandChecklistRowsByRc(rows: readonly ChecklistRow[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const row of rows) {
    const end = row.rcEnd !== undefined ? row.rcEnd : row.rc;
    for (let rc = row.rc; rc <= end; rc++) {
      if (row.carriagePosition === "Alternating Left/Right") {
        map.set(rc, secondShoulderCarriageAtRc(rc));
      } else {
        map.set(rc, row.carriagePosition);
      }
    }
  }
  return map;
}

function expectStrictAlternatingCarriage(map: Map<number, string>, fromRc: number, toRc: number): void {
  for (let rc = fromRc; rc <= toRc; rc++) {
    expect(map.get(rc), `RC ${rc}`).toBe(secondShoulderCarriageAtRc(rc));
  }
  for (let rc = fromRc + 1; rc <= toRc; rc++) {
    expect(map.get(rc - 1)).not.toBe(map.get(rc));
  }
}

function parseSecondShoulderChecklistFromHtml(html: string): Map<number, string> {
  const block =
    html.match(/Second Shoulder Checklist[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? "";
  const map = new Map<number, string>();
  for (const match of block.matchAll(
    /<td class="ns-shaping-chart__td-num">(\d{3})(?:\u2013(\d{3}))?<\/td><td>(Right|Left|Alternating Left\/Right)<\/td>/g,
  )) {
    const start = parseInt(match[1]!, 10);
    const end = match[2] ? parseInt(match[2], 10) : start;
    const carriage = match[3]!;
    for (let rc = start; rc <= end; rc++) {
      map.set(
        rc,
        carriage === "Alternating Left/Right" ? secondShoulderCarriageAtRc(rc) : carriage,
      );
    }
  }
  return map;
}

function baseRoundNeckPattern(): Record<string, unknown> {
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
    style: { recipientCategory: "misses", neckline: "round" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

describe("carriage position pattern tip", () => {
  it("detects the Carriage Position column only on active-shoulder checklists", () => {
    expect(neckShoulderChartHasCarriagePositionColumn({ activeSideOnly: true })).toBe(true);
    expect(neckShoulderChartHasCarriagePositionColumn({ activeSideOnly: false })).toBe(false);
    expect(neckShoulderChartHasCarriagePositionColumn(undefined)).toBe(false);
  });

  it("renders the collapsible tip before the chart table for back and front active-shoulder charts", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(
      r.neckShoulderShapingChart,
      r.firstArmholeGarmentRc,
    );
    const frontRcStart = armholeLocalRcActiveShoulderChecklistStart(
      r.frontNeckShoulderShapingChart,
      r.firstArmholeGarmentRc,
    );
    const backHtml = renderNeckShoulderShapingChartTableOnlyHtml(
      r.neckShoulderShapingChart,
      "test-carriage-tip-back",
      undefined,
      { activeSideOnly: true, activeSideRcStart: rcStart },
    );
    const frontHtml = renderNeckShoulderShapingChartTableOnlyHtml(
      r.frontNeckShoulderShapingChart,
      "test-carriage-tip-front",
      undefined,
      { activeSideOnly: true, activeSideRcStart: frontRcStart },
    );
    for (const html of [backHtml, frontHtml]) {
      const tipIdx = html.indexOf("<summary>Carriage Position</summary>");
      const tableIdx = html.indexOf("ns-shaping-chart__table");
      expect(tipIdx).toBeGreaterThanOrEqual(0);
      expect(tableIdx).toBeGreaterThan(tipIdx);
      expect(html).toContain("before knitting that row");
      expect(html).toContain("on the right side before you begin knitting");
      expect(html).toContain("sleeveless-shaping-help-toggle no-print");
    }
  });

  it("omits the tip on full-grid charts without a Carriage Position column", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const html = renderNeckShoulderShapingChartTableOnlyHtml(
      r.neckShoulderShapingChart,
      "test-carriage-tip-full",
      undefined,
      { activeSideOnly: false, includeDoneColumn: false },
    );
    expect(html).not.toContain(">Carriage Position</th>");
    expect(renderCarriagePositionPatternTipHtml({ activeSideOnly: false })).toBe("");
    expect(html).not.toContain("<summary>Carriage Position</summary>");
    expect(html).not.toContain("before knitting that row");
  });

  it("does not add the online tip to print mini-table HTML", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const printHtml = renderNeckShoulderShapingPrintInstructionTableHtml(
      r.neckShoulderShapingChart,
      "test-print-carriage-tip",
      "",
      {},
    );
    expect(printHtml).toContain("Carriage Position</th>");
    expect(printHtml).not.toContain("<summary>Carriage Position</summary>");
    expect(printHtml).not.toContain("sleeveless-shaping-help-toggle");
  });
});

describe("plainKnitSpanCarriageEdgeDisplay invertCarriageParity", () => {
  it("uses odd Right / even Left when invertCarriageParity is true", () => {
    expect(plainKnitSpanCarriageEdgeDisplay(29, 29, { invertCarriageParity: true }).carriage).toBe("Right");
    expect(plainKnitSpanCarriageEdgeDisplay(30, 30, { invertCarriageParity: true }).carriage).toBe("Left");
  });
});

describe("second shoulder checklist carriage", () => {
  it("assigns carriage from RC parity only (not from prior active-shoulder carriage strings)", () => {
    const active = Array.from({ length: 15 }, (_, i) => {
      const rc = 29 + i;
      return {
        rc,
        carriagePosition: "Right",
        action: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
        edge: "Armhole",
        stitchesRemaining: 12,
      };
    });
    const second = buildSecondShoulderInstructionTableRows(active);
    expectStrictAlternatingCarriage(expandChecklistRowsByRc(second), 29, 43);
  });

  it("never has consecutive RC with the same carriage after compaction", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const chart = r.neckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.firstArmholeGarmentRc);
    const active = buildActiveSideInstructionTableRows(chart, rcStart);
    const second = compactActiveSideInstructionRowsForPrint(
      buildSecondShoulderInstructionTableRows(active),
      { invertCarriageParity: true },
    );
    const byRc = expandChecklistRowsByRc(second);
    const rcs = [...byRc.keys()].sort((a, b) => a - b);
    expect(rcs.length).toBeGreaterThan(2);
    for (let i = 1; i < rcs.length; i++) {
      expect(byRc.get(rcs[i - 1]!)).not.toBe(byRc.get(rcs[i]!));
    }
  });

  it("RC 029–043 alternates Right, Left, Right, … (regression)", () => {
    const active = Array.from({ length: 15 }, (_, i) => {
      const rc = 29 + i;
      return {
        rc,
        carriagePosition: rc % 2 === 0 ? "Right" : "Left",
        action: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
        edge: rc % 2 === 0 ? "Armhole" : "Neck",
        stitchesRemaining: 8,
      };
    });
    const secondCompact = compactActiveSideInstructionRowsForPrint(
      buildSecondShoulderInstructionTableRows(active),
      { invertCarriageParity: true },
    );
    expectStrictAlternatingCarriage(expandChecklistRowsByRc(secondCompact), 29, 43);
    const labels = secondCompact.map((r) => r.carriagePosition);
    expect(labels.every((c) => c === "Right" || c === "Left" || c === "Alternating Left/Right")).toBe(
      true,
    );
    expect(labels.filter((c) => c === "Right").length).toBeLessThan(labels.length);
  });

  it("rendered second-shoulder HTML alternates carriage for RC 029–043", () => {
    const active = Array.from({ length: 15 }, (_, i) => {
      const rc = 29 + i;
      return {
        rc,
        carriagePosition: rc % 2 === 0 ? "Right" : "Left",
        action: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
        edge: rc % 2 === 0 ? "Armhole" : "Neck",
        stitchesRemaining: 8,
      };
    });
    const chart = {
      columnKeys: [
        "row",
        "action",
        "leftSide",
        "leftNeck",
        "centerNeck",
        "rightNeck",
        "rightSide",
        "leftStitchCount",
        "rightStitchCount",
      ] as const,
      rows: [
        {
          row: 28,
          action: "Neck",
          leftSide: "-",
          leftNeck: "-",
          centerNeck: "-4",
          rightNeck: "-",
          rightSide: "-",
          leftStitchCount: 20,
          rightStitchCount: 20,
        },
        ...active.map((row) => ({
          row: row.rc,
          action: "Shoulder / Neck",
          leftSide: "-",
          leftNeck: "-1",
          centerNeck: "-",
          rightNeck: "-1",
          rightSide: "-",
          leftStitchCount: row.stitchesRemaining,
          rightStitchCount: row.stitchesRemaining,
        })),
      ],
    };
    const html = renderNeckShoulderShapingChartTableOnlyHtml(chart, "test-second-shoulder", undefined, {
      activeSideOnly: true,
      activeSideRcStart: 29,
    });
    expectStrictAlternatingCarriage(parseSecondShoulderChecklistFromHtml(html), 29, 43);
  });
});
