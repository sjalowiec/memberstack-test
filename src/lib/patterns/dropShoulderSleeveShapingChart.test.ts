import { describe, expect, it } from "vitest";
import { formatShapingSegment } from "./sleevelessBackJapaneseNotation";
import { formatParentheticalShapingRowNumbers } from "./evenShapingSchedule";
import { buildDropShoulderSleeveJapaneseNotationReplacements } from "./sleevelessGarmentDiagramReplacements";
import {
  buildDropShoulderSleeveShapingChartRows,
  DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE,
  dropShoulderSleeveNeedsShapingChart,
  dropShoulderSleevePreShapingSpan,
  dropShoulderSleeveShapingRcSequence,
  dropShoulderSleeveShapingSchedule,
  renderDropShoulderSleeveShapingChartHtml,
} from "./dropShoulderSleeveShapingChart";
import {
  buildDropShoulderSleeveDisplayRows,
  generateDropShoulderPattern,
} from "./dropShoulderPatternOutput";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import { SCRAP_OFF_GLOSSARY_ID } from "./neckShoulderActiveIntroCopy";
import { sleeveEvenShapingSchedule } from "./evenShapingSchedule";
import {
  DROP_SHOULDER_SLEEVE_MEASUREMENT_BOTTOM_UP_SRC,
  DROP_SHOULDER_SLEEVE_MEASUREMENT_TOP_DOWN_SRC,
  DROP_SHOULDER_SLEEVE_NOTATION_BOTTOM_UP_SRC,
  DROP_SHOULDER_SLEEVE_NOTATION_TOP_DOWN_SRC,
  resolveDropShoulderSleeveMeasurementSvgSrc,
  resolveDropShoulderSleeveNotationSvgSrc,
} from "./dropShoulderSleeveNotationSvg";

const DROP_SHOULDER_CUFF_UP_PATTERN = {
  fit: {
    sizingChart: "women",
    selectedMeasurements: {
      finished_bust_chest: 40,
      back_neck_to_hem: 24,
      upper_arm: 16,
      wrist: 8,
      sleeve_length: 12,
      shoulder_width: 16,
      neck_opening_width: 7,
      back_neck_depth: 1,
      front_neck_depth: 4,
    },
  },
  yarnGaugeMachine: {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  },
  style: {
    construction: "drop-shoulder",
    frontStyle: "closed",
    neckline: "round",
  },
};

function sleeveInstructionTrustedText(rows: readonly SleevelessPatternDisplayRow[]): string {
  const parts: string[] = [];
  for (const row of rows) {
    if (row.kind !== "block") continue;
    parts.push(...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? []));
  }
  return parts.join("\n");
}

function shapingRcListFromWrittenLine(line: string): number[] {
  const match = line.match(/<em>\(RC: ([^)]+)\)<\/em>/);
  if (!match) return [];
  return match[1]!.split(", ").map((n) => parseInt(n.trim(), 10));
}

const CUFF_UP_SAMPLE = {
  topSts: 80,
  wristSts: 40,
  cuffRows: 20,
  sleeveBodyRows: 100,
  sleeveTotalRows: 120,
  direction: "cuff-up" as const,
};

const TOP_DOWN_SAMPLE = {
  ...CUFF_UP_SAMPLE,
  direction: "top-down" as const,
};

/** Steep taper: shaping every row — one straight row before the first increase. */
const STEEP_CUFF_UP_SAMPLE = {
  topSts: 60,
  wristSts: 20,
  cuffRows: 10,
  sleeveBodyRows: 20,
  sleeveTotalRows: 30,
  direction: "cuff-up" as const,
};

function sleeveBodyBlocks(
  rows: readonly SleevelessPatternDisplayRow[],
): Extract<SleevelessPatternDisplayRow, { kind: "block" }>[] {
  const sectionIdx = rows.findIndex((r) => r.kind === "section" && r.title === "SLEEVE BODY");
  if (sectionIdx < 0) return [];
  const blocks: Extract<SleevelessPatternDisplayRow, { kind: "block" }>[] = [];
  for (let i = sectionIdx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.kind === "section") break;
    if (row.kind === "block") blocks.push(row);
  }
  return blocks;
}

