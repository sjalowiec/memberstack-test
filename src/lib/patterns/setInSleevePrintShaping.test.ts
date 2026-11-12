import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL } from "./neckShoulderShapingChart";
import type { ActiveSideInstructionTableRow } from "./neckShoulderActiveSideChecklist";
import { renderPatternDisplayRowsHtml } from "./sleevelessPatternDisplayHtml";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { formatRcColon } from "./sleevelessPatternOutput";
import { withSetInSleeveConstructionAuthored } from "./setInSleeveConstructionIdentity";
import { generateSetInSleevePattern, SET_IN_LEFT_FRONT_REVERSE_TITLE, SET_IN_RIGHT_BACK_REVERSE_TITLE } from "./setInSleevePatternOutput";
import {
  SET_IN_HELD_NECKLINE_FINISH_SENTENCE,
  SET_IN_NECKLINE_TECHNIQUE_NOTE,
  SET_IN_PRINT_CARRIAGE_DEFINITION,
  SET_IN_PRINT_INTERVENING_ROWS,
  condenseChecklistRows,
  setInBackPrintShapingOptions,
  setInFrontPrintShapingOptions,
  setInNecklinePrintShaping,
} from "./setInSleevePrintShaping";

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

function pattern(options?: {
  bodyShape?: "straight" | "aline";
  neckline?: "round" | "v-neck";
  stitchesPerInch?: number;
  rowsPerInch?: number;
  availableNeedles?: number;
  centerSeams?: boolean;
}): Record<string, unknown> {
  const measurements = computeDefaultMeasurementsFromChartRow(MISSES_7, "standard", {
    bodyShape: options?.bodyShape ?? "straight",
  });
  return {
    fit: {
      sizingChart: "misses",
      easeChoice: "standard",
      selectedMeasurements: measurements,
      ...(options?.bodyShape === "aline"
        ? {
            cbMeasurementOverrides: {
              chestBust: "34.5",
              hip: "50",
              upperArm: "11.75",
              wrist: "9",
              sleeveLength: "16.25",
            },
            dropShoulderUserEditedSleeveFields: { upperArm: true, wrist: true, sleeveLength: true },
          }
        : {}),
    },
    style: withSetInSleeveConstructionAuthored(
      {
        recipientCategory: "misses",
        garmentStyle: "pullover",
        neckline: options?.neckline ?? "round",
        bodyShape: options?.bodyShape ?? "straight",
        ...(options?.centerSeams ? { centerSeams: true } : {}),
      },
      "long",
    ),
    yarnGaugeMachine: {
      gaugeStitchesPerInch: options?.stitchesPerInch ?? 5,
      gaugeRowsPerInch: options?.rowsPerInch ?? 7,
      availableNeedles: options?.availableNeedles ?? 200,
    },
  };
}

function printParagraphs(rows: readonly { kind: string; printInstructionParagraphs?: string[] }[]): string[] {
  return rows.flatMap((row) => (row.kind === "block" ? row.printInstructionParagraphs ?? [] : []));
}

function visibleText(rows: readonly { kind: string; paragraphs?: string[]; trustedParagraphs?: string[]; title?: string }[]): string {
  return rows
    .map((row) =>
      row.kind === "block"
        ? [...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? [])].join(" ")
        : row.title ?? "",
    )
    .join("\n");
}

function rowRcs(row: ActiveSideInstructionTableRow): number[] {
  const end = row.rcEnd !== undefined && row.rcEnd > row.rc ? row.rcEnd : row.rc;
  const rcs: number[] = [];
  for (let rc = row.rc; rc <= end; rc += 1) rcs.push(rc);
  return rcs;
}

function assertAccountsForEveryRow(rows: readonly ActiveSideInstructionTableRow[]): void {
  const condensed = condenseChecklistRows(rows);
  const shaping = rows
    .filter((row) => row.action !== NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL)
    .flatMap(rowRcs)
    .sort((a, b) => a - b);
  const knit = rows
    .filter((row) => row.action === NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL)
    .flatMap(rowRcs)
    .sort((a, b) => a - b);
  expect([...condensed.shapingRcs].sort((a, b) => a - b)).toEqual(shaping);
  const knitAccounted = [...condensed.interveningKnitRcs, ...condensed.plainKnitRcs].sort((a, b) => a - b);
  expect(knitAccounted).toEqual(knit);
  expect(new Set(condensed.shapingRcs).size).toBe(condensed.shapingRcs.length);
  expect(new Set(knitAccounted).size).toBe(knitAccounted.length);
  const covered = new Set<number>();
  for (const group of condensed.groups) {
    expect(condensed.lines).toContain(group.line);
    expect(group.line).toContain(group.carriage);
    expect(group.line).toContain(formatRcColon(group.rcs[0]!));
    if (group.times > 1) expect(group.line).toContain(`${group.times} times`);
    for (const rc of group.rcs) {
      expect(covered.has(rc)).toBe(false);
      covered.add(rc);
    }
  }
}

