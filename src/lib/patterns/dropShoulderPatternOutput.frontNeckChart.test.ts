import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { tryBuildLiveDropShoulderFrontNotationSvg } from "./dropShoulderFrontShapingNotationDiagramSvg";
import { buildDropShoulderMountShapingMapData } from "./dropShoulderMountVisualGuides";
import { formatRcColon } from "./sleevelessPatternOutput";
import { formatRcNotation, formatRcResetNotation } from "./sleevelessBackJapaneseNotation";
import { buildDropShoulderFrontJapaneseNotationReplacements } from "./dropShoulderBodyJapaneseNotation";
import {
  dropShoulderFrontChartActiveSideRcStart,
  dropShoulderFrontNeckChartTableOptions,
} from "./dropShoulderFrontNeckShapingChart";
import { formatBindOffNotation } from "./sleevelessBackJapaneseNotation";
import {
  centerBindOffStitchesFromNeckShoulderChart,
  initialNeckBindOffFromNeckShoulderChart,
} from "./sleevelessPatternOutput";
import { cardiganFrontInitialNeckBindOffStitches } from "./roundNeckNotation";
import {
  renderActiveShoulderChartIntroHtml,
  renderNeckShoulderShapingChartTableOnlyHtml,
} from "./neckShoulderShapingChartHtml";
import { DROP_SHOULDER_NO_SHOULDER_SHAPING_NOTE } from "./neckShoulderActiveIntroCopy";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
  isCenterNecklineSetupChecklistRow,
} from "./neckShoulderActiveSideChecklist";
import { calculateRoundNecklinePlan } from "./legoBlocks/roundNeckline";
import { shapingActionRowNumbers } from "./evenShapingSchedule";
import { roundNeckPlanOneSideNeckEdgeWrittenLines } from "./roundNeckPlanPresentation";
import { NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL } from "./neckShoulderShapingChart";

