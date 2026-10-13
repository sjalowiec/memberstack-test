import { describe, expect, it } from "vitest";
import menChart from "../../../public/data/sizing_sweaters_men.json";
import missesChart from "../../../public/data/sizing_sweaters_misses.json";
import plusChart from "../../../public/data/sizing_sweaters_plus.json";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
  type ActiveSideInstructionTableRow,
} from "./neckShoulderActiveSideChecklist";
import { shoulderStitchesPerSideForDiagram } from "./sleevelessGarmentDiagramReplacements";
import { generateSleevelessBackPattern, type SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import {
  buildSleevelessRoundNeckBackShapingMapData,
  buildSleevelessRoundNeckBackShapingSchedule,
} from "./sleevelessRoundNeckBackShapingSchedule";
import {
  buildSleevelessRoundNeckShapingMapData,
  buildSleevelessRoundNeckShapingSchedule,
} from "./sleevelessRoundNeckShapingSchedule";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { generateSetInSleevePattern } from "./setInSleevePatternOutput";
import type { RowEntry } from "./shapingTimeline";

const CHECKLIST = { includeCenterNecklineSetupRow: true as const };

function sleeveless58(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      easeChoice: "standard",
      selectedMeasurements: {
        finished_bust_chest: 40,
        finished_hip: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        shoulder_width: 14.5,
        neck_width: 7.5,
        neck_opening: 7.5,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: {
      recipientCategory: "misses",
      neckline: "round",
      garmentStyle: "pullover",
      bodyShape: "straight",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 6,
      availableNeedles: 200,
    },
  };
}

function setInPattern(row: ChartRow, stitchesPerInch: number, rowsPerInch: number): Record<string, unknown> {
  const measurements = computeDefaultMeasurementsFromChartRow(row, "standard", { bodyShape: "straight" });
  return {
    fit: { sizingChart: "misses", easeChoice: "standard", selectedMeasurements: measurements },
    style: {
      recipientCategory: "misses",
      neckline: "round",
      garmentStyle: "pullover",
      bodyShape: "straight",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: stitchesPerInch,
      gaugeRowsPerInch: rowsPerInch,
      availableNeedles: 200,
    },
  };
}

function sectionText(rows: SleevelessBackPatternResult["displayRows"], title: string): string {
  let on = false;
  const parts: string[] = [];
  for (const row of rows) {
    if (row.kind === "section" && row.title === title) {
      on = true;
      continue;
    }
    if (on && row.kind === "section") break;
    if (on && row.kind === "block") {
      parts.push(...(row.trustedParagraphs ?? row.paragraphs ?? []));
    }
  }
  return parts.join("\n").replace(/<[^>]+>/g, "");
}

function stitchWord(n: number): string {
  return n === 1 ? "stitch" : "stitches";
}

function sideAmounts(timeline: readonly RowEntry[], edge: "inner" | "outer"): { left: number; right: number } {
  let left = 0;
  let right = 0;
  for (const entry of timeline) {
    for (const event of entry.events) {
      if (event.edge !== edge || event.amount <= 0) continue;
      if (event.side === "left") left += event.amount;
      if (event.side === "right") right += event.amount;
    }
  }
  return { left, right };
}

function centerAmount(timeline: readonly RowEntry[]): number {
  const first = [...timeline].sort((a, b) => a.row - b.row)[0];
  if (!first) return 0;
  return first.events
    .filter((event) => event.side === "center" && event.edge === "center")
    .reduce((sum, event) => sum + event.amount, 0);
}

function rightEdgeSequence(timeline: readonly RowEntry[], edge: "inner" | "outer"): { row: number; amount: number }[] {
  return [...timeline]
    .sort((a, b) => a.row - b.row)
    .flatMap((entry) => {
      const amount = entry.events
        .filter((event) => event.side === "right" && event.edge === edge && event.amount > 0)
        .reduce((sum, event) => sum + event.amount, 0);
      return amount > 0 ? [{ row: entry.row, amount }] : [];
    });
}

function actionAmount(action: string): number {
  const match = /(\d+)/.exec(action);
  return match ? Number(match[1]) : 0;
}

function checklistRows(
  chart: SleevelessBackPatternResult["neckShoulderShapingChart"],
  armholeStart: number,
): ActiveSideInstructionTableRow[] {
  const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, armholeStart, CHECKLIST);
  return buildActiveSideInstructionTableRows(chart, rcStart, CHECKLIST);
}

