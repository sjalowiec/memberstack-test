import { describe, expect, it } from "vitest";
import { parseShapingDecrease } from "./shoulderShapingSvg";
import {
  buildSleevelessBackDisplayRows,
  generateSleevelessBackPattern,
} from "./sleevelessPatternOutput";

describe("sleevelessPatternOutput RC progression", () => {
  const patternData: Record<string, unknown> = {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 6,
        shoulder_width: 4.25,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "misses" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };

  it("armhole starts at hemRows + bodyRows (no transition offset)", () => {
    const result = generateSleevelessBackPattern(patternData);
    const rows = result.displayRows.filter((r) => r.kind === "block") as Array<
      Extract<(typeof result.displayRows)[number], { kind: "block" }>
    >;

    const hemRows = result.debug.hemRows;
    const bodyRows = result.debug.bodyRows;
    const expectedArmhole = hemRows + bodyRows;

    const firstArmhole = rows.find(
      (b) => b.rc && b.paragraphs.some((p) => p.includes("Begin armhole shaping"))
    );
    expect(firstArmhole?.rc).toBe(`RC:${String(expectedArmhole).padStart(3, "0")}`);

    const neckSectionIdx = result.displayRows.findIndex(
      (r) => r.kind === "section" && r.title === "BACK NECKLINE & SHOULDERS",
    );
    expect(neckSectionIdx).toBeGreaterThanOrEqual(0);
    const neckBlock = result.displayRows[neckSectionIdx + 1];
    expect(neckBlock?.kind).toBe("block");
    if (neckBlock?.kind === "block") {
      const joined = neckBlock.paragraphs.join("\n");
      expect(joined).toMatch(/^Bind off center \d+ stitches?\./m);
      expect(joined).toContain("left and");
      expect(joined).toContain("right shoulder stitches");
      expect(joined).toContain("Follow the chart and diagram below");
    }
  });

  it("shows stitch counts at row start, then carries updates to the next row", () => {
    const result = generateSleevelessBackPattern(patternData);
    const blocks = result.displayRows.filter((r) => r.kind === "block") as Array<
      Extract<(typeof result.displayRows)[number], { kind: "block" }>
    >;
    const expectedBackStitches = result.debug.backStitches;

    const castOn = blocks.find((b) => b.paragraphs.some((p) => p.includes("Cast on")));
    expect(castOn?.stitchCount).toBe(expectedBackStitches);

    const body = blocks.find(
      (b) =>
        b.rc === `RC:${String(result.debug.hemRows).padStart(3, "0")}` &&
        b.paragraphs.some((p) => p.includes(`Knit in pattern for ${result.debug.bodyRows} rows.`)),
    );
    expect(body?.stitchCount).toBe(expectedBackStitches);

    const armholeStart = blocks.find((b) => b.paragraphs.some((p) => p.includes("Begin armhole shaping")));
    expect(armholeStart?.stitchCount).toBeDefined();

    const decreaseSummary = blocks.find((b) =>
      b.paragraphs.some((p) => p.includes("decrease 1 stitch every other row"))
    );
    expect(decreaseSummary?.stitchCount).toBeDefined();
    expect(
      typeof armholeStart?.stitchCount === "number" &&
        typeof decreaseSummary?.stitchCount === "number" &&
        decreaseSummary.stitchCount < armholeStart.stitchCount,
    ).toBe(true);

    const decreaseSummaryIdx = blocks.findIndex((b) =>
      b.paragraphs.some((p) => p.includes("decrease 1 stitch every other row"))
    );
    const evenAfterArmhole =
      decreaseSummaryIdx >= 0
        ? blocks
            .slice(decreaseSummaryIdx + 1)
            .find((b) => b.paragraphs.some((p) => p.match(/^Knit in pattern for \d+ rows\.$/)))
        : undefined;
    const decLine = decreaseSummary?.paragraphs.find((p) => p.includes("times total"));
    const decTimes = decLine ? Number((decLine.match(/,\s*(\d+)\s+times total/i) || [])[1]) : NaN;
    expect(Number.isFinite(decTimes)).toBe(true);
    expect(
      typeof decreaseSummary?.stitchCount === "number" ? decreaseSummary.stitchCount - 2 * decTimes : undefined
    ).toBe(evenAfterArmhole?.stitchCount);
  });

  it("uses pre-action stitch counts for RC 143/144 bind-offs and carries to RC 145", () => {
    const rows = buildSleevelessBackDisplayRows({
      castOnSts: 132,
      hemRows: 20,
      hemRowsValid: true,
      bodyToArmholeRows: 123,
      bodyRowsValid: true,
      armholeMath: {
        bindOffSts: 10,
        decreaseSts: 5,
        decreaseRows: 10,
        evenRows: 0,
      },
      firstArmholeRC: 143,
      stitchesAfterArmhole: 112,
      upperBackRows: 0,
      upperStartRc: 0,
      evenRowPadRows: 0,
      padStartRc: 0,
      neckChartRows: [],
      useNeckChartRows: false,
    });
    const blocks = rows.filter((r) => r.kind === "block");

    const rc143 = blocks.find((b) => b.rc === "RC:143");
    const rc144 = blocks.find((b) => b.rc === "RC:144");
    const rc145 = blocks.find((b) => b.rc === "RC:145");

    expect(rc143?.paragraphs.join(" ")).toContain("Bind off 10 stitches");
    expect(rc144?.paragraphs.join(" ")).toContain("Bind off 10 stitches");
    expect(rc145?.paragraphs.join(" ")).toContain("decrease 1 stitch every other row");

    expect(rc143?.stitchCount).toBe(132);
    expect(rc144?.stitchCount).toBe(122);
    expect(rc145?.stitchCount).toBe(112);
  });

  it("applies paired-edge decreases as 2 stitches per listed row and carries to RC 167", () => {
    const rows = buildSleevelessBackDisplayRows({
      castOnSts: 165,
      hemRows: 30,
      hemRowsValid: true,
      bodyToArmholeRows: 119,
      bodyRowsValid: true,
      armholeMath: {
        bindOffSts: 9,
        decreaseSts: 8,
        decreaseRows: 16,
        evenRows: 6,
      },
      firstArmholeRC: 149,
      // Intentionally different from arithmetic carry-forward; display math must follow listed actions.
      stitchesAfterArmhole: 130,
      upperBackRows: 0,
      upperStartRc: 0,
      evenRowPadRows: 0,
      padStartRc: 0,
      neckChartRows: [],
      useNeckChartRows: false,
    });
    const blocks = rows.filter((r) => r.kind === "block");

    const rc149 = blocks.find((b) => b.rc === "RC:149");
    const rc150 = blocks.find((b) => b.rc === "RC:150");
    const rc151 = blocks.find((b) => b.rc === "RC:151");
    const rc167 = blocks.find((b) => b.rc === "RC:167");

    expect(rc149?.paragraphs.join(" ")).toContain("Bind off 9 stitches");
    expect(rc150?.paragraphs.join(" ")).toContain("Bind off 9 stitches");
    expect(rc151?.paragraphs.join(" ")).toContain("decrease 1 stitch every other row");

    expect(rc149?.stitchCount).toBe(165);
    expect(rc150?.stitchCount).toBe(156);
    expect(rc151?.stitchCount).toBe(147);
    expect(rc167?.stitchCount).toBe(131);
  });

  it("when shoulder_depth is set, chart includes every row in the shoulder-depth span (shoulder every other row)", () => {
    const data = {
      ...patternData,
      fit: {
        ...(patternData.fit as object),
        selectedMeasurements: {
          ...(patternData.fit as { selectedMeasurements: Record<string, unknown> }).selectedMeasurements,
          shoulder_depth: 1,
        },
      },
    };
    const result = generateSleevelessBackPattern(data);
    expect(result.neckShoulderChartUsesLiveRows).toBe(true);

    const chartRows = result.neckShoulderShapingChart.rows;
    /** Center bind-off + 7 shaping rows @ 7 rows/in for 1" shoulder depth. */
    expect(chartRows.length).toBe(8);

    const afterCenterBindOff = chartRows.slice(1);
    expect(afterCenterBindOff.length).toBe(7);
    for (let i = 0; i < afterCenterBindOff.length; i++) {
      const hasShoulder =
        parseShapingDecrease(afterCenterBindOff[i].leftSide) > 0 ||
        parseShapingDecrease(afterCenterBindOff[i].rightSide) > 0;
      if (i % 2 !== 0) {
        expect(hasShoulder).toBe(false);
      }
    }
  });
});
