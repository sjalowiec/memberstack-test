import { describe, expect, it } from "vitest";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { withDropShoulderConstructionAuthored } from "./patternConstructionIdentity";
import {
  buildActiveSideInstructionTableRows,
} from "./neckShoulderActiveSideChecklist";
import { FREE_PASS_GLOSSARY_ID } from "./neckShoulderShapingChartHtml";
import { renderNeckShoulderShapingChartTableOnlyHtml } from "./neckShoulderShapingChartHtml";
import {
  armholeLocalRcActiveShoulderChecklistStart,
} from "./neckShoulderActiveSideChecklist";
import { generateSetInSleevePattern } from "./setInSleevePatternOutput";
import { withSetInSleeveConstructionAuthored } from "./setInSleeveConstructionIdentity";
import {
  collectCompleteShoulderShapingPoints,
  shoulderShapingNotationLinesFromTimeline,
} from "./shoulderShapingNotation";
import { resolveFrontVNeckShapingTimingCase } from "./frontArmholeNecklineComposition";
import plusSizes from "../../../public/data/sizing_sweaters_plus.json";
import menSizes from "../../../public/data/sizing_sweaters_men.json";

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

const MEN_MED = (menSizes as ChartRow[]).find((row) => String(row.size) === "M") ?? (menSizes as ChartRow[])[3]!;
const PLUS_1X = (plusSizes as ChartRow[]).find((row) => String(row.size) === "1x") ?? (plusSizes as ChartRow[])[0]!;

function pattern(options: {
  audience?: string;
  row?: ChartRow;
  garmentStyle?: "pullover" | "cardigan";
  neckline?: "round" | "v-neck";
  stitchesPerInch?: number;
  rowsPerInch?: number;
  frontNeckDepth?: number;
  armholeDepth?: number;
}): Record<string, unknown> {
  const audience = options.audience ?? "misses";
  const row = options.row ?? MISSES_7;
  const measurements = computeDefaultMeasurementsFromChartRow(row, "standard", { bodyShape: "straight" });
  if (options.frontNeckDepth) measurements.front_neck_depth = options.frontNeckDepth;
  if (options.armholeDepth) measurements.armhole_depth = options.armholeDepth;
  return {
    fit: { sizingChart: audience, easeChoice: "standard", selectedMeasurements: measurements },
    style: withSetInSleeveConstructionAuthored(
      {
        recipientCategory: audience,
        garmentStyle: options.garmentStyle ?? "pullover",
        neckline: options.neckline ?? "round",
        bodyShape: "straight",
      },
      "long",
    ),
    yarnGaugeMachine: {
      gaugeStitchesPerInch: options.stitchesPerInch ?? 5,
      gaugeRowsPerInch: options.rowsPerInch ?? 7,
      availableNeedles: 200,
    },
  };
}

function sectionText(rows: ReadonlyArray<{ kind: string; title?: string; paragraphs?: string[] }>, title: string): string {
  const parts: string[] = [];
  let on = false;
  for (const row of rows) {
    if (row.kind === "section" && row.title === title) {
      on = true;
      continue;
    }
    if (on && row.kind === "section") break;
    if (on && row.kind === "block") parts.push(...(row.paragraphs ?? []));
  }
  return parts.join("\n");
}

function rcNumbers(line: string): number[] {
  return [...line.matchAll(/RC:\s*(\d+)/g)].map((match) => Number(match[1]));
}