function assertNeedleRanges(
  text: string,
  expected: { center: number; section: number; neckEdge: number; finished: number },
): void {
  expect(text).not.toMatch(/Put needles L\d+ through R\d+ into hold/i);
  const center = /center neckline needles L(\d+) through R(\d+)/i.exec(text);
  const second = /Second Shoulder needles L(\d+) through L(\d+)/i.exec(text);
  const first = /First Shoulder on needles R(\d+) through R(\d+)/i.exec(text);
  expect(center).toBeTruthy();
  expect(second).toBeTruthy();
  expect(first).toBeTruthy();
  const centerLeft = Number(center![1]);
  const centerRight = Number(center![2]);
  const leftOuter = Number(second![1]);
  const leftInner = Number(second![2]);
  const rightInner = Number(first![1]);
  const rightOuter = Number(first![2]);
  expect(centerLeft + centerRight).toBe(expected.center);
  expect(Math.abs(leftOuter - leftInner) + 1).toBe(expected.section);
  expect(Math.abs(rightOuter - rightInner) + 1).toBe(expected.section);
  expect(Math.min(leftOuter, leftInner)).toBe(centerLeft + 1);
  expect(Math.min(rightInner, rightOuter)).toBe(centerRight + 1);
  expect(leftInner).toBeLessThan(leftOuter);
  expect(rightInner).toBeLessThan(rightOuter);
  expect(text).toContain(
    `Each shoulder section has ${expected.section} ${stitchWord(expected.section)} in work. Shape ${expected.neckEdge} ${stitchWord(expected.neckEdge)} at the neckline edge. The finished shoulder is ${expected.finished} ${stitchWord(expected.finished)}.`,
  );
}

function carriageSideProblems(
  timeline: readonly RowEntry[],
  armholeStart: number,
): string[] {
  const problems: string[] = [];
  for (const entry of timeline) {
    const local = entry.row - armholeStart;
    const shoulderSide = local % 2 === 0;
    let neckHold = 0;
    let neckBindOrDecrease = 0;
    let shoulderBindOff = 0;
    for (const event of entry.events) {
      if (event.side !== "right" || event.amount <= 0) continue;
      if (event.edge === "inner" && event.kind === "hold") neckHold += event.amount;
      if (event.edge === "inner" && (event.kind === "bindOff" || event.kind === "decrease")) {
        neckBindOrDecrease += event.amount;
      }
      if (event.edge === "outer" && event.kind === "bindOff") shoulderBindOff += event.amount;
    }
    if (shoulderBindOff > 0 && !shoulderSide) {
      problems.push(`RC ${local}: shoulder bind-off starts with the carriage at the neck.`);
    }
    if (neckBindOrDecrease > 0 && shoulderSide) {
      problems.push(`RC ${local}: neckline bind-off or decrease starts with the carriage at the shoulder.`);
    }
    if (neckHold > 0 && shoulderSide && shoulderBindOff === 0) {
      problems.push(`RC ${local}: neckline hold is on a shoulder-side row without the shoulder bind-off.`);
    }
    if (neckHold > 0 && !shoulderSide && shoulderBindOff > 0) {
      problems.push(`RC ${local}: neckline hold and shoulder bind-off share a neck-side row.`);
    }
  }
  return problems;
}

