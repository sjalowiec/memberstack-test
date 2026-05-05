import { describe, expect, it } from "vitest";
import { calculateRoundFrontNeckline } from "./legoBlocks/roundFrontNeckline";
import { initialCenterNeckStitches } from "./legoBlocks/roundNeckline";
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
        neck_opening: 2,
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
      expect(joined).toContain(
        "Follow the chart row by row for neckline shaping. Stitch counts shown are the stitches remaining after the action on that row.",
      );
      expect(joined).toContain(
        "When neckline shaping is complete, bind off the remaining shoulder stitches. Repeat for the second side.",
      );
    }
  });

  it("renders front intro row using front neckline depth start RC", () => {
    const data = {
      ...patternData,
      fit: {
        ...(patternData.fit as object),
        selectedMeasurements: {
          ...(patternData.fit as { selectedMeasurements: Record<string, unknown> }).selectedMeasurements,
          front_neck_depth: 3,
        },
      },
    };
    const result = generateSleevelessBackPattern(data);
    const frontBlocks = result.frontDisplayRows.filter((r) => r.kind === "block") as Array<
      Extract<(typeof result.frontDisplayRows)[number], { kind: "block" }>
    >;
    const intro = frontBlocks.find((b) => b.paragraphs.some((p) => p.startsWith("Work as for Back to RC ")));
    expect(intro).toBeDefined();
    expect(intro?.paragraphs[0]).toBe(`Work as for Back to RC ${result.debug.frontNecklineStartRC}.`);
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

  it("front inherits shoulder stitches; deeper scoop shifts start RC; front neck uses round-front center bind-off + merged chart length", () => {
    /** 7 rows/in → back depth 6/7" → 6 rows; front 3" → 21 rows */
    const patternData: Record<string, unknown> = {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          neck_opening: 2,
          shoulder_width: 4.25,
          back_neck_depth: 6 / 7,
          front_neck_depth: 3,
        },
      },
      style: { recipientCategory: "misses" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
    };

    const result = generateSleevelessBackPattern(patternData);
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);
    expect(result.neckShoulderChartUsesLiveRows).toBe(true);

    expect(result.debug.frontNeckDepthRows).toBe(21);

    const backRows = result.neckShoulderShapingChart.rows;
    const frontRows = result.frontNeckShoulderShapingChart.rows;
    expect(backRows.length).toBeGreaterThan(0);
    expect(frontRows.length).toBeGreaterThan(0);

    const b0 = backRows[0];
    const f0 = frontRows[0];
    expect(f0.leftStitchCount).toBe(b0.leftStitchCount);
    expect(f0.rightStitchCount).toBe(b0.rightStitchCount);
    expect(parseShapingDecrease(b0.centerNeck)).toBe(initialCenterNeckStitches(10));
    const roundFront = calculateRoundFrontNeckline({
      necklineStitches: result.debug.necklineStitches!,
      neckDepthRows: result.debug.frontNeckDepthRows,
      startRC: result.debug.frontNecklineStartRC,
      shoulderStitchesPerSide: result.debug.shoulderStitches!,
    });
    expect(parseShapingDecrease(f0.centerNeck)).toBe(roundFront.centerBindOff);

    const lastBack = backRows[backRows.length - 1];
    const lastFront = frontRows[frontRows.length - 1];
    expect(lastFront.leftStitchCount).toBe(lastBack.leftStitchCount);
    expect(lastFront.rightStitchCount).toBe(lastBack.rightStitchCount);

    expect(result.debug.frontNecklineStartRC).toBeLessThan(result.debug.backNecklineStartRC);

    expect(frontRows.length).toBe(result.debug.frontNeckDepthRows);
    expect(backRows.length).toBe(result.debug.backNeckDepthRows);
  });

  it("front scoop inherits base center neck and shoulder stitches — neck_opening_stitches + B=130", () => {
    const wideShoulderPattern: Record<string, unknown> = {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 54,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          shoulder_width: 26,
          neck_opening_stitches: 53,
          back_neck_depth: 1,
          front_neck_depth: 5,
        },
      },
      style: { recipientCategory: "misses" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 300,
      },
    };

    const result = generateSleevelessBackPattern(wideShoulderPattern);
    const { debug } = result;

    expect(debug.stitchesAfterArmhole).toBe(130);
    expect(debug.centerNeckBindOffStitches).toBe(initialCenterNeckStitches(53));
    expect(debug.shoulderStitches).toBe(38);
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);

    const backRows = result.neckShoulderShapingChart.rows;
    const frontRows = result.frontNeckShoulderShapingChart.rows;
    expect(parseShapingDecrease(backRows[0]!.centerNeck)).toBe(initialCenterNeckStitches(53));
    const roundFrontWide = calculateRoundFrontNeckline({
      necklineStitches: debug.necklineStitches!,
      neckDepthRows: debug.frontNeckDepthRows,
      startRC: debug.frontNecklineStartRC,
      shoulderStitchesPerSide: debug.shoulderStitches!,
    });
    expect(parseShapingDecrease(frontRows[0]!.centerNeck)).toBe(roundFrontWide.centerBindOff);
    expect(frontRows[0]!.leftStitchCount).toBe(backRows[0]!.leftStitchCount);
    expect(frontRows[0]!.leftStitchCount).toBeGreaterThan(debug.shoulderStitches!);
    expect(frontRows.length).toBe(debug.frontNeckDepthRows);
    expect(backRows.length).toBe(debug.backNeckDepthRows);
    expect(debug.frontNecklineStartRC).toBeLessThan(debug.backNecklineStartRC);
  });

  it("back neckline chart spans exactly back neck depth rows (shoulder every other row within that budget)", () => {
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
    expect(chartRows.length).toBe(result.debug.backNeckDepthRows);

    const afterCenterBindOff = chartRows.slice(1);
    const shoulderRowIndices = afterCenterBindOff
      .map((r, i) =>
        parseShapingDecrease(r.leftSide) > 0 || parseShapingDecrease(r.rightSide) > 0 ? i : -1
      )
      .filter((i) => i >= 0);
    for (let k = 1; k < shoulderRowIndices.length; k++) {
      expect(shoulderRowIndices[k]! - shoulderRowIndices[k - 1]!).toBe(2);
    }
  });
});
