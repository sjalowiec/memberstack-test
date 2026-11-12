import { describe, expect, it } from "vitest";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { renderPatternDisplayRowsHtml } from "./sleevelessPatternDisplayHtml";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import { buildPatternVisualGuidesHtml } from "./patternVisualGuides";
import { renderSleevelessPatternTabFrontChartTableHtml } from "./sleevelessFrontChartIntroHtml";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
} from "./neckShoulderActiveSideChecklist";
import { renderNeckShoulderShapingChartTableOnlyHtml } from "./neckShoulderShapingChartHtml";
import { resolveFrontVNeckRowCounterDisplayPolicy } from "./frontArmholeNecklineComposition";
import { buildSleevelessRoundNeckBackShapingMapData } from "./sleevelessRoundNeckBackShapingSchedule";
import { buildSleevelessRoundNeckShapingMapData } from "./sleevelessRoundNeckShapingSchedule";
import { generateSetInSleevePattern } from "./setInSleevePatternOutput";
import { renderSetInCenterSeamNeckChartHtml } from "./setInSleevePrintShaping";
import { withSetInSleeveConstructionAuthored } from "./setInSleeveConstructionIdentity";
import {
  ARMHOLE_RC_CHART_COUNTER_NOTE,
  CHART_COUNTER_PIECE_ROW_COUNTER,
  CHART_COUNTER_RESET_BEFORE_THIS_CHART,
  CONTINUOUS_PIECE_CHART_COUNTER_NOTE,
  CUFF_UP_SLEEVE_BODY_CHART_COUNTER_NOTE,
  CUFF_UP_SLEEVE_CAP_CHART_COUNTER_NOTE,
  chartUsesArmholeRowCounter,
  resolveChartCounterHeader,
  setInNecklineChartCounterNote,
} from "./chartCounterHeader";

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

function pattern(options?: { neckline?: "round" | "v-neck"; availableNeedles?: number }) {
  const measurements = computeDefaultMeasurementsFromChartRow(MISSES_7, "standard", {
    bodyShape: "straight",
  });
  return {
    fit: { sizingChart: "misses", easeChoice: "standard", selectedMeasurements: measurements },
    style: withSetInSleeveConstructionAuthored(
      {
        recipientCategory: "misses",
        garmentStyle: "pullover",
        neckline: options?.neckline ?? "round",
        bodyShape: "straight",
      },
      "long",
    ),
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: options?.availableNeedles ?? 200,
    },
  };
}

