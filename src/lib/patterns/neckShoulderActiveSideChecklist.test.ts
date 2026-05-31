import { describe, expect, it } from "vitest";
import { buildTimeline } from "./shapingTimeline";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
  isCenterNecklineSetupChecklistRow,
} from "./neckShoulderActiveSideChecklist";
import { NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL } from "./neckShoulderShapingChart";
import { neckShoulderShapingChartFromRows } from "./neckShoulderShapingChart";
import { neckShoulderChartRowsFromTimeline } from "./neckShoulderShapingChartRows";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

const BACK_CHECKLIST_OPTIONS = { includeCenterNecklineSetupRow: true as const };

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

function cardiganPattern(): Record<string, unknown> {
  return {
    ...baseRoundNeckPattern(),
    style: { recipientCategory: "misses", neckline: "round", frontStyle: "open" },
  };
}

function centerBindOffFromTimeline(timeline: ReturnType<typeof buildTimeline>): number {
  const row0 = timeline[0];
  if (!row0) return 0;
  return row0.events
    .filter((e) => e.kind === "bindOff" && e.side === "center" && e.edge === "center")
    .reduce((sum, e) => sum + e.amount, 0);
}

function firstWorkedShapingRow(
  rows: ReturnType<typeof buildActiveSideInstructionTableRows>,
): (typeof rows)[number] | undefined {
  return rows.find(
    (row) =>
      row.action !== NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL && !isCenterNecklineSetupChecklistRow(row),
  );
}