function assertTimelineMatchesChecklist(
  timeline: readonly RowEntry[],
  rows: readonly ActiveSideInstructionTableRow[],
  armholeStart: number,
  armholeEnd: number | undefined,
): string[] {
  const conflicts: string[] = [];
  const shaping = rows.filter((row) => row.edge === "Neck" || row.edge === "Shoulder" || row.edge === "Armhole");
  const actual = shaping.map((row) => `${row.edge}@${row.rc}:${actionAmount(row.action)}`);
  for (const entry of timeline) {
    expect(entry.row).toBeLessThanOrEqual(armholeEnd ?? entry.row);
    if (entry.stitchesL > 0) expect(entry.leftInnerEdge).toBeGreaterThanOrEqual(entry.leftOuterEdge);
    if (entry.stitchesR > 0) expect(entry.rightOuterEdge).toBeGreaterThanOrEqual(entry.rightInnerEdge);
    if (entry.stitchesL > 0 && entry.stitchesR > 0) {
      expect(entry.leftInnerEdge).toBeLessThan(entry.rightInnerEdge);
    }
    const local = entry.row - armholeStart;
    const neck = entry.events
      .filter((event) => event.side === "right" && event.edge === "inner" && event.amount > 0)
      .reduce((sum, event) => sum + event.amount, 0);
    const shoulder = entry.events
      .filter(
        (event) =>
          event.side === "right" && event.edge === "outer" && event.kind !== "decrease" && event.amount > 0,
      )
      .reduce((sum, event) => sum + event.amount, 0);
    const armhole = entry.events
      .filter(
        (event) =>
          event.side === "right" && event.edge === "outer" && event.kind === "decrease" && event.amount > 0,
      )
      .reduce((sum, event) => sum + event.amount, 0);
    if (neck > 0) expect(actual).toContain(`Neck@${local}:${neck}`);
    if (shoulder > 0) expect(actual).toContain(`Shoulder@${local}:${shoulder}`);
    if (armhole > 0) expect(actual).toContain(`Armhole@${local}:${armhole}`);
    if (neck > 0 && shoulder > 0) {
      const pair = shaping.filter((row) => row.rc === local && (row.edge === "Neck" || row.edge === "Shoulder"));
      const carriageAtNeck = local % 2 === 1;
      const blocked = pair.some((row) => row.passNote?.includes("cannot start"));
      if (carriageAtNeck) {
        expect(blocked).toBe(true);
        conflicts.push(`RC ${local}: neck and shoulder are both scheduled while the carriage is at the neck edge.`);
      } else {
        expect(blocked).toBe(false);
        expect(pair.some((row) => row.edge === "Shoulder" && row.passNote?.includes("shoulder edge"))).toBe(true);
        expect(pair.some((row) => row.edge === "Neck" && row.passNote?.includes("Same row"))).toBe(true);
      }
    }
  }
  for (const row of shaping) {
    expect(armholeStart + row.rc).toBeLessThanOrEqual(armholeEnd ?? armholeStart + row.rc);
  }
  return conflicts;
}

function assertMapMatchesSchedule(
  timeline: readonly RowEntry[],
  armholeStart: number,
  piece: "back" | "front",
): void {
  const schedule =
    piece === "back"
      ? buildSleevelessRoundNeckBackShapingSchedule(timeline)
      : buildSleevelessRoundNeckShapingSchedule(timeline);
  expect(schedule).toBeTruthy();
  const map =
    piece === "back"
      ? buildSleevelessRoundNeckBackShapingMapData(timeline, { firstArmholeRc: armholeStart })
      : buildSleevelessRoundNeckShapingMapData(timeline, { firstArmholeRc: armholeStart });
  expect(map).toBeTruthy();
  const expand = (
    ops: readonly { startRow: number; repetitions: number; rowInterval: number; stitches: number }[],
  ) =>
    ops.flatMap((op) =>
      Array.from({ length: op.repetitions }, (_, index) => ({
        row: op.startRow + index * op.rowInterval,
        stitches: op.stitches,
      })),
    );
  const neckPoints = expand(schedule!.neckOps);
  const shoulderPoints = expand(schedule!.shoulderOps);
  const neckPath = map!.paths.find((path) => path.id === "neck");
  const shoulderPath = map!.paths.find((path) => path.id === "shoulder");
  expect(neckPath?.steps.map((step) => step.stitches).sort((a, b) => a - b)).toEqual(
    neckPoints.map((point) => point.stitches).sort((a, b) => a - b),
  );
  expect(shoulderPath?.steps.map((step) => step.stitches)).toEqual(shoulderPoints.map((point) => point.stitches));
  if (shoulderPoints[0]) expect(shoulderPath?.startRow).toBe(shoulderPoints[0].row - armholeStart);
  if (neckPoints.length > 0) {
    const highest = Math.max(...neckPoints.map((point) => point.row));
    expect(neckPath?.startRow).toBe(highest - armholeStart);
  }
}