const DROP_SHOULDER_BASE = {
  fit: {
    sizingChart: "women",
    selectedMeasurements: {
      finished_bust_chest: 40,
      back_neck_to_hem: 24,
      upper_arm: 16,
      wrist: 8,
      sleeve_length: 12,
      shoulder_width: 16,
      neck_opening: 7,
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

function frontNeckParagraphs(result: ReturnType<typeof generateDropShoulderPattern>): string {
  return (result.frontDisplayRows ?? [])
    .filter((row): row is Extract<(typeof result.frontDisplayRows)[number], { kind: "block" }> => row.kind === "block")
    .flatMap((row) => [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])])
    .join("\n");
}

describe("drop-shoulder front neckline shaping chart", () => {
  it("includes chart mount and live rows for pullover round neck", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_BASE);
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);
    expect(result.frontNeckShoulderShapingChart.rows.length).toBeGreaterThan(0);
    expect(result.neckShoulderShapingChart.rows).toHaveLength(0);
    expect(result.frontDisplayRows.some((r) => r.kind === "neckShoulderChartTableMount")).toBe(true);

    const center = centerBindOffStitchesFromNeckShoulderChart(result.frontNeckShoulderShapingChart);
    expect(center).toBeGreaterThan(0);

    const activeSideRcStart = dropShoulderFrontChartActiveSideRcStart(
      result.frontNeckShoulderShapingChart,
      result.debug.frontNecklineStartRC,
    );
    const html = renderNeckShoulderShapingChartTableOnlyHtml(
      result.frontNeckShoulderShapingChart,
      "test-drop-front-round",
      undefined,
      dropShoulderFrontNeckChartTableOptions(activeSideRcStart),
    );
    expect(html).toContain("Front Neckline Shaping Chart");
    expect(html).not.toContain("First Shoulder Checklist");
  });

  it("matches written front neck-edge RCs: center at 000, first edge BO at 002, then every 2 rows", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_BASE);
    const plan = calculateRoundNecklinePlan({
      necklineStitches: result.debug.necklineStitches!,
      necklineDepthRows: result.debug.frontNeckDepthRows!,
    });
    expect(plan.strategy).not.toBe("shallow-round");
    expect(plan.centerBindOff).toBeGreaterThan(0);
    expect(plan.right.stairSteps.length).toBeGreaterThan(0);

    const writtenLines = roundNeckPlanOneSideNeckEdgeWrittenLines(plan, "right", {
      necklineStartRc: 0,
    });
    const expectedStairRcs = shapingActionRowNumbers(2, plan.right.stairSteps.length, 2);
    const expectedSingleRcs = shapingActionRowNumbers(
      2 * (plan.right.stairSteps.length + 1),
      plan.right.singleDecreaseCount,
      2,
    );
    const expectedNeckRcs = [...expectedStairRcs, ...expectedSingleRcs];

    expect(writtenLines.some((line) => line.includes(`RC: ${expectedStairRcs.join(", ")}`))).toBe(
      true,
    );
    if (expectedSingleRcs.length > 0) {
      expect(
        writtenLines.some((line) => line.includes(`RC: ${expectedSingleRcs.join(", ")}`)),
      ).toBe(true);
    }

    const neckStart = result.debug.frontNecklineStartRC!;
    const timelineNeckLocals = (result.frontNeckShoulderTimeline ?? [])
      .filter((row) =>
        row.events.some(
          (e) =>
            e.edge === "inner" &&
            e.side === "right" &&
            (e.kind === "bindOff" || e.kind === "decrease"),
        ),
      )
      .map((row) => row.row - neckStart);
    expect(timelineNeckLocals).toEqual(expectedNeckRcs);

    const chart = result.frontNeckShoulderShapingChart;
    const activeSideRcStart = dropShoulderFrontChartActiveSideRcStart(
      chart,
      result.debug.frontNecklineStartRC,
    );
    expect(activeSideRcStart).toBe(0);
    const checklist = buildActiveSideInstructionTableRows(chart, activeSideRcStart, {
      includeCenterNecklineSetupRow: true,
    });
    expect(checklist[0]!.rc).toBe(0);
    expect(isCenterNecklineSetupChecklistRow(checklist[0]!)).toBe(true);

    const chartNeckRcs = checklist
      .filter(
        (row) =>
          row.edge === "Neck" &&
          row.action !== NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL &&
          !isCenterNecklineSetupChecklistRow(row),
      )
      .map((row) => row.rc);
    expect(chartNeckRcs[0]).toBe(2);
    expect(chartNeckRcs).toEqual(expectedNeckRcs);
    expect(chartNeckRcs).toEqual(timelineNeckLocals);
  });

  it("omits the Before Shaping / Divide the Neckline preamble and starts the chart at RC:000", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_BASE);
    const chart = result.frontNeckShoulderShapingChart;
    const activeSideRcStart = dropShoulderFrontChartActiveSideRcStart(
      chart,
      result.debug.frontNecklineStartRC,
    );
    const options = dropShoulderFrontNeckChartTableOptions(activeSideRcStart);

    // Origin is neckline reset — not armhole-local (e.g. 013 = neckStart − armholeStart).
    expect(activeSideRcStart).toBe(0);
    const armholeLocalStart = armholeLocalRcActiveShoulderChecklistStart(
      chart,
      result.debug.armholeStartRow,
      { includeCenterNecklineSetupRow: true },
    );
    expect(armholeLocalStart).toBeGreaterThan(0);
    expect(activeSideRcStart).not.toBe(armholeLocalStart);

    const checklist = buildActiveSideInstructionTableRows(chart, activeSideRcStart, {
      includeCenterNecklineSetupRow: true,
    });
    expect(checklist.length).toBeGreaterThan(0);
    expect(checklist[0]!.rc).toBe(0);
    expect(isCenterNecklineSetupChecklistRow(checklist[0]!)).toBe(true);

    // Mount/print path: no workflow intro HTML above the table.
    const html = renderNeckShoulderShapingChartTableOnlyHtml(
      chart,
      "test-drop-front-no-preamble",
      undefined,
      options,
    );
    expect(html).not.toContain("Before Shaping");
    expect(html).not.toContain("Divide the Neckline");
    expect(html).toContain('data-rc="0"');
    expect(html).toContain(
      '<span class="ns-shaping-chart__row-counter-number">000</span>',
    );
    expect(html).toMatch(/Scrap off center \d+ neckline/);
    expect(html).toContain("Front Neckline Shaping Chart");

    // Center divide is only the first-shoulder setup action; second shoulder keeps the same RC /
    // stitch-count row but rewrites the action to a held-side reminder (action text also appears in
    // data-row-id, so assert on the second checklist tbody cells rather than global match counts).
    const firstTbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? "";
    const secondTbody =
      html.match(/Second Shoulder Checklist[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? "";
    const y = checklist[0]!.stitchesRemaining;
    expect(firstTbody).toMatch(/Scrap off center \d+ neckline/);
    expect(firstTbody).toContain(`${y} needles in work`);
    expect(firstTbody).not.toMatch(/\d+\s+total\s*\/\s*\d+\s+active/);
    expect(secondTbody).toContain(`Return to the held shoulder with ${y} needles in work.`);
    expect(secondTbody).toContain(`${y} needles in work`);
    expect(secondTbody).not.toMatch(/Scrap off center|to divide/i);
    expect(secondTbody).not.toMatch(/\d+\s+total\s*\/\s*\d+\s+active/);
  });

  it("drops shoulder-shaping wording from the front chart second-shoulder copy (straight shoulders)", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_BASE);

    const html = renderNeckShoulderShapingChartTableOnlyHtml(
      result.frontNeckShoulderShapingChart,
      "test-drop-front-round-copy",
      undefined,
      dropShoulderFrontNeckChartTableOptions(
        dropShoulderFrontChartActiveSideRcStart(
          result.frontNeckShoulderShapingChart,
          result.debug.frontNecklineStartRC,
        ),
      ),
    );

    expect(html).not.toMatch(/shoulder shaping/i);
    expect(html).toContain("cut the yarn");
    expect(html).toContain("reversing the neckline shaping");
    expect(html).toContain("so it remains on the neck edge");
  });

  it("omits the no-shoulder-shaping note from the front chart intro (stated once in back instructions)", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_BASE);

    const intro = renderActiveShoulderChartIntroHtml({
      localStartRcLabel: "RC:000",
      centerBindOffStitches: centerBindOffStitchesFromNeckShoulderChart(
        result.frontNeckShoulderShapingChart,
      ),
      chart: result.frontNeckShoulderShapingChart,
      shouldersShaped: false,
      wrapperClass: "pattern-shaping-intro",
      layout: "labeled",
    });

    expect(intro).not.toContain(DROP_SHOULDER_NO_SHOULDER_SHAPING_NOTE);
    expect(intro).not.toMatch(/no shoulder shaping/i);

    const backText = (result.displayRows ?? [])
      .filter((row): row is Extract<(typeof result.displayRows)[number], { kind: "block" }> => row.kind === "block")
      .flatMap((row) => [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])])
      .join("\n");
    expect(backText).toContain("Drop-shoulder shoulders are worked straight — there is no shoulder shaping.");
  });

  it("omits the no-shoulder-shaping note when shoulders are shaped (sleeveless default)", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_BASE);

    const introShaped = renderActiveShoulderChartIntroHtml({
      localStartRcLabel: "RC:000",
      centerBindOffStitches: centerBindOffStitchesFromNeckShoulderChart(
        result.frontNeckShoulderShapingChart,
      ),
      chart: result.frontNeckShoulderShapingChart,
      wrapperClass: "pattern-shaping-intro",
      layout: "labeled",
    });

    expect(introShaped).not.toContain(DROP_SHOULDER_NO_SHOULDER_SHAPING_NOTE);
    expect(introShaped).not.toMatch(/no shoulder shaping/i);
  });

  it("includes chart for pullover V-neck", () => {
    const result = generateDropShoulderPattern({
      ...DROP_SHOULDER_BASE,
      style: { ...DROP_SHOULDER_BASE.style, neckline: "v-neck" },
    });
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);
    expect(result.frontNeckShoulderShapingChart.sleevelessFullWidthVNeckFront).toBe(true);
    expect(result.frontNeckShoulderShapingChart.rows.length).toBeGreaterThan(0);
  });

  it("includes chart for cardigan round neck with half-front CF bind-off", () => {
    const pattern = {
      ...DROP_SHOULDER_BASE,
      style: {
        ...DROP_SHOULDER_BASE.style,
        frontStyle: "open",
        garmentStyle: "cardigan",
      },
    };
    const result = generateDropShoulderPattern(pattern);
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);
    expect(result.frontNeckShoulderShapingChart.sleevelessCardiganFront).toBe(true);

    const cfBindOff = cardiganFrontInitialNeckBindOffStitches(
      result.debug.necklineStitches ?? 0,
      result.debug.frontNeckDepthRows,
    );
    const chartInitial = initialNeckBindOffFromNeckShoulderChart(result.frontNeckShoulderShapingChart, {
      fullNecklineStitches: result.debug.necklineStitches,
    });
    expect(chartInitial).toBe(cfBindOff);
    expect(frontNeckParagraphs(result)).toMatch(new RegExp(`bind off ${cfBindOff} stitches`, "i"));
  });

  it("includes chart for cardigan V-neck", () => {
    const result = generateDropShoulderPattern({
      ...DROP_SHOULDER_BASE,
      style: {
        ...DROP_SHOULDER_BASE.style,
        frontStyle: "open",
        garmentStyle: "cardigan",
        neckline: "v-neck",
      },
    });
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);
    expect(result.frontNeckShoulderShapingChart.sleevelessFullWidthVNeckFront).toBe(true);
    expect(result.frontNeckShoulderShapingChart.sleevelessCardiganFront).toBe(true);
    expect(result.frontNeckShoulderShapingChart.rows.length).toBeGreaterThan(0);
  });

  it("does not change written instructions or JP notation when chart is present", () => {
    const pattern = {
      ...DROP_SHOULDER_BASE,
      style: {
        ...DROP_SHOULDER_BASE.style,
        frontStyle: "open",
        garmentStyle: "cardigan",
      },
    };
    const result = generateDropShoulderPattern(pattern);
    const repl = buildDropShoulderFrontJapaneseNotationReplacements(result, pattern);
    const cfBindOff = cardiganFrontInitialNeckBindOffStitches(
      result.debug.necklineStitches ?? 0,
      result.debug.frontNeckDepthRows,
    );

    expect(repl["jp-neckline-bo"]).toBe(formatBindOffNotation(cfBindOff));
    expect(frontNeckParagraphs(result)).toMatch(new RegExp(`bind off ${cfBindOff} stitches`, "i"));
    expect(repl["jp-neckline-shaping"].length).toBeGreaterThan(0);
  });
});