const cases: Array<{
  label: string;
  options: Parameters<typeof pattern>[0];
  timing?: "before-armhole" | "with-armhole" | "during-armhole" | "after-armhole";
}> = [
  { label: "misses pullover round during", options: { neckline: "round" }, timing: "during-armhole" },
  { label: "misses pullover v during", options: { neckline: "v-neck" }, timing: "during-armhole" },
  { label: "misses cardigan round during", options: { garmentStyle: "cardigan", neckline: "round" }, timing: "during-armhole" },
  { label: "misses cardigan v during", options: { garmentStyle: "cardigan", neckline: "v-neck" }, timing: "during-armhole" },
  {
    label: "misses round before armhole",
    options: { frontNeckDepth: 8.5, armholeDepth: 7 },
    timing: "before-armhole",
  },
  {
    label: "misses round with armhole",
    options: { frontNeckDepth: 48 / 7, armholeDepth: 7, rowsPerInch: 7 },
    timing: "with-armhole",
  },
  {
    label: "misses round after armhole",
    options: { frontNeckDepth: 2, armholeDepth: 8 },
    timing: "after-armhole",
  },
  {
    label: "misses v before armhole",
    options: { neckline: "v-neck", frontNeckDepth: 9, armholeDepth: 7 },
    timing: "before-armhole",
  },
  {
    label: "misses v with armhole",
    options: { neckline: "v-neck", frontNeckDepth: 7.75 },
    timing: "with-armhole",
  },
  {
    label: "misses v after armhole",
    options: { neckline: "v-neck", frontNeckDepth: 2, armholeDepth: 8 },
    timing: "after-armhole",
  },
  {
    label: "misses cardigan round before armhole",
    options: { garmentStyle: "cardigan", neckline: "round", frontNeckDepth: 8.5 },
    timing: "before-armhole",
  },
  {
    label: "misses cardigan round with armhole",
    options: { garmentStyle: "cardigan", frontNeckDepth: 48 / 7, armholeDepth: 7, rowsPerInch: 7 },
    timing: "with-armhole",
  },
  {
    label: "misses cardigan v with armhole",
    options: { garmentStyle: "cardigan", neckline: "v-neck", frontNeckDepth: 7.75 },
    timing: "with-armhole",
  },
  {
    label: "men pullover round",
    options: { row: MEN_MED, audience: "men", stitchesPerInch: 4, rowsPerInch: 6, neckline: "round" },
  },
  {
    label: "men cardigan v",
    options: {
      row: MEN_MED,
      audience: "men",
      stitchesPerInch: 4,
      rowsPerInch: 6,
      garmentStyle: "cardigan",
      neckline: "v-neck",
    },
  },
  {
    label: "plus pullover round",
    options: { row: PLUS_1X, audience: "plus", stitchesPerInch: 6, rowsPerInch: 8, neckline: "round" },
  },
];