function auditPiece(result: SleevelessBackPatternResult, piece: "back" | "front"): string[] {
  const timeline = piece === "back" ? result.backNeckShoulderTimeline : result.frontNeckShoulderTimeline;
  const chart = piece === "back" ? result.neckShoulderShapingChart : result.frontNeckShoulderShapingChart;
  const rows = piece === "back" ? result.displayRows : result.frontDisplayRows;
  const title = piece === "back" ? "BACK NECKLINE & SHOULDERS" : "FRONT NECKLINE & SHOULDERS";
  expect(timeline?.length).toBeGreaterThan(0);
  const armholeStart = result.debug.armholeStartRow ?? 0;
  const neck = result.debug.necklineStitches ?? 0;
  const finished = result.debug.shoulderStitches ?? 0;
  const width = result.debug.stitchesAfterArmhole ?? 0;
  expect(shoulderStitchesPerSideForDiagram(result.debug)).toBe(finished);
  expect(finished).toBe(Math.floor((width - neck) / 2));
  const center = centerAmount(timeline!);
  const neckEdges = sideAmounts(timeline!, "inner");
  const shoulders = sideAmounts(timeline!, "outer");
  expect(center + neckEdges.left + neckEdges.right).toBe(neck);
  expect(shoulders.left).toBe(finished);
  expect(shoulders.right).toBe(finished);
  if (neck % 2 === 0) {
    expect(neckEdges.left).toBe(neckEdges.right);
  } else {
    expect(Math.abs(neckEdges.left - neckEdges.right)).toBeLessThanOrEqual(1);
  }
  const text = sectionText(rows, title);
  assertNeedleRanges(text, {
    center,
    section: finished + neckEdges.right,
    neckEdge: neckEdges.right,
    finished,
  });
  const conflicts = assertTimelineMatchesChecklist(
    timeline!,
    checklistRows(chart, armholeStart),
    armholeStart,
    result.debug.armholeEndRow,
  );
  assertMapMatchesSchedule(timeline!, armholeStart, piece);
  return conflicts;
}