describe("back active-shoulder checklist center neckline setup row", () => {
  it("buildTimeline center bind-off row is represented in the back checklist when setup is enabled", () => {
    const r = generateSleevelessBackPattern(cardiganPattern());
    const timeline = r.backNeckShoulderTimeline;
    expect(timeline?.length).toBeGreaterThan(1);
    const centerBo = centerBindOffFromTimeline(timeline!);
    expect(centerBo).toBeGreaterThan(0);

    const armholeStart = r.debug.armholeStartRow!;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(
      r.neckShoulderShapingChart,
      armholeStart,
      BACK_CHECKLIST_OPTIONS,
    );
    expect(rcStart).toBe(r.debug.backNecklineStartLocalRC);

    const rows = buildActiveSideInstructionTableRows(
      r.neckShoulderShapingChart,
      rcStart,
      BACK_CHECKLIST_OPTIONS,
    );
    const setup = rows.find(isCenterNecklineSetupChecklistRow);
    expect(setup).toBeDefined();
    expect(setup!.rc).toBe(rcStart);
    expect(setup!.action).toMatch(/scrap off center/i);
    expect(setup!.action).toMatch(String(centerBo));
    expect(setup!.stitchesRemaining).toBe(timeline![0]!.stitchesR);
  });

  it("setup row appears before the first worked shoulder row with active-shoulder stitch count", () => {
    const r = generateSleevelessBackPattern(cardiganPattern());
    const B = r.debug.stitchesAfterArmhole!;
    const timeline = r.backNeckShoulderTimeline!;
    const activeShoulderSts = timeline[0]!.stitchesR;
    expect(B).toBeGreaterThan(activeShoulderSts);
    expect(B - centerBindOffFromTimeline(timeline)).toBeGreaterThanOrEqual(activeShoulderSts * 2 - 1);

    const rcStart = armholeLocalRcActiveShoulderChecklistStart(
      r.neckShoulderShapingChart,
      r.debug.armholeStartRow,
      BACK_CHECKLIST_OPTIONS,
    );
    const rows = buildActiveSideInstructionTableRows(
      r.neckShoulderShapingChart,
      rcStart,
      BACK_CHECKLIST_OPTIONS,
    );

    const setupIdx = rows.findIndex(isCenterNecklineSetupChecklistRow);
    const firstShaping = firstWorkedShapingRow(rows);
    expect(setupIdx).toBe(0);
    expect(firstShaping).toBeDefined();
    expect(firstShaping!.rc).toBeGreaterThan(rows[setupIdx]!.rc);
    expect(rows[setupIdx]!.stitchesRemaining).toBe(activeShoulderSts);
    expect(firstShaping!.stitchesRemaining).toBeLessThanOrEqual(activeShoulderSts);
  });

  it("first worked shoulder shaping row stays at the next post-center garment RC (local +1)", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const timeline = r.backNeckShoulderTimeline!;
    const centerGarmentRc = timeline[0]!.row;
    const firstPostCenterGarmentRc = timeline[1]!.row;
    expect(firstPostCenterGarmentRc).toBe(centerGarmentRc + 1);

    const armholeStart = r.debug.armholeStartRow!;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(
      r.neckShoulderShapingChart,
      armholeStart,
      BACK_CHECKLIST_OPTIONS,
    );
    expect(rcStart).toBe(centerGarmentRc - armholeStart);

    const withoutSetup = buildActiveSideInstructionTableRows(
      r.neckShoulderShapingChart,
      firstPostCenterGarmentRc - armholeStart,
    );
    const withSetup = buildActiveSideInstructionTableRows(
      r.neckShoulderShapingChart,
      rcStart,
      BACK_CHECKLIST_OPTIONS,
    );

    const baselineFirstShaping = firstWorkedShapingRow(withoutSetup);
    const updatedFirstShaping = firstWorkedShapingRow(withSetup);
    expect(baselineFirstShaping?.rc).toBe(firstPostCenterGarmentRc - armholeStart);
    expect(updatedFirstShaping?.rc).toBe(baselineFirstShaping?.rc);
    expect(updatedFirstShaping?.action).toBe(baselineFirstShaping?.action);
    expect(updatedFirstShaping?.stitchesRemaining).toBe(baselineFirstShaping?.stitchesRemaining);
  });

  it("does not change front checklist when setup option is omitted", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const armholeStart = r.debug.armholeStartRow;
    const frontRcStart = armholeLocalRcActiveShoulderChecklistStart(
      r.frontNeckShoulderShapingChart,
      armholeStart,
    );
    const frontRows = buildActiveSideInstructionTableRows(
      r.frontNeckShoulderShapingChart,
      frontRcStart,
    );
    expect(frontRows.some(isCenterNecklineSetupChecklistRow)).toBe(false);

    const timeline = r.frontNeckShoulderTimeline!;
    const expectedStart = timeline[1]!.row - armholeStart!;
    expect(frontRcStart).toBe(expectedStart);
  });

  it("works from chart rows alone when timeline is attached to the chart object", () => {
    const r = generateSleevelessBackPattern(cardiganPattern());
    const timeline = r.backNeckShoulderTimeline!;
    const chart = neckShoulderShapingChartFromRows(neckShoulderChartRowsFromTimeline(timeline), {
      timeline,
    });
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(
      chart,
      r.debug.armholeStartRow,
      BACK_CHECKLIST_OPTIONS,
    );
    const rows = buildActiveSideInstructionTableRows(chart, rcStart, BACK_CHECKLIST_OPTIONS);
    expect(rows[0]).toBeDefined();
    expect(isCenterNecklineSetupChecklistRow(rows[0]!)).toBe(true);
  });

  it("every shaping action renders an explicit stitch count, including single-stitch decreases", () => {
    // Front neckline checklist: single-stitch neck decreases must read "Decrease 1 st",
    // never "Decrease st" (no count suppression when amount === 1).
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(
      r.frontNeckShoulderShapingChart,
      r.debug.armholeStartRow,
    );
    const rows = buildActiveSideInstructionTableRows(r.frontNeckShoulderShapingChart, rcStart);

    const shapingRows = rows.filter(
      (row) =>
        row.action !== NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL &&
        !isCenterNecklineSetupChecklistRow(row),
    );
    expect(shapingRows.length).toBeGreaterThan(0);

    const singleDecrease = shapingRows.find((row) => row.edge === "Neck" && /^Decrease /.test(row.action));
    expect(singleDecrease?.action).toBe("Decrease 1 st");

    // No worked Decrease/Bind off action may omit its numeric stitch count.
    for (const row of shapingRows) {
      if (/^(Decrease|Bind off)/.test(row.action)) {
        expect(row.action).toMatch(/^(Decrease|Bind off( OR hold)?) \d+ sts?$/);
      }
    }
  });

  it("armhole bind-off actions use explicit 'Bind off OR hold' wording (no slash notation)", () => {
    const r = generateSleevelessBackPattern(cardiganPattern());
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(
      r.neckShoulderShapingChart,
      r.debug.armholeStartRow,
      BACK_CHECKLIST_OPTIONS,
    );
    const rows = buildActiveSideInstructionTableRows(
      r.neckShoulderShapingChart,
      rcStart,
      BACK_CHECKLIST_OPTIONS,
    );
    expect(rows.some((row) => /bind off \/ hold/i.test(row.action))).toBe(false);
    const armholeBindOff = rows.filter(
      (row) => row.edge === "Armhole" && /^Bind off OR hold /.test(row.action),
    );
    expect(armholeBindOff.length).toBeGreaterThan(0);
  });
});