function rcTimingPattern(
  frontNeckDepth: number,
  extras: { neckline?: string; frontStyle?: string; garmentStyle?: string } = {},
): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "women",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 24,
        upper_arm: 13.4,
        wrist: 8,
        sleeve_length: 12,
        shoulder_width: 16,
        neck_opening: 7,
        back_neck_depth: 1,
        front_neck_depth: frontNeckDepth,
      },
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 6,
      availableNeedles: 200,
    },
    style: {
      construction: "drop-shoulder",
      frontStyle: extras.frontStyle ?? "closed",
      garmentStyle: extras.garmentStyle ?? "pullover",
      neckline: extras.neckline ?? "round",
    },
  };
}

function firstWrittenFrontNeckRc(
  result: ReturnType<typeof generateDropShoulderPattern>,
): string | undefined {
  const rows = result.frontDisplayRows ?? [];
  const sectionIdx = rows.findIndex(
    (row) => row.kind === "section" && row.title === "FRONT NECKLINE & SHOULDERS",
  );
  if (sectionIdx < 0) return undefined;
  for (let i = sectionIdx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.kind === "section" || row.kind === "piece") break;
    if (row.kind === "block" && row.rowCounterReset !== true && row.rc) return row.rc;
  }
  return undefined;
}

describe("Drop Shoulder Front chart/map RC origin matches written and notation", () => {
  const COMBOS: Array<{
    name: string;
    extras: { neckline?: string; frontStyle?: string; garmentStyle?: string };
    expectFrontMap: boolean;
  }> = [
    { name: "Pullover Round", extras: {}, expectFrontMap: true },
    { name: "Pullover V-neck", extras: { neckline: "v-neck" }, expectFrontMap: false },
    {
      name: "Cardigan Round",
      extras: { frontStyle: "open", garmentStyle: "cardigan" },
      expectFrontMap: false,
    },
    {
      name: "Cardigan V-neck",
      extras: { neckline: "v-neck", frontStyle: "open", garmentStyle: "cardigan" },
      expectFrontMap: false,
    },
  ];

  it.each(COMBOS)(
    "$name before-armhole: written, notation, chart, and map use garment RC",
    ({ extras, expectFrontMap }) => {
      const pattern = rcTimingPattern(12, extras);
      const result = generateDropShoulderPattern(pattern);
      const start = result.debug.frontNecklineStartRC!;
      const marker = result.debug.armholeStartRow!;
      expect(start).toBe(72);
      expect(start).toBeLessThan(marker);

      expect(firstWrittenFrontNeckRc(result)).toBe(formatRcColon(start));

      const live = tryBuildLiveDropShoulderFrontNotationSvg(result, pattern) ?? "";
      expect(live).toContain(`data-rc-neck-start="${formatRcNotation(start)}"`);
      expect(live).toContain(`data-rc-armhole-marker="${formatRcNotation(marker)}"`);
      expect(live).not.toContain('data-rc-neck-start="rc000"');

      const chartStart = dropShoulderFrontChartActiveSideRcStart(
        result.frontNeckShoulderShapingChart,
        start,
        marker,
      );
      expect(chartStart).toBe(start);
      const checklist = buildActiveSideInstructionTableRows(
        result.frontNeckShoulderShapingChart,
        chartStart,
        { includeCenterNecklineSetupRow: true },
      );
      expect(checklist[0]!.rc).toBe(start);
      const html = renderNeckShoulderShapingChartTableOnlyHtml(
        result.frontNeckShoulderShapingChart,
        "before-armhole-chart",
        undefined,
        dropShoulderFrontNeckChartTableOptions(chartStart),
      );
      expect(html).toContain(`data-rc="${start}"`);
      expect(html).not.toContain(
        '<span class="ns-shaping-chart__row-counter-number">000</span>',
      );

      const { frontShapingMapData, backShapingMapData } = buildDropShoulderMountShapingMapData(
        result,
        pattern,
        { isCardigan: extras.garmentStyle === "cardigan" },
      );
      if (expectFrontMap) {
        expect(frontShapingMapData).not.toBeNull();
        expect(frontShapingMapData!.rowMin).toBe(start);
        expect(frontShapingMapData!.rowMin).not.toBe(0);
      } else {
        expect(frontShapingMapData).toBeNull();
      }
      if (backShapingMapData) {
        expect(backShapingMapData.rowMin).toBe(0);
      }
    },
  );

  it("at-marker Front chart and map keep local RC 000", () => {
    const pattern = rcTimingPattern(6.7);
    const result = generateDropShoulderPattern(pattern);
    expect(result.debug.frontNecklineStartRC).toBe(result.debug.armholeStartRow);
    expect(firstWrittenFrontNeckRc(result)).toBe("RC: 000");
    const chartStart = dropShoulderFrontChartActiveSideRcStart(
      result.frontNeckShoulderShapingChart,
      result.debug.frontNecklineStartRC,
      result.debug.armholeStartRow,
    );
    expect(chartStart).toBe(0);
    const { frontShapingMapData } = buildDropShoulderMountShapingMapData(result, pattern);
    expect(frontShapingMapData?.rowMin).toBe(0);
    const live = tryBuildLiveDropShoulderFrontNotationSvg(result, pattern) ?? "";
    expect(live).toContain(`data-rc-neck-start="${formatRcNotation(result.debug.frontNecklineStartRC!)}"`);
    expect(live).toContain(`data-rc-reset="${formatRcResetNotation(0)}"`);
    expect(live).not.toContain('data-rc-neck-start="rc000"');
    expect(live).not.toContain('data-role="body-rows"');
  });

  it("after-marker Front chart and map keep local RC 000", () => {
    const pattern = rcTimingPattern(3);
    const result = generateDropShoulderPattern(pattern);
    expect(result.debug.frontNecklineStartRC).toBeGreaterThan(result.debug.armholeStartRow!);
    expect(firstWrittenFrontNeckRc(result)).toBe("RC: 000");
    const chartStart = dropShoulderFrontChartActiveSideRcStart(
      result.frontNeckShoulderShapingChart,
      result.debug.frontNecklineStartRC,
      result.debug.armholeStartRow,
    );
    expect(chartStart).toBe(0);
    const { frontShapingMapData } = buildDropShoulderMountShapingMapData(result, pattern);
    expect(frontShapingMapData?.rowMin).toBe(0);
    const live = tryBuildLiveDropShoulderFrontNotationSvg(result, pattern) ?? "";
    expect(live).toContain(`data-rc-neck-start="${formatRcNotation(result.debug.frontNecklineStartRC!)}"`);
    expect(live).toContain(`data-rc-reset="${formatRcResetNotation(0)}"`);
    expect(live).not.toContain('data-rc-neck-start="rc000"');
    expect(live).not.toContain('data-role="body-rows"');
  });

  it("does not change Back map origin or Sleeveless Front reset", () => {
    const deep = generateDropShoulderPattern(rcTimingPattern(12));
    const { backShapingMapData } = buildDropShoulderMountShapingMapData(deep, rcTimingPattern(12));
    expect(backShapingMapData?.rowMin).toBe(0);

    const sleeveless = generateSleevelessBackPattern({
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
    });
    expect(
      sleeveless.frontDisplayRows.some(
        (row) => row.kind === "block" && row.rowCounterReset === true,
      ),
    ).toBe(true);
  });
});