describe("neckline and shoulder instruction audit", () => {
  it("sleeveless 58-stitch back and front keep the approved shaping and one timeline", () => {
    const result = generateSleevelessBackPattern(sleeveless58());
    expect(result.debug.stitchesAfterArmhole).toBe(58);
    expect(result.debug.necklineStitches).toBe(30);
    expect(result.debug.shoulderStitches).toBe(14);
    expect(shoulderStitchesPerSideForDiagram(result.debug)).toBe(14);

    const backConflicts = auditPiece(result, "back");
    const frontConflicts = auditPiece(result, "front");
    expect(centerAmount(result.backNeckShoulderTimeline!)).toBe(14);
    expect(sideAmounts(result.backNeckShoulderTimeline!, "inner")).toEqual({ left: 8, right: 8 });
    expect(rightEdgeSequence(result.backNeckShoulderTimeline!, "inner").map((point) => point.amount)).toEqual([
      3, 3, 2,
    ]);
    expect(centerAmount(result.frontNeckShoulderTimeline!)).toBe(10);
    expect(sideAmounts(result.frontNeckShoulderTimeline!, "inner")).toEqual({ left: 10, right: 10 });
    expect(rightEdgeSequence(result.frontNeckShoulderTimeline!, "inner").map((point) => point.amount)).toEqual([
      3, 2, 1, 1, 1, 1, 1,
    ]);
    const frontRows = rightEdgeSequence(result.frontNeckShoulderTimeline!, "inner").map((point) => point.row);
    for (let index = 1; index < frontRows.length; index += 1) {
      expect(frontRows[index]! - frontRows[index - 1]!).toBe(2);
    }
    expect(sectionText(result.displayRows, "BACK NECKLINE & SHOULDERS")).toContain(
      "Each shoulder section has 22 stitches in work. Shape 8 stitches at the neckline edge. The finished shoulder is 14 stitches.",
    );
    expect(sectionText(result.frontDisplayRows, "FRONT NECKLINE & SHOULDERS")).toContain(
      "Each shoulder section has 24 stitches in work. Shape 10 stitches at the neckline edge. The finished shoulder is 14 stitches.",
    );
    expect([...backConflicts, ...frontConflicts]).toEqual([]);
    expect(carriageSideProblems(result.backNeckShoulderTimeline!, result.debug.armholeStartRow ?? 0)).toEqual(
      [],
    );
    expect(carriageSideProblems(result.frontNeckShoulderTimeline!, result.debug.armholeStartRow ?? 0)).toEqual(
      [],
    );
    const armholeStart = result.debug.armholeStartRow ?? 0;
    const backInner = rightEdgeSequence(result.backNeckShoulderTimeline!, "inner");
    const backOuter = rightEdgeSequence(result.backNeckShoulderTimeline!, "outer");
    expect(backInner.map((point) => point.row)).toEqual(backOuter.map((point) => point.row));
    for (const point of backInner) {
      expect((point.row - armholeStart) % 2).toBe(0);
    }
  });

  it("set-in Misses size 1 at 5 stitches and 7 rows finishes inside the armhole", () => {
    const size1 = (missesChart as ChartRow[]).find((row) => row.size === 1);
    expect(size1).toBeTruthy();
    const result = generateSetInSleevePattern(setInPattern(size1!, 5, 7));
    expect(result.debug.stitchesAfterArmhole).toBe(60);
    expect(result.debug.necklineStitches).toBe(30);
    expect(result.debug.shoulderStitches).toBe(15);
    const conflicts = [...auditPiece(result, "back"), ...auditPiece(result, "front")];
    expect(centerAmount(result.backNeckShoulderTimeline!)).toBe(14);
    expect(sideAmounts(result.backNeckShoulderTimeline!, "inner")).toEqual({ left: 8, right: 8 });
    expect(sectionText(result.displayRows, "BACK NECKLINE & SHOULDERS")).toContain(
      "Each shoulder section has 23 stitches in work. Shape 8 stitches at the neckline edge. The finished shoulder is 15 stitches.",
    );
    expect(conflicts).toEqual([]);
    const armholeEnd = result.debug.armholeEndRow ?? 0;
    for (const timeline of [result.backNeckShoulderTimeline!, result.frontNeckShoulderTimeline!]) {
      expect(Math.max(...timeline.map((entry) => entry.row))).toBeLessThanOrEqual(armholeEnd);
    }
  });

  it("reconciles other Misses sizes and gauges, including an odd neckline", () => {
    const rows = missesChart as ChartRow[];
    const cases = [
      { size: 1, spi: 4, rpi: 6 },
      { size: 1, spi: 5, rpi: 7 },
      { size: 4, spi: 5, rpi: 7 },
      { size: 7, spi: 6, rpi: 8 },
      { size: 7, spi: 7, rpi: 10 },
      { size: 2, spi: 6, rpi: 8 },
    ];
    for (const item of cases) {
      const row = rows.find((chartRow) => chartRow.size === item.size);
      expect(row, `size ${item.size}`).toBeTruthy();
      const sleeveless = generateSleevelessBackPattern({
        ...setInPattern(row!, item.spi, item.rpi),
        style: {
          recipientCategory: "misses",
          neckline: "round",
          garmentStyle: "pullover",
          bodyShape: "straight",
        },
      });
      const setIn = generateSetInSleevePattern(setInPattern(row!, item.spi, item.rpi));
      const sleevelessBack = auditPiece(sleeveless, "back");
      const sleevelessFront = auditPiece(sleeveless, "front");
      const setInBack = auditPiece(setIn, "back");
      const setInFront = auditPiece(setIn, "front");
      const label = `size ${item.size} at ${item.spi} spi`;
      expect(sleevelessFront, `sleeveless front ${label}`).toEqual([]);
      expect(sleevelessBack, `sleeveless back ${label}`).toEqual([]);
      expect(setInBack, `set-in back ${label}`).toEqual([]);
      expect(setInFront, `set-in front ${label}`).toEqual([]);
      const armholeStart = sleeveless.debug.armholeStartRow ?? 0;
      expect(carriageSideProblems(sleeveless.backNeckShoulderTimeline!, armholeStart), label).toEqual([]);
      expect(carriageSideProblems(sleeveless.frontNeckShoulderTimeline!, armholeStart), label).toEqual([]);
    }
  });

  it("keeps Misses size 1 at 5 spi on shoulder-side bind-offs and neck-side holds", () => {
    const size1 = (missesChart as ChartRow[]).find((row) => row.size === 1);
    const result = generateSleevelessBackPattern({
      ...setInPattern(size1!, 5, 7),
      style: {
        recipientCategory: "misses",
        neckline: "round",
        garmentStyle: "pullover",
        bodyShape: "straight",
      },
    });
    const armholeStart = result.debug.armholeStartRow ?? 0;
    const local = (edge: "inner" | "outer") =>
      rightEdgeSequence(result.backNeckShoulderTimeline!, edge).map((point) => ({
        rc: point.row - armholeStart,
        amount: point.amount,
      }));
    expect(local("outer")).toEqual([
      { rc: 42, amount: 4 },
      { rc: 44, amount: 4 },
      { rc: 46, amount: 4 },
      { rc: 48, amount: 3 },
    ]);
    expect(local("inner")).toEqual([
      { rc: 43, amount: 2 },
      { rc: 45, amount: 2 },
      { rc: 47, amount: 2 },
      { rc: 49, amount: 2 },
    ]);
    const chartRows = checklistRows(result.neckShoulderShapingChart, armholeStart);
    const shoulderRows = chartRows.filter((row) => row.edge === "Shoulder");
    expect(shoulderRows.map((row) => row.action)).toEqual([
      "Bind off OR hold 4 sts",
      "Bind off OR hold 4 sts",
      "Bind off OR hold 4 sts",
      "Bind off OR hold 3 sts",
    ]);
    expect(shoulderRows.every((row) => row.rc % 2 === 0)).toBe(true);
    expect(Math.max(...result.backNeckShoulderTimeline!.map((entry) => entry.row))).toBeLessThanOrEqual(
      result.debug.armholeEndRow ?? 0,
    );
  });

  it("places neck and shoulder actions on the carriage side for Misses, Men, and Plus", () => {
    const charts = [
      { name: "misses", rows: missesChart as ChartRow[] },
      { name: "men", rows: menChart as ChartRow[] },
      { name: "plus", rows: plusChart as ChartRow[] },
    ];
    const gauges = [
      [4, 6],
      [5, 7],
      [6, 8],
      [7, 10],
    ] as const;
    for (const chart of charts) {
      for (const row of chart.rows) {
        for (const [spi, rpi] of gauges) {
          const result = generateSleevelessBackPattern({
            ...setInPattern(row, spi, rpi),
            fit: {
              sizingChart: chart.name,
              easeChoice: "standard",
              selectedMeasurements: computeDefaultMeasurementsFromChartRow(row, "standard", {
                bodyShape: "straight",
              }),
            },
            style: {
              recipientCategory: chart.name === "men" ? "men" : chart.name === "plus" ? "plus" : "misses",
              neckline: "round",
              garmentStyle: "pullover",
              bodyShape: "straight",
            },
          });
          const armholeStart = result.debug.armholeStartRow ?? 0;
          const label = `${chart.name} size ${String(row.size)} at ${spi} spi`;
          expect(carriageSideProblems(result.backNeckShoulderTimeline ?? [], armholeStart), label).toEqual([]);
          expect(carriageSideProblems(result.frontNeckShoulderTimeline ?? [], armholeStart), label).toEqual([]);
          const last = Math.max(
            ...(result.backNeckShoulderTimeline ?? []).map((entry) => entry.row),
            ...(result.frontNeckShoulderTimeline ?? []).map((entry) => entry.row),
          );
          expect(last, label).toBeLessThanOrEqual(result.debug.armholeEndRow ?? last);
        }
      }
    }
  });
});
