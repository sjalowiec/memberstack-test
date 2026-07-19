import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
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