function blockParagraphText(
  block: Extract<SleevelessPatternDisplayRow, { kind: "block" }>,
): string {
  return [...(block.trustedParagraphs ?? []), ...(block.paragraphs ?? [])].join("\n");
}

function parseRcNumber(rc: string | undefined): number {
  const match = String(rc ?? "").match(/(\d+)/);
  return match ? parseInt(match[1]!, 10) : NaN;
}

function sleeveShapingChartRowsFromDisplay(
  rows: readonly SleevelessPatternDisplayRow[],
): { rc: number; action: string; edge: string; stitchesRemaining: number }[] {
  const out: { rc: number; action: string; edge: string; stitchesRemaining: number }[] = [];
  for (const row of rows) {
    if (row.kind === "block" && row.sleeveShapingChartRows) {
      out.push(...row.sleeveShapingChartRows);
    }
  }
  return out;
}

describe("dropShoulderSleeveNotationSvg", () => {
  it("uses isolated bottom-up and top-down notation SVG paths", () => {
    expect(resolveDropShoulderSleeveNotationSvgSrc("cuff-up")).toBe(
      DROP_SHOULDER_SLEEVE_NOTATION_BOTTOM_UP_SRC,
    );
    expect(resolveDropShoulderSleeveNotationSvgSrc("top-down")).toBe(
      DROP_SHOULDER_SLEEVE_NOTATION_TOP_DOWN_SRC,
    );
    expect(DROP_SHOULDER_SLEEVE_NOTATION_BOTTOM_UP_SRC).toContain("JP-drop-body-sleeve.svg");
    expect(DROP_SHOULDER_SLEEVE_NOTATION_TOP_DOWN_SRC).toContain("jp-drop-body-sleeve-top-down.svg");
  });

  it("uses isolated bottom-up and top-down measurement SVG paths", () => {
    expect(resolveDropShoulderSleeveMeasurementSvgSrc("cuff-up")).toBe(
      DROP_SHOULDER_SLEEVE_MEASUREMENT_BOTTOM_UP_SRC,
    );
    expect(resolveDropShoulderSleeveMeasurementSvgSrc("top-down")).toBe(
      DROP_SHOULDER_SLEEVE_MEASUREMENT_TOP_DOWN_SRC,
    );
    expect(DROP_SHOULDER_SLEEVE_MEASUREMENT_BOTTOM_UP_SRC).toContain("drop-body-sleeve.svg");
    expect(DROP_SHOULDER_SLEEVE_MEASUREMENT_TOP_DOWN_SRC).toContain("drop-body-sleeve-top-down.svg");
  });
});