function firstRc(html: string): string {
  return html.match(/ns-shaping-chart__row-counter-number">([^<]+)</)?.[1]?.split(/\u2013|-/)[0] ?? "";
}

describe("chart counter headers", () => {
  it("keeps a chart's own reset sentence unless the chart names a different counter", () => {
    expect(
      resolveChartCounterHeader({ explicitNote: "", resetBeforeChart: true }),
    ).toBe(CHART_COUNTER_RESET_BEFORE_THIS_CHART);
    expect(
      resolveChartCounterHeader({ explicitNote: "  ", resetBeforeChart: false }),
    ).toBe(CHART_COUNTER_PIECE_ROW_COUNTER);
    expect(
      resolveChartCounterHeader({
        explicitNote: `  ${ARMHOLE_RC_CHART_COUNTER_NOTE}  `,
        resetBeforeChart: true,
      }),
    ).toBe(ARMHOLE_RC_CHART_COUNTER_NOTE);
  });

  it("uses Armhole RC only when the neckline is on that counter", () => {
    expect(chartUsesArmholeRowCounter({ necklineStartLocalRc: 42 })).toBe(true);
    expect(chartUsesArmholeRowCounter({ necklineStartLocalRc: 0 })).toBe(true);
    expect(chartUsesArmholeRowCounter({ necklineStartLocalRc: -3 })).toBe(false);
    expect(
      chartUsesArmholeRowCounter({ necklineStartLocalRc: 12, continuousGarmentRc: true }),
    ).toBe(false);
    expect(setInNecklineChartCounterNote({ necklineStartLocalRc: 12 })).toBe(
      ARMHOLE_RC_CHART_COUNTER_NOTE,
    );
    expect(setInNecklineChartCounterNote({ continuousGarmentRc: true })).toBe(
      CONTINUOUS_PIECE_CHART_COUNTER_NOTE,
    );
  });

  it("puts the Armhole RC sentence on back and front charts without changing row numbers", () => {
    const result = generateSetInSleevePattern(pattern());
    const backNote = setInNecklineChartCounterNote({
      necklineStartLocalRc: result.debug.backNecklineStartLocalRC,
    });
    const frontNote = setInNecklineChartCounterNote({
      necklineStartLocalRc: result.debug.frontNecklineStartLocalRC,
      continuousGarmentRc:
        resolveFrontVNeckRowCounterDisplayPolicy(result.debug.frontArmholeNecklineOverlap) ===
        "continuous-garment-rc",
    });
    expect(backNote).toBe(ARMHOLE_RC_CHART_COUNTER_NOTE);
    expect(frontNote).toBe(ARMHOLE_RC_CHART_COUNTER_NOTE);

    const backStart = armholeLocalRcActiveShoulderChecklistStart(
      result.neckShoulderShapingChart!,
      result.debug.armholeStartRow,
      { includeCenterNecklineSetupRow: true },
    );
    const withoutNote = renderNeckShoulderShapingChartTableOnlyHtml(
      result.neckShoulderShapingChart!,
      "ns-shaping-chart-back",
      "",
      {
        activeSideOnly: true,
        activeSideRcStart: backStart,
        includeCenterNecklineSetupRow: true,
        hideCenterNecklineSetupRow: true,
        tableHeading: "First Shoulder Checklist",
        resetRowCounterForSecondShoulder: true,
      },
    );
    const backHtml = renderNeckShoulderShapingChartTableOnlyHtml(
      result.neckShoulderShapingChart!,
      "ns-shaping-chart-back",
      "",
      {
        activeSideOnly: true,
        activeSideRcStart: backStart,
        includeCenterNecklineSetupRow: true,
        hideCenterNecklineSetupRow: true,
        tableHeading: "First Shoulder Checklist",
        resetRowCounterForSecondShoulder: true,
        counterNote: backNote,
      },
    );
    const frontHtml = renderSleevelessPatternTabFrontChartTableHtml(result, {
      relocateIntro: true,
      resetRowCounterForSecondShoulder: true,
      counterNote: frontNote,
    });
    expect(firstRc(backHtml)).toBe(firstRc(withoutNote));
    expect(firstRc(backHtml)).not.toBe("");
    expect(backStart).toBeGreaterThan(0);
    expect(backHtml).toContain(ARMHOLE_RC_CHART_COUNTER_NOTE);
    expect(backHtml).toContain("Second Shoulder Checklist");
    expect(backHtml).toContain(`Set the row counter to RC: ${firstRc(backHtml)}`);
    expect(withoutNote).toContain(`Set the row counter to RC: ${firstRc(withoutNote)}`);
    expect(backHtml.match(/data-chart-counter-note/g)?.length).toBeGreaterThan(1);
    expect(frontHtml).toContain(ARMHOLE_RC_CHART_COUNTER_NOTE);
    expect(frontHtml).not.toContain(CHART_COUNTER_RESET_BEFORE_THIS_CHART);
    const frontRows = buildActiveSideInstructionTableRows(
      result.frontNeckShoulderShapingChart,
      armholeLocalRcActiveShoulderChecklistStart(
        result.frontNeckShoulderShapingChart,
        result.debug.armholeStartRow,
        { includeCenterNecklineSetupRow: true },
      ),
      { includeCenterNecklineSetupRow: true },
    );
    expect(frontHtml).toContain(`>${String(frontRows[0]?.rc).padStart(3, "0")}<`);
  });

  it("names Armhole RC on center-seam back and front charts", () => {
    const base = pattern({ availableNeedles: 80 });
    const withSeams = generateSetInSleevePattern({
      ...base,
      style: { ...(base.style as object), centerSeams: true },
    });
    const pieces = withSeams.centerSeamPieces!;
    const backHtml = renderSetInCenterSeamNeckChartHtml({
      piece: "left-back",
      chart: pieces.leftBack.frontNeckShoulderShapingChart,
      armholeStartRow: pieces.leftBack.debug.armholeStartRow,
    });
    const frontHtml = renderSetInCenterSeamNeckChartHtml({
      piece: "right-front",
      chart: pieces.rightFront!.frontNeckShoulderShapingChart,
      armholeStartRow: pieces.rightFront!.debug.armholeStartRow,
    });
    expect(withSeams.needleCapacity?.offerSeams).toBe(true);
    expect(backHtml).toContain(ARMHOLE_RC_CHART_COUNTER_NOTE);
    expect(frontHtml).toContain(ARMHOLE_RC_CHART_COUNTER_NOTE);
    expect(firstRc(backHtml)).not.toBe("");
    expect(firstRc(frontHtml)).not.toBe("");
    expect(firstRc(backHtml)).not.toBe(firstRc(frontHtml));
  });

  it("puts the same Armhole RC sentence on the shaping map", () => {
    const result = generateSetInSleevePattern(pattern());
    const backMap = buildSleevelessRoundNeckBackShapingMapData(result.backNeckShoulderTimeline, {
      firstArmholeRc: result.debug.armholeStartRow,
    });
    const frontMap = buildSleevelessRoundNeckShapingMapData(result.frontNeckShoulderTimeline, {
      firstArmholeRc: result.debug.armholeStartRow,
    });
    const html = buildPatternVisualGuidesHtml({
      piece: "back",
      notationSupported: false,
      shapingMapData: backMap,
      counterNote: ARMHOLE_RC_CHART_COUNTER_NOTE,
    });
    expect(frontMap).not.toBeNull();
    expect(html).toContain("Shaping Map");
    expect(html).toContain(ARMHOLE_RC_CHART_COUNTER_NOTE);
    expect(html).toContain("data-chart-counter-note");
  });

  it("identifies the sleeve chart reset separately from the armhole counter", () => {
    const result = generateSetInSleevePattern(pattern());
    const screen = renderPatternDisplayRowsHtml(result.sleeveDisplayRows, { pieceSectionId: "sleeve" });
    const printHtml = renderSleevelessPrintPieceHtml(result.sleeveDisplayRows, "", "sleeve");
    for (const html of [screen, printHtml]) {
      expect(html).toContain(CUFF_UP_SLEEVE_BODY_CHART_COUNTER_NOTE);
      expect(html).toContain(CUFF_UP_SLEEVE_CAP_CHART_COUNTER_NOTE);
      expect(html).not.toContain(ARMHOLE_RC_CHART_COUNTER_NOTE);
      expect(html).toContain('data-chart-id="drop-shoulder-sleeve-shaping-chart-sleeve"');
      expect(html).toContain('data-chart-id="set-in-sleeve-cap-shaping-chart-sleeve"');
    }
    const capChart = result.sleeveDisplayRows.find(
      (row) => row.kind === "block" && row.sleeveShapingChartId === "set-in-sleeve-cap-shaping-chart",
    );
    const capRows = capChart && capChart.kind === "block" ? capChart.sleeveShapingChartRows ?? [] : [];
    expect(capRows[0]?.rc).toBe(result.sleevePiece?.sleeveBodyRows);
    expect(capRows[0]?.rc).not.toBe(0);
  });
});
