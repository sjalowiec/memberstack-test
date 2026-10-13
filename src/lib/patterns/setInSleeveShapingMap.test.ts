import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import missesChart from "../../../public/data/sizing_sweaters_misses.json";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
} from "./neckShoulderActiveSideChecklist";
import { buildPatternVisualGuidesHtml } from "./patternVisualGuides";
import { shoulderStitchesPerSideForDiagram } from "./sleevelessGarmentDiagramReplacements";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import {
  buildSleevelessRoundNeckBackShapingMapData,
  buildSleevelessRoundNeckBackShapingSchedule,
} from "./sleevelessRoundNeckBackShapingSchedule";
import {
  buildSleevelessRoundNeckShapingMapData,
  buildSleevelessRoundNeckShapingSchedule,
} from "./sleevelessRoundNeckShapingSchedule";
import { renderShapingMapSvg } from "./shapingMapSvg";
import { generateSetInSleevePattern } from "./setInSleevePatternOutput";

const FRONT_MAP_NOTE =
  "The shoulder is at the top of this map. Neckline steps continue down to the center. The checklist uses the same row numbers, starting at the center neckline and working upward.";

function missesSize1() {
  const row = (missesChart as ChartRow[]).find((item) => item.size === 1);
  const measurements = computeDefaultMeasurementsFromChartRow(row!, "standard", {
    bodyShape: "straight",
  });
  return generateSetInSleevePattern({
    fit: { sizingChart: "misses", easeChoice: "standard", selectedMeasurements: measurements },
    style: {
      recipientCategory: "misses",
      neckline: "round",
      garmentStyle: "pullover",
      bodyShape: "straight",
    },
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  });
}

function checklistActions(
  result: ReturnType<typeof generateSetInSleevePattern>,
  piece: "back" | "front",
  edge: "Neck" | "Shoulder",
) {
  const chart = piece === "back" ? result.neckShoulderShapingChart : result.frontNeckShoulderShapingChart;
  const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, result.debug.armholeStartRow, {
    includeCenterNecklineSetupRow: true,
  });
  return buildActiveSideInstructionTableRows(chart, rcStart, { includeCenterNecklineSetupRow: true })
    .filter((row) => row.edge === edge)
    .map((row) => ({
      rc: row.rc,
      amount: Number(/(\d+)/.exec(row.action)?.[1] ?? 0),
    }))
    .filter((row) => row.amount > 0);
}