describe("buildDropShoulderSleeveShapingChartRows", () => {
  it("builds multiple increase rows ending at upper-arm stitch count (cuff-up)", () => {
    const rows = buildDropShoulderSleeveShapingChartRows(CUFF_UP_SAMPLE);
    const shapingRows = rows.filter((r) => /increase/i.test(r.action));

    expect(shapingRows).toHaveLength(20);
    expect(shapingRows[0]).toMatchObject({
      rc: 24,
      action: "Increase 1 stitch at each side",
      edge: "Both sides",
      stitchesRemaining: 42,
    });
    expect(shapingRows[shapingRows.length - 1]?.stitchesRemaining).toBe(80);
  });

  it("builds decrease rows from upper arm to cuff (top-down)", () => {
    const rows = buildDropShoulderSleeveShapingChartRows(TOP_DOWN_SAMPLE);
    const shapingRows = rows.filter((r) => /decrease/i.test(r.action));

    expect(shapingRows).toHaveLength(20);
    expect(shapingRows[0]).toMatchObject({
      rc: 4,
      action: "Decrease 1 stitch at each side",
      edge: "Both sides",
      stitchesRemaining: 78,
    });
    expect(shapingRows[shapingRows.length - 1]?.stitchesRemaining).toBe(40);
  });

  it("adds final bind-off row at sleeve total RC with direction-specific edge label", () => {
    const cuffUpBindOff = buildDropShoulderSleeveShapingChartRows(CUFF_UP_SAMPLE).at(-1);
    const topDownBindOff = buildDropShoulderSleeveShapingChartRows(TOP_DOWN_SAMPLE).at(-1);

    expect(cuffUpBindOff).toEqual({
      rc: 120,
      action: "Bind off loosely or scrap off",
      edge: "Top edge",
      stitchesRemaining: 0,
    });
    expect(topDownBindOff).toEqual({
      rc: 120,
      action: "Bind off loosely or scrap off",
      edge: "Cuff edge",
      stitchesRemaining: 0,
    });
  });

  it("returns empty rows when no sleeve shaping is needed", () => {
    expect(
      buildDropShoulderSleeveShapingChartRows({
        ...CUFF_UP_SAMPLE,
        topSts: 40,
        wristSts: 40,
      }),
    ).toEqual([]);
    expect(dropShoulderSleeveNeedsShapingChart({ ...CUFF_UP_SAMPLE, topSts: 40, wristSts: 40 })).toBe(
      false,
    );
  });

  it("RC values match the shared sleeve shaping schedule used for JP notation", () => {
    const sched = dropShoulderSleeveShapingSchedule(CUFF_UP_SAMPLE);
    const jpNotation = formatShapingSegment(1, sched.interval, sched.count);
    const chartRcs = dropShoulderSleeveShapingRcSequence(CUFF_UP_SAMPLE);
    const rows = buildDropShoulderSleeveShapingChartRows(CUFF_UP_SAMPLE);

    expect(jpNotation).toBe("1s-4r-20x");
    expect(chartRcs).toEqual(rows.filter((r) => /increase/i.test(r.action)).map((r) => r.rc));
    expect(chartRcs).toEqual([24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 100]);
  });

  it("matches drop-shoulder JP sleeve notation replacements for the same debug values (bottom-up)", () => {
    const result = {
      debug: {
        dropShoulderSleeveBodyRows: CUFF_UP_SAMPLE.sleeveBodyRows,
        dropShoulderSleeveCuffRows: CUFF_UP_SAMPLE.cuffRows,
        dropShoulderSleeveTopStitches: CUFF_UP_SAMPLE.topSts,
        dropShoulderSleeveWristStitches: CUFF_UP_SAMPLE.wristSts,
      },
    };
    const jp = buildDropShoulderSleeveJapaneseNotationReplacements(result as never, "cuff-up");
    const sched = dropShoulderSleeveShapingSchedule(CUFF_UP_SAMPLE);

    expect(jp["jp-caston"]).toBe("co40 sts");
    expect(jp["jp-sleeve_cap_sts"]).toBe("80 sts");
    expect(jp["jp-sleeve-shaping"]).toBe(formatShapingSegment(1, sched.interval, sched.count));
  });

  it("uses upper-arm cast-on and wrist edge stitches for top-down JP notation", () => {
    const result = {
      debug: {
        dropShoulderSleeveBodyRows: CUFF_UP_SAMPLE.sleeveBodyRows,
        dropShoulderSleeveCuffRows: CUFF_UP_SAMPLE.cuffRows,
        dropShoulderSleeveTopStitches: CUFF_UP_SAMPLE.topSts,
        dropShoulderSleeveWristStitches: CUFF_UP_SAMPLE.wristSts,
      },
    };
    const jp = buildDropShoulderSleeveJapaneseNotationReplacements(result as never, "top-down");

    expect(jp["jp-caston"]).toBe("co80 sts");
    expect(jp["jp-sleeve_cap_sts"]).toBe("40 sts");
  });
});

