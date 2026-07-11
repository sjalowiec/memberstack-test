import { describe, expect, it } from "vitest";
import { formatShapingSegment } from "./sleevelessBackJapaneseNotation";
import { buildDropShoulderSleeveJapaneseNotationReplacements } from "./sleevelessGarmentDiagramReplacements";
import {
  buildDropShoulderSleeveShapingChartRows,
  dropShoulderSleeveNeedsShapingChart,
  dropShoulderSleeveShapingRcSequence,
  dropShoulderSleeveShapingSchedule,
  renderDropShoulderSleeveShapingChartHtml,
} from "./dropShoulderSleeveShapingChart";
import {
  buildDropShoulderSleeveDisplayRows,
  generateDropShoulderPattern,
} from "./dropShoulderPatternOutput";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
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

function sleeveInstructionText(rows: readonly SleevelessPatternDisplayRow[]): string {
  const parts: string[] = [];
  for (const row of rows) {
    if (row.kind !== "block") continue;
    parts.push(...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? []));
  }
  return parts.join("\n");
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
    const text = sleeveInstructionText(rows);

    expect(text).toContain("Cast on 40 stitches.");
    expect(text).toContain("Increase 1 stitch at each side every 4 rows 20 times.");
    expect(text).not.toContain("according to the sleeve shaping sequence");
    expect(text).toContain("Bind off loosely or");
    expect(text).toContain("upper-arm/top edge");
  });

  it("writes top-down sleeve instructions", () => {
    const rows = buildDropShoulderSleeveDisplayRows({ ...TOP_DOWN_SAMPLE, valid: true });
    const text = sleeveInstructionText(rows);

    expect(text).toContain("Cast on or pick up 80 stitches.");
    expect(text).toContain("Decrease 1 stitch at each side every 4 rows 20 times.");
    expect(text).not.toContain("according to the sleeve shaping sequence");
    expect(text).toContain("cuff/wrist edge");
  });
});

describe("generateDropShoulderPattern sleeve shaping chart", () => {
  const patternData = DROP_SHOULDER_CUFF_UP_PATTERN;

  it("embeds a sleeve shaping chart section for a tapered cuff-up sleeve", () => {
    const result = generateDropShoulderPattern(patternData);
    const chartRows = sleeveShapingChartRowsFromDisplay(result.sleeveDisplayRows);

    expect(chartRows.length).toBeGreaterThan(1);
    expect(chartRows.some((r) => /increase/i.test(r.action))).toBe(true);
    expect(chartRows[chartRows.length - 1]?.stitchesRemaining).toBe(0);
    expect(result.sleeveDisplayRows.some((r) => r.kind === "section" && r.title === "SLEEVE SHAPING CHART")).toBe(
      true,
    );
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
    const text = sleeveInstructionText(result.sleeveDisplayRows);
    const d = result.debug as {
      dropShoulderSleeveTopStitches?: number;
      dropShoulderSleeveWristStitches?: number;
      dropShoulderSleeveBodyRows?: number;
    };
    const sched = sleeveEvenShapingSchedule(
      d.dropShoulderSleeveTopStitches ?? 0,
      d.dropShoulderSleeveWristStitches ?? 0,
      d.dropShoulderSleeveBodyRows ?? 0,
    );

    expect(text).toContain(
      `Decrease 1 stitch at each side every ${sched.interval} rows ${sched.count} times.`,
    );
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
    const text = sleeveInstructionText(result.sleeveDisplayRows);
    const d = result.debug as {
      dropShoulderSleeveTopStitches?: number;
      dropShoulderSleeveWristStitches?: number;
      dropShoulderSleeveBodyRows?: number;
    };
    const sched = sleeveEvenShapingSchedule(
      d.dropShoulderSleeveTopStitches ?? 0,
      d.dropShoulderSleeveWristStitches ?? 0,
      d.dropShoulderSleeveBodyRows ?? 0,
    );

    expect(text).toContain(
      `Increase 1 stitch at each side every ${sched.interval} rows ${sched.count} times.`,
    );
    expect(text).not.toContain("Decrease 1 stitch at each side");
    expect(text).not.toContain("according to the sleeve shaping sequence");
  });
});

describe("generateDropShoulderPattern sleeve instruction copy", () => {
  it("uses clear even-row wording after the final increase for bottom-up sleeves", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_CUFF_UP_PATTERN);
    const text = sleeveInstructionText(result.sleeveDisplayRows);
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
      `After the final increase, knit ${sched.remainderRows} rows even in pattern, then bind off at RC:${String(d.dropShoulderSleeveTotalRows ?? 0).padStart(3, "0")}.`,
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