function stepLabels(svg: string): string[] {
  return [...svg.matchAll(/class="shaping-map-step-label[^"]*"[^>]*>([^<]+)</g)].map((match) => match[1]!);
}

describe("set-in sleeve shaping maps", () => {
  it("shows the back and front maps for Misses size 1 at 5 stitches and 7 rows", () => {
    const result = missesSize1();
    const armholeStart = result.debug.armholeStartRow ?? 0;
    expect(result.debug.necklineStitches).toBe(30);
    expect(shoulderStitchesPerSideForDiagram(result.debug)).toBe(15);

    const backMap = buildSleevelessRoundNeckBackShapingMapData(result.backNeckShoulderTimeline, {
      firstArmholeRc: armholeStart,
    });
    const frontMap = buildSleevelessRoundNeckShapingMapData(result.frontNeckShoulderTimeline, {
      firstArmholeRc: armholeStart,
    });
    expect(backMap).not.toBeNull();
    expect(frontMap).not.toBeNull();

    const backSchedule = buildSleevelessRoundNeckBackShapingSchedule(result.backNeckShoulderTimeline)!;
    const backLeft = buildSleevelessRoundNeckBackShapingSchedule(result.backNeckShoulderTimeline, {
      edge: "left",
    })!;
    expect(backSchedule.centerHeld).toBe(true);
    expect(backSchedule.centerStitches).toBe(14);
    expect(backLeft.neckStitchesTotal).toBe(backSchedule.neckStitchesTotal);
    expect(backLeft.shoulderStitchesTotal).toBe(backSchedule.shoulderStitchesTotal);
    expect(backLeft.neckOps.map((op) => op.stitches)).toEqual(backSchedule.neckOps.map((op) => op.stitches));
    expect(backLeft.shoulderOps.map((op) => op.stitches)).toEqual(
      backSchedule.shoulderOps.map((op) => op.stitches),
    );

    const backNeck = checklistActions(result, "back", "Neck");
    const backShoulder = checklistActions(result, "back", "Shoulder");
    expect(backNeck.map((row) => row.amount)).toEqual([2, 2, 2, 2]);
    expect(backShoulder.map((row) => row.amount)).toEqual([4, 4, 4, 3]);
    expect(backMap!.centerStitches).toBe(14);
    expect(backMap!.centerLabel).toBe("Hold 14 center stitches");
    expect(backMap!.paths.find((path) => path.id === "shoulder")!.steps.map((step) => step.stitches)).toEqual(
      backShoulder.map((row) => row.amount),
    );
    expect(backMap!.paths.find((path) => path.id === "shoulder")!.startRow).toBe(backShoulder[0]!.rc);
    const backNeckSteps = backMap!.paths.find((path) => path.id === "neck")!.steps.map((step) => step.stitches);
    expect([...backNeckSteps].reverse()).toEqual(backNeck.map((row) => row.amount));
    expect(backMap!.paths.find((path) => path.id === "neck")!.startRow).toBe(backNeck[backNeck.length - 1]!.rc);
    expect(backMap!.rowMin).toBe(backShoulder[0]!.rc);
    expect(backMap!.rowMax).toBe(backNeck[backNeck.length - 1]!.rc);

    const backSvg = renderShapingMapSvg(backMap!, { mirror: true });
    expect(backSvg).toContain(">Hold 14 center stitches<");
    expect(backSvg).toContain(">Armhole Edge<");
    expect(backSvg).toContain(">Neck Edge<");
    expect(stepLabels(backSvg)).toEqual(["-4", "-4", "-4", "-3", "-2", "-2", "-2", "-2"]);
    for (const rc of [42, 44, 46, 48]) {
      expect(backSvg).toContain(`>${rc}<`);
    }

    const frontNeck = checklistActions(result, "front", "Neck");
    const frontShoulder = checklistActions(result, "front", "Shoulder");
    const frontLeft = buildSleevelessRoundNeckShapingSchedule(result.frontNeckShoulderTimeline, {
      edge: "left",
    })!;
    const frontRight = buildSleevelessRoundNeckShapingSchedule(result.frontNeckShoulderTimeline)!;
    expect(frontLeft.neckStitchesTotal).toBe(frontRight.neckStitchesTotal);
    expect(frontLeft.shoulderStitchesTotal).toBe(frontRight.shoulderStitchesTotal);
    expect(frontMap!.paths.find((path) => path.id === "neck")!.rowDirection).toBe("down");
    expect(frontMap!.paths.find((path) => path.id === "neck")!.startRow).toBe(frontNeck[frontNeck.length - 1]!.rc);
    expect(
      [...frontMap!.paths.find((path) => path.id === "neck")!.steps.map((step) => step.stitches)].reverse(),
    ).toEqual(frontNeck.map((row) => row.amount));
    expect(frontMap!.paths.find((path) => path.id === "shoulder")!.steps.map((step) => step.stitches)).toEqual(
      frontShoulder.map((row) => row.amount),
    );
    expect(frontNeck.map((row) => row.amount)).toEqual([3, 2, 1, 1, 1, 1, 1]);
    expect(frontShoulder.map((row) => row.amount)).toEqual([4, 4, 4, 3]);

    const backGuides = buildPatternVisualGuidesHtml({
      piece: "back",
      notationSupported: false,
      shapingMapData: backMap,
    });
    const frontGuides = buildPatternVisualGuidesHtml({
      piece: "front",
      notationSupported: false,
      shapingMapData: frontMap,
      shapingMapNote: FRONT_MAP_NOTE,
    });
    expect(backGuides).toContain("Shaping Map");
    expect(backGuides).toContain("shaping-map__svg");
    expect(backGuides).toContain("Hold 14 center stitches");
    expect(frontGuides).toContain("Shaping Map");
    expect(frontGuides).toContain("shaping-map__svg");
    expect(frontGuides).toContain(FRONT_MAP_NOTE);
    expect(frontGuides).toContain("Bind off 10 center stitches");

    const page = readFileSync("src/scripts/sleevelessPatternPageShared.ts", "utf8");
    const setIn = page.slice(page.indexOf("async function renderSetInSleeveMount"), page.indexOf("async function renderMount"));
    expect(setIn).toContain("buildSleevelessRoundNeckBackShapingMapData");
    expect(setIn).toContain("shapingMapData: backShapingMapData");
    expect(setIn).toContain('piece: "back"');
    expect(setIn).toContain("buildSleevelessRoundNeckShapingMapData");
    expect(setIn).toContain("shapingMapNote: frontShapingMapNote");
    expect(setIn).toContain(FRONT_MAP_NOTE);
  });
});