describe("buildDropShoulderSleeveDisplayRows", () => {
  it("defaults to bottom-up written instructions", () => {
    const rows = buildDropShoulderSleeveDisplayRows({ ...CUFF_UP_SAMPLE, valid: true });
    const text = sleeveInstructionTrustedText(rows);
    const chartRcs = dropShoulderSleeveShapingRcSequence(CUFF_UP_SAMPLE);
    const preShaping = dropShoulderSleevePreShapingSpan(CUFF_UP_SAMPLE);
    const bodyBlocks = sleeveBodyBlocks(rows);
    const shapingLine = bodyBlocks
      .flatMap((r) => r.trustedParagraphs ?? [])
      .find((p) => /Increase 1 stitch at each side/i.test(p));

    expect(text).toContain("Cast on 40 stitches for the sleeve cuff.");
    expect(preShaping.straightRows).toBe(4);
    expect(bodyBlocks).toHaveLength(2);
    expect(blockParagraphText(bodyBlocks[0]!)).toContain("Knit 4 rows even.");
    expect(parseRcNumber(bodyBlocks[0]!.rc)).toBe(preShaping.bodyStartRc);
    expect(blockParagraphText(bodyBlocks[1]!)).toContain(DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE);
    expect(parseRcNumber(bodyBlocks[1]!.rc)).toBe(preShaping.firstShapingRc);
    expect(shapingLine).toContain("Increase 1 stitch at each side every 4 rows 20 times.");
    expect(shapingLine).toContain(formatParentheticalShapingRowNumbers(chartRcs));
    expect(shapingRcListFromWrittenLine(shapingLine ?? "")).toEqual(chartRcs);
    expect(shapingRcListFromWrittenLine(shapingLine ?? "")[0]).toBe(preShaping.firstShapingRc);
    expect(text).not.toContain("according to the sleeve shaping sequence");
    expect(text).not.toContain("Knit 0 rows even.");
    expect(text).toContain("Bind off loosely or");
    expect(text).toContain("upper-arm/top edge");
  });

  it("writes top-down sleeve instructions", () => {
    const rows = buildDropShoulderSleeveDisplayRows({ ...TOP_DOWN_SAMPLE, valid: true });
    const text = sleeveInstructionTrustedText(rows);
    const chartRcs = dropShoulderSleeveShapingRcSequence(TOP_DOWN_SAMPLE);
    const preShaping = dropShoulderSleevePreShapingSpan(TOP_DOWN_SAMPLE);
    const bodyBlocks = sleeveBodyBlocks(rows);
    const shapingLine = bodyBlocks
      .flatMap((r) => r.trustedParagraphs ?? [])
      .find((p) => /Decrease 1 stitch at each side/i.test(p));

    expect(text).toContain("Cast on or pick up 80 stitches.");
    expect(preShaping.straightRows).toBe(4);
    expect(bodyBlocks).toHaveLength(2);
    expect(blockParagraphText(bodyBlocks[0]!)).toContain("Knit 4 rows even.");
    expect(blockParagraphText(bodyBlocks[1]!)).toContain(DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE);
    expect(parseRcNumber(bodyBlocks[1]!.rc)).toBe(preShaping.firstShapingRc);
    expect(shapingLine).toContain("Decrease 1 stitch at each side every 4 rows 20 times.");
    expect(shapingLine).toContain(formatParentheticalShapingRowNumbers(chartRcs));
    expect(shapingRcListFromWrittenLine(shapingLine ?? "")).toEqual(chartRcs);
    expect(text).not.toContain("according to the sleeve shaping sequence");
    expect(text).toContain("cuff/wrist edge");
  });

  it("states one straight row before shaping when the schedule interval is 1", () => {
    const rows = buildDropShoulderSleeveDisplayRows({ ...STEEP_CUFF_UP_SAMPLE, valid: true });
    const preShaping = dropShoulderSleevePreShapingSpan(STEEP_CUFF_UP_SAMPLE);
    const bodyBlocks = sleeveBodyBlocks(rows);

    expect(preShaping).toEqual({ bodyStartRc: 10, firstShapingRc: 11, straightRows: 1 });
    expect(bodyBlocks).toHaveLength(2);
    expect(blockParagraphText(bodyBlocks[0]!)).toBe("Knit 1 row even.");
    expect(parseRcNumber(bodyBlocks[1]!.rc)).toBe(11);
    expect(blockParagraphText(bodyBlocks[1]!)).toContain(DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE);
  });

  it("begins shaping immediately at body start when straight rows are zero", () => {
    const noShapingInput = { ...CUFF_UP_SAMPLE, topSts: 40, wristSts: 40 };
    const rows = buildDropShoulderSleeveDisplayRows({ ...noShapingInput, valid: true });
    const preShaping = dropShoulderSleevePreShapingSpan(noShapingInput);
    const bodyBlocks = sleeveBodyBlocks(rows);
    const text = sleeveInstructionTrustedText(rows);

    expect(preShaping.straightRows).toBe(0);
    expect(bodyBlocks).toHaveLength(1);
    expect(text).not.toContain(DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE);
    expect(text).not.toContain("Knit 0 rows even.");
  });

  it("written RC list matches shaping chart rows for cuff-up and top-down samples", () => {
    for (const input of [CUFF_UP_SAMPLE, TOP_DOWN_SAMPLE]) {
      const displayRows = buildDropShoulderSleeveDisplayRows({ ...input, valid: true });
      const chartRows = sleeveShapingChartRowsFromDisplay(displayRows);
      const chartShapingRcs = chartRows
        .filter((r) => /increase|decrease/i.test(r.action))
        .map((r) => r.rc);
      const writtenLine = displayRows
        .filter((r) => r.kind === "block")
        .flatMap((r) => (r.kind === "block" ? (r.trustedParagraphs ?? []) : []))
        .find((p) => /stitch at each side every/i.test(p));

      expect(writtenLine).toBeDefined();
      expect(shapingRcListFromWrittenLine(writtenLine ?? "")).toEqual(chartShapingRcs);
      expect(shapingRcListFromWrittenLine(writtenLine ?? "")).toEqual(
        dropShoulderSleeveShapingRcSequence(input),
      );
    }
  });

  it("renders straight rows, begin shaping, and RC headings in print output", () => {
    const rows = buildDropShoulderSleeveDisplayRows({ ...CUFF_UP_SAMPLE, valid: true });
    const preShaping = dropShoulderSleevePreShapingSpan(CUFF_UP_SAMPLE);
    const chartRcs = dropShoulderSleeveShapingRcSequence(CUFF_UP_SAMPLE);
    const printHtml = renderSleevelessPrintPieceHtml(rows, "", "sleeve");

    expect(printHtml).toContain(`RC: ${String(preShaping.bodyStartRc).padStart(3, "0")}`);
    expect(printHtml).toContain(`RC: ${String(preShaping.firstShapingRc).padStart(3, "0")}`);
    expect(printHtml).toContain(`Knit ${preShaping.straightRows} rows even.`);
    expect(printHtml).toContain(DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE);
    expect(printHtml).toContain(formatParentheticalShapingRowNumbers(chartRcs));
    expect(printHtml).not.toContain("Knit 0 rows even.");
  });
});