describe("set-in instructions-only neckline shaping", () => {
  it("replaces the checklist pointer with the calculated back and front steps", () => {
    const result = generateSetInSleevePattern(pattern());
    const back = printParagraphs(result.displayRows);
    const front = printParagraphs(result.frontDisplayRows);
    expect(visibleText(result.displayRows)).toMatch(/Use the checklist below/i);
    expect(visibleText(result.frontDisplayRows)).toMatch(/Use the checklist below/i);
    expect(back.join("\n")).not.toMatch(/checklist/i);
    expect(front.join("\n")).not.toMatch(/checklist/i);
    expect(back).toContain("First shoulder.");
    expect(back).toContain("Second shoulder.");
    expect(back.some((line) => /return the \d+ held stitches/i.test(line))).toBe(true);
    expect(back.some((line) => /Set the row counter to RC: \d{3}/.test(line))).toBe(true);
    expect(back.some((line) => /Free Pass the carriage/i.test(line))).toBe(true);
    if (result.debug.backNeckRoundNecklineStrategy === "shallow-round") {
      expect(back).toContain(SET_IN_HELD_NECKLINE_FINISH_SENTENCE);
    }
    expect(front.some((line) => /Second shoulder\.|Second side\./.test(line))).toBe(true);
    expect(back.filter((line) => line === SET_IN_PRINT_CARRIAGE_DEFINITION)).toHaveLength(1);
    expect(front.filter((line) => line === SET_IN_PRINT_CARRIAGE_DEFINITION)).toHaveLength(1);
    expect(back.join("\n")).toMatch(/COR|COL/);
    expect(front.join("\n")).toMatch(/\bCOR\b/);
    expect(front.join("\n")).toContain(SET_IN_PRINT_INTERVENING_ROWS);
    expect(back.join("\n")).toContain(
      "with the carriage on the left (COL), bind off or hold 4 stitches at the shoulder edge every other row 4 times",
    );
    expect(back.join("\n")).toContain("hold 3 stitches at the neck edge every other row 2 times");
    expect(back.join("\n")).toContain(
      "At the same time, at RC: 053, with the carriage on the left (COL), hold 4 stitches at the neck edge.",
    );
    expect(back.join("\n")).toContain("Leave those stitches on the machine.");
    expect(back.join("\n")).toContain(SET_IN_NECKLINE_TECHNIQUE_NOTE);
    expect(back.join("\n")).toContain("Swap Left and Right.");
    expect(back.join("\n")).not.toContain("hold 3 stitches at the neck edge every other row 3 times");
    expect(front.join("\n")).toContain("decrease 1 stitch at the neck edge every other row 6 times");
    expect(front.join("\n")).toContain("This is a decrease: move 1 stitch in. Do not bind it off.");
    expect(front.join("\n")).toContain("Knit in pattern to RC: 047.");
    expect(front.join("\n")).toContain(
      "At the same time, beginning at RC: 019, with the carriage on the left (COL), bind off 3 stitches at the neck edge every other row 2 times.",
    );
    const backShaping = setInNecklinePrintShaping(
      result.neckShoulderShapingChart,
      result.debug.armholeStartRow,
      setInBackPrintShapingOptions({
        centerSeamHalf: false,
        shallowRound: result.debug.backNeckRoundNecklineStrategy === "shallow-round",
      }),
    );
    const frontShaping = setInNecklinePrintShaping(
      result.frontNeckShoulderShapingChart,
      result.debug.armholeStartRow,
      setInFrontPrintShapingOptions({
        splitFront: false,
        roundNeck: true,
        centerBindOff: Number(result.debug.frontCenterNeckBindOffStitches) || 0,
      }),
    );
    expect(back).toEqual(backShaping.paragraphs);
    expect(front).toEqual(frontShaping.paragraphs);
    assertAccountsForEveryRow(backShaping.firstRows);
    assertAccountsForEveryRow(backShaping.secondRows);
    assertAccountsForEveryRow(frontShaping.firstRows);
    assertAccountsForEveryRow(frontShaping.secondRows);
    expect(condenseChecklistRows(frontShaping.firstRows).lines.length).toBeLessThan(frontShaping.firstRows.length);
    expect(backShaping.firstRows.some((row) => row.action !== NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL)).toBe(true);
    expect(frontShaping.firstRows.some((row) => row.action !== NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL)).toBe(true);

    const backHtml = renderPatternDisplayRowsHtml(result.displayRows, { pieceSectionId: "back" });
    const frontHtml = renderPatternDisplayRowsHtml(result.frontDisplayRows, { pieceSectionId: "front" });
    expect(backHtml).toContain("pattern-print-written-shaping");
    expect(backHtml).toContain("pattern-print-checklist-pointer");
    expect(backHtml).not.toContain('pattern-print-written-shaping" hidden');
    expect(frontHtml).toContain("pattern-print-written-shaping");
    expect(frontHtml).toContain("pattern-print-checklist-pointer");
  });

  it("writes a center-seam back and a V-neck front without a missing checklist", () => {
    const result = generateSetInSleevePattern(
      pattern({
        bodyShape: "aline",
        neckline: "v-neck",
        stitchesPerInch: 7,
        rowsPerInch: 11,
        availableNeedles: 150,
        centerSeams: true,
      }),
    );
    expect(result.centerSeams?.applied).toBe(true);
    const backText = visibleText(result.displayRows);
    const frontText = visibleText(result.frontDisplayRows);
    expect(backText).toContain("LEFT BACK");
    expect(backText).toContain(SET_IN_RIGHT_BACK_REVERSE_TITLE);
    expect(backText).toMatch(/carriage on the opposite side/);
    expect(frontText).toContain("RIGHT FRONT");
    expect(frontText).toContain(SET_IN_LEFT_FRONT_REVERSE_TITLE);
    expect(frontText).toMatch(/carriage on the opposite side/);
    expect(frontText).toMatch(/Decrease 1 stitch at the center edge on row /);

    const back = printParagraphs(result.displayRows);
    const front = printParagraphs(result.frontDisplayRows);
    expect(back.length).toBeGreaterThan(0);
    expect(front.length).toBeGreaterThan(0);
    expect(back.join("\n")).not.toMatch(/checklist/i);
    expect(front.join("\n")).not.toMatch(/checklist/i);
    expect(back).not.toContain("Second shoulder.");
    expect(front).not.toContain("Second shoulder.");
    expect(back.filter((line) => line === SET_IN_PRINT_CARRIAGE_DEFINITION)).toHaveLength(1);
    expect(front.filter((line) => line === SET_IN_PRINT_CARRIAGE_DEFINITION)).toHaveLength(1);
    expect(back.join("\n")).toMatch(/\bCOR\b/);
    expect(front.join("\n")).toMatch(/\bCOL\b/);
    expect(front.join("\n")).toContain("decrease 1 stitch at the neck edge every 4 rows 5 times");
    expect(back.join("\n")).toContain("hold 14 stitches at the neck edge");
    expect(back.join("\n")).toContain("hold 2 stitches at the neck edge every other row 5 times");
    expect(back.join("\n")).toContain("bind off 3 stitches at the neck edge");
    expect(back.join("\n")).not.toContain("decrease 2 stitches");
    expect(back.join("\n")).toContain(SET_IN_HELD_NECKLINE_FINISH_SENTENCE);
    expect(back.join("\n")).toContain("If you held the shoulder stitches, bind off those held shoulder stitches.");
    const backShaping = setInNecklinePrintShaping(
      result.neckShoulderShapingChart,
      result.debug.armholeStartRow,
      setInBackPrintShapingOptions({
        centerSeamHalf: true,
        shallowRound: false,
        invertCarriageParity: true,
      }),
    );
    const frontShaping = setInNecklinePrintShaping(
      result.frontNeckShoulderShapingChart,
      result.debug.armholeStartRow,
      setInFrontPrintShapingOptions({ splitFront: true, roundNeck: false, centerBindOff: 0 }),
    );
    expect(back).toEqual(backShaping.paragraphs);
    expect(front).toEqual(frontShaping.paragraphs);
    assertAccountsForEveryRow(backShaping.firstRows);
    assertAccountsForEveryRow(frontShaping.firstRows);
    expect(backShaping.secondRows).toEqual([]);
    expect(frontShaping.secondRows).toEqual([]);

    const frontHtml = renderPatternDisplayRowsHtml(result.frontDisplayRows, { pieceSectionId: "front" });
    expect(frontHtml).toContain("pattern-print-summary-line");
    expect(frontHtml).toContain("pattern-print-written-shaping");
  });

  it("keeps both diagram types and hides the checklist in instructions only", () => {
    const page = readFileSync("src/pages/patterns/set-in-sleeve/pattern/index.astro", "utf8");
    const choiceCss = readFileSync("src/styles/patterns/pattern-print-choice.css", "utf8");
    expect(page).toContain(
      'html[data-pattern-print-choice="instructions"] .set-in-sleeve-pattern-page .pattern-print-written-shaping',
    );
    expect(page).toContain("pattern-print-checklist-pointer");
    expect(page).toContain(
      'html[data-pattern-print-choice="instructions"] .set-in-sleeve-pattern-page #pattern-content .sleeveless-pattern-reading-layout .sleeveless-pattern-diagram-tabs__panel[data-pattern-diagram-panel="shaping-notation"]',
    );
    expect(choiceCss).toContain('html[data-pattern-print-choice="instructions"] #pattern-content .ns-shaping-chart');
    expect(choiceCss).toContain(".pattern-print-written-shaping");
  });
});