describe("set-in coordinated armhole, neckline, and shoulder timeline", () => {
  it.each(cases)("$label uses one schedule and stays inside the armhole", ({ options, timing: expectedTiming }) => {
    const result = generateSetInSleevePattern(pattern(options));
    const plan = result.setInArmholePlan;
    expect(plan?.ok).toBe(true);
    if (!plan) return;
    const armholeEnd = (result.debug.armholeStartRow ?? 0) + plan.totalRows;
    const back = result.backNeckShoulderTimeline ?? [];
    const front = result.frontNeckShoulderTimeline ?? [];
    expect(back.length).toBeGreaterThan(0);
    expect(front.length).toBeGreaterThan(0);

    const backShoulder = collectCompleteShoulderShapingPoints(back, "right", result.neckShoulderShapingChart, {
      shoulderStitchesBudget: result.debug.shoulderStitches,
    });
    const frontShoulder = collectCompleteShoulderShapingPoints(front, "right", result.frontNeckShoulderShapingChart, {
      shoulderStitchesBudget: result.debug.shoulderStitches,
    });
    for (const point of [...backShoulder, ...frontShoulder]) {
      expect(point.row).toBeLessThanOrEqual(armholeEnd);
    }
    expect(back.at(-1)?.row).toBe(front.at(-1)?.row);
    expect(back.at(-1)?.row).toBeLessThanOrEqual(armholeEnd);

    const backNotation = shoulderShapingNotationLinesFromTimeline(back, "right", result.neckShoulderShapingChart, {
      shoulderStitchesBudget: result.debug.shoulderStitches,
    });
    const frontNotation = shoulderShapingNotationLinesFromTimeline(front, "right", result.frontNeckShoulderShapingChart, {
      shoulderStitchesBudget: result.debug.shoulderStitches,
    });
    expect(frontNotation).toEqual(backNotation);

    const overlap = result.debug.frontArmholeNecklineOverlap;
    const timing = resolveFrontVNeckShapingTimingCase(overlap);
    if (expectedTiming) expect(timing).toBe(expectedTiming);
    const frontArmhole = sectionText(result.frontDisplayRows, "ARMHOLE");
    const backArmhole = sectionText(result.displayRows, "ARMHOLE");
    const shapingEnd = plan.matchedBindOffRows + plan.decreaseRows;
    const backNeckLocal = result.debug.backNecklineStartLocalRC ?? 0;
    if (backNeckLocal > shapingEnd) {
      expect(backArmhole).toMatch(/Knit \d+ rows even/);
    }

    const chart = result.frontNeckShoulderShapingChart;
    expect(chart?.finishShoulderInsideRowBudget).toBe(true);
    const checklist = chart
      ? buildActiveSideInstructionTableRows(chart, 0, { includeCenterNecklineSetupRow: true })
      : [];
    if (expectedTiming === "before-armhole" && options.garmentStyle === "cardigan") {
      const armholeStart = result.debug.armholeStartRow;
      expect(
        checklist.some(
          (row) => row.rc === armholeStart && row.edge === "Armhole" && /Bind off/.test(row.action),
        ),
      ).toBe(true);
      expect(checklist.some((row) => /Scrap off center|to divide/.test(row.action))).toBe(false);
    }
    if (expectedTiming === "with-armhole" && (options.neckline ?? "round") === "round" && (options.garmentStyle ?? "pullover") === "pullover") {
      expect(
        checklist.some((row) => row.rc === 0 && row.edge === "Armhole" && /Bind off OR hold \d+/.test(row.action)),
      ).toBe(true);
    }
    const checklistArmholeRcs = checklist.filter((row) => row.edge === "Armhole").map((row) => row.rc);
    if (timing === "after-armhole") {
      expect(overlap ?? null).toBeNull();
      expect(frontArmhole).toMatch(/Armhole decreases are complete/);
      expect(frontArmhole).not.toMatch(/Follow the/);
    } else {
      expect(overlap).toBeTruthy();
      expect(frontArmhole).toMatch(/Follow the/);
      expect(frontArmhole).not.toMatch(/Armhole decreases are complete/);
      const proseRcs = rcNumbers(
        frontArmhole
          .split("\n")
          .filter((line) => !/reset row counter/i.test(line))
          .join("\n"),
      );
      for (const rc of checklistArmholeRcs) {
        expect(proseRcs).not.toContain(rc);
      }
    }

    for (const timeline of [back, front]) {
      for (let index = 1; index < timeline.length; index += 1) {
        const prev = timeline[index - 1]!;
        const row = timeline[index]!;
        expect(row.stitchesL).toBe(Math.max(0, prev.stitchesL + row.netChangeL));
        expect(row.stitchesR).toBe(Math.max(0, prev.stitchesR + row.netChangeR));
      }
      for (const row of timeline) {
        let left = 0;
        let right = 0;
        for (const event of row.events) {
          if (event.side === "left") left += event.amount;
          else if (event.side === "right") right += event.amount;
        }
        expect(row.netChangeL + left).toBe(0);
        expect(row.netChangeR + right).toBe(0);
        expect(row.stitchesL).toBeGreaterThanOrEqual(0);
        expect(row.stitchesR).toBeGreaterThanOrEqual(0);
      }
    }
    const seen = new Set<string>();
    for (const row of front) {
      for (const event of row.events) {
        const key = `${row.row}:${event.side}:${event.edge}:${event.kind}:${event.amount}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it("links Free Pass on the second shoulder without adding a knitted row", () => {
    const result = generateSetInSleevePattern(pattern({}));
    const chart = result.neckShoulderShapingChart!;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, result.debug.armholeStartRow, {
      includeCenterNecklineSetupRow: true,
    });
    const html = renderNeckShoulderShapingChartTableOnlyHtml(chart, "ns-shaping-chart-back", "", {
      activeSideOnly: true,
      activeSideRcStart: rcStart,
      includeCenterNecklineSetupRow: true,
      hideCenterNecklineSetupRow: true,
      tableHeading: "First Shoulder Checklist",
      resetRowCounterForSecondShoulder: true,
      finishHeldNecklineAfterSecondShoulder: true,
    });
    expect(html).toContain(`data-glossary-id="${FREE_PASS_GLOSSARY_ID}"`);
    expect(html).toContain("Free Pass");
    expect(html).toContain("This does not add a knitted row.");
    expect(html).toContain("before beginning the Second Shoulder.");
  });

  it("leaves sleeveless and drop shoulder on their existing schedules", () => {
    const data = pattern({});
    const style = { ...(data.style as Record<string, unknown>) };
    delete style.construction;
    delete style.constructionAuthored;
    delete style.sleeveDirection;
    const sleeveless = generateSleevelessBackPattern({ ...data, style });
    expect(sleeveless.setInArmholePlan).toBeUndefined();
    expect(sleeveless.debug.frontArmholeNecklineOverlap).toBeUndefined();
    expect(sleeveless.neckShoulderShapingChart?.finishShoulderInsideRowBudget).toBeUndefined();
    const drop = generateDropShoulderPattern({
      ...data,
      style: withDropShoulderConstructionAuthored(
        { neckline: "round", garmentStyle: "pullover", bodyShape: "straight" },
        "long",
      ),
    });
    expect(drop.warnings.join("\n")).not.toMatch(/set-in armhole/i);
  });
});