describe("generateDropShoulderPattern sleeve shaping chart", () => {
  const patternData = DROP_SHOULDER_CUFF_UP_PATTERN;

  it("embeds a sleeve shaping chart section for a tapered cuff-up sleeve", () => {
    const result = generateDropShoulderPattern(patternData);
    const chartRows = sleeveShapingChartRowsFromDisplay(result.sleeveDisplayRows);
    const chartShapingRcs = chartRows
      .filter((r) => /increase/i.test(r.action))
      .map((r) => r.rc);
    const shapingLine = result.sleeveDisplayRows
      .filter((r) => r.kind === "block")
      .flatMap((r) => (r.kind === "block" ? (r.trustedParagraphs ?? []) : []))
      .find((p) => /Increase 1 stitch at each side/i.test(p));

    expect(chartRows.length).toBeGreaterThan(1);
    expect(chartRows.some((r) => /increase/i.test(r.action))).toBe(true);
    expect(chartRows[chartRows.length - 1]?.stitchesRemaining).toBe(0);
    expect(result.sleeveDisplayRows.some((r) => r.kind === "section" && r.title === "SLEEVE SHAPING CHART")).toBe(
      true,
    );
    expect(shapingLine).toContain(formatParentheticalShapingRowNumbers(chartShapingRcs));
    expect(shapingRcListFromWrittenLine(shapingLine ?? "")).toEqual(chartShapingRcs);
  });

  it("shows the no-shaping note instead of a table when wrist equals top width", () => {
    const straightSleeveData = {
      ...patternData,
      fit: {
        ...patternData.fit,
        selectedMeasurements: {
          ...patternData.fit.selectedMeasurements,
          upper_arm: 8,
          wrist: 8,
        },
      },
    };
    const result = generateDropShoulderPattern(straightSleeveData);
    const chartRows = sleeveShapingChartRowsFromDisplay(result.sleeveDisplayRows);
    const noteBlock = result.sleeveDisplayRows.find(
      (r) =>
        r.kind === "block" &&
        (r.trustedParagraphs?.some((p) => p.includes("Knit straight to length.")) ||
          r.paragraphs?.some((p) => p.includes("Knit straight to length."))),
    );

    expect(chartRows).toEqual([]);
    expect(noteBlock).toBeTruthy();
  });

  it("uses top-down instructions when sleeveDirection option is top-down", () => {
    const result = generateDropShoulderPattern(patternData, { sleeveDirection: "top-down" });
    const text = sleeveInstructionTrustedText(result.sleeveDisplayRows);
    const d = result.debug as {
      dropShoulderSleeveTopStitches?: number;
      dropShoulderSleeveWristStitches?: number;
      dropShoulderSleeveBodyRows?: number;
      dropShoulderSleeveCuffRows?: number;
      dropShoulderSleeveTotalRows?: number;
    };
    const sched = sleeveEvenShapingSchedule(
      d.dropShoulderSleeveTopStitches ?? 0,
      d.dropShoulderSleeveWristStitches ?? 0,
      d.dropShoulderSleeveBodyRows ?? 0,
    );
    const chartInput = {
      topSts: d.dropShoulderSleeveTopStitches ?? 0,
      wristSts: d.dropShoulderSleeveWristStitches ?? 0,
      cuffRows: d.dropShoulderSleeveCuffRows ?? 0,
      sleeveBodyRows: d.dropShoulderSleeveBodyRows ?? 0,
      sleeveTotalRows: d.dropShoulderSleeveTotalRows ?? 0,
      direction: "top-down" as const,
    };
    const chartRcs = dropShoulderSleeveShapingRcSequence(chartInput);
    const shapingLine = result.sleeveDisplayRows
      .filter((r) => r.kind === "block")
      .flatMap((r) => (r.kind === "block" ? (r.trustedParagraphs ?? []) : []))
      .find((p) => /Decrease 1 stitch at each side/i.test(p));

    expect(text).toContain(
      `Decrease 1 stitch at each side every ${sched.interval} rows ${sched.count} times.`,
    );
    expect(shapingLine).toContain(formatParentheticalShapingRowNumbers(chartRcs));
    expect(shapingRcListFromWrittenLine(shapingLine ?? "")).toEqual(chartRcs);
    expect(text).not.toContain("according to the sleeve shaping sequence");
    expect(sleeveShapingChartRowsFromDisplay(result.sleeveDisplayRows).some((r) => /decrease/i.test(r.action))).toBe(
      true,
    );
  });

  it("ignores legacy style.sleeveDirection from builder data", () => {
    const result = generateDropShoulderPattern({
      ...patternData,
      style: { ...patternData.style, sleeveDirection: "top-down" },
    });
    const text = sleeveInstructionTrustedText(result.sleeveDisplayRows);
    const d = result.debug as {
      dropShoulderSleeveTopStitches?: number;
      dropShoulderSleeveWristStitches?: number;
      dropShoulderSleeveBodyRows?: number;
      dropShoulderSleeveCuffRows?: number;
      dropShoulderSleeveTotalRows?: number;
    };
    const sched = sleeveEvenShapingSchedule(
      d.dropShoulderSleeveTopStitches ?? 0,
      d.dropShoulderSleeveWristStitches ?? 0,
      d.dropShoulderSleeveBodyRows ?? 0,
    );
    const chartInput = {
      topSts: d.dropShoulderSleeveTopStitches ?? 0,
      wristSts: d.dropShoulderSleeveWristStitches ?? 0,
      cuffRows: d.dropShoulderSleeveCuffRows ?? 0,
      sleeveBodyRows: d.dropShoulderSleeveBodyRows ?? 0,
      sleeveTotalRows: d.dropShoulderSleeveTotalRows ?? 0,
      direction: "cuff-up" as const,
    };
    const chartRcs = dropShoulderSleeveShapingRcSequence(chartInput);
    const shapingLine = result.sleeveDisplayRows
      .filter((r) => r.kind === "block")
      .flatMap((r) => (r.kind === "block" ? (r.trustedParagraphs ?? []) : []))
      .find((p) => /Increase 1 stitch at each side/i.test(p));

    expect(text).toContain(
      `Increase 1 stitch at each side every ${sched.interval} rows ${sched.count} times.`,
    );
    expect(shapingLine).toContain(formatParentheticalShapingRowNumbers(chartRcs));
    expect(shapingRcListFromWrittenLine(shapingLine ?? "")).toEqual(chartRcs);
    expect(text).not.toContain("Decrease 1 stitch at each side");
    expect(text).not.toContain("according to the sleeve shaping sequence");
  });
});

describe("generateDropShoulderPattern sleeve instruction copy", () => {
  it("uses clear even-row wording after the final increase for bottom-up sleeves", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_CUFF_UP_PATTERN);
    const text = sleeveInstructionTrustedText(result.sleeveDisplayRows);
    const d = result.debug as {
      dropShoulderSleeveTopStitches?: number;
      dropShoulderSleeveWristStitches?: number;
      dropShoulderSleeveBodyRows?: number;
      dropShoulderSleeveTotalRows?: number;
    };
    const sched = sleeveEvenShapingSchedule(
      d.dropShoulderSleeveTopStitches ?? 0,
      d.dropShoulderSleeveWristStitches ?? 0,
      d.dropShoulderSleeveBodyRows ?? 0,
    );

    expect(text).not.toContain("The sleeve top edge matches the armhole opening");
    expect(text).toContain(
      `After the final increase, knit ${sched.remainderRows} rows even in pattern, then bind off at RC: ${String(d.dropShoulderSleeveTotalRows ?? 0).padStart(3, "0")}.`,
    );
  });

  it("links scrap off to glossary id 311 on bind-off lines", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_CUFF_UP_PATTERN);
    const bindOffBlocks = result.sleeveDisplayRows.filter(
      (row) =>
        row.kind === "block" &&
        row.trustedParagraphs?.some((p) => /loosely or/i.test(p)),
    );

    expect(bindOffBlocks.length).toBeGreaterThan(0);
    for (const row of bindOffBlocks) {
      expect(row.kind).toBe("block");
      if (row.kind !== "block") continue;
      const joined = (row.trustedParagraphs ?? []).join(" ");
      expect(joined).toContain("loosely or");
      expect(joined).toContain(`data-glossary-id="${SCRAP_OFF_GLOSSARY_ID}"`);
      expect(joined).toContain('data-term="scrap off"');
    }
  });

  it("links scrap off in the no-shaping note", () => {
    const result = generateDropShoulderPattern({
      ...DROP_SHOULDER_CUFF_UP_PATTERN,
      fit: {
        ...DROP_SHOULDER_CUFF_UP_PATTERN.fit,
        selectedMeasurements: {
          ...DROP_SHOULDER_CUFF_UP_PATTERN.fit.selectedMeasurements,
          upper_arm: 8,
          wrist: 8,
        },
      },
    });
    const noteBlock = result.sleeveDisplayRows.find(
      (r) =>
        r.kind === "block" &&
        r.trustedParagraphs?.some((p) => /Knit straight to length/i.test(p)),
    );
    expect(noteBlock).toBeTruthy();
    if (!noteBlock || noteBlock.kind !== "block") return;
    const joined = (noteBlock.trustedParagraphs ?? []).join(" ");
    expect(joined).toContain("Knit straight to length.");
    expect(joined).toContain(`data-glossary-id="${SCRAP_OFF_GLOSSARY_ID}"`);
  });
});

describe("renderDropShoulderSleeveShapingChartHtml", () => {
  it("renders checklist columns and progress hooks", () => {
    const rows = buildDropShoulderSleeveShapingChartRows(CUFF_UP_SAMPLE);
    const html = renderDropShoulderSleeveShapingChartHtml(rows, {
      chartId: "drop-shoulder-sleeve-shaping-chart-test",
      showTitle: false,
    });

    expect(html).toContain("data-chart-id=");
    expect(html).toContain("Show Completed Rows");
    expect(html).toContain("Reset Checklist");
    expect(html).toContain("Sts Remaining");
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain("<h3");
  });

  it("returns empty string when there are no rows", () => {
    expect(renderDropShoulderSleeveShapingChartHtml([], { chartId: "x" })).toBe("");
  });
});
