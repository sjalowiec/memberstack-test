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

function sliceFor(paragraphs: readonly string[], side: "first" | "second"): string[] {
  const secondAt = paragraphs.findIndex((line) => line === "Second shoulder." || line === "Second side.");
  if (side === "first") return secondAt < 0 ? [...paragraphs] : paragraphs.slice(0, secondAt);
  return secondAt < 0 ? [] : paragraphs.slice(secondAt + 1);
}

function assertChecklistRows(paragraphs: readonly string[], rows: readonly ActiveSideInstructionTableRow[]): void {
  for (const row of rows) {
    const rc = formatRcColon(row.rc);
    const sentence = paragraphs.find((line) => line.includes(rc));
    expect(sentence, rc).toBeTruthy();
    const line = sentence ?? "";
    if (row.rcEnd !== undefined && row.rcEnd !== row.rc) {
      expect(line).toContain(String(row.rcEnd).padStart(3, "0"));
    }
    if (/^right$/i.test(row.carriagePosition)) expect(line).toMatch(/carriage on the right/i);
    if (/^left$/i.test(row.carriagePosition)) expect(line).toMatch(/carriage on the left/i);
    if (/alternating/i.test(row.carriagePosition)) expect(line).toMatch(/alternating/i);
    expect(line.toLowerCase()).toContain(row.action.trim().replace(/\.$/, "").toLowerCase());
    const display = row.stitchesRemainingDisplay?.trim();
    if (display) expect(line).toContain(display.replace(/\.$/, ""));
    else expect(line).toContain(String(Math.max(0, Math.floor(row.stitchesRemaining))));
    if (row.passNote) expect(line).toContain(row.passNote.trim());
    if (row.action !== NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL) {
      expect(line).toMatch(/hold|bind off|decrease|scrap|return|knit/i);
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
    expect(front.join("\n")).toMatch(/carriage on the (left|right)/);
    expect(back.join("\n")).toMatch(/Bind off|Hold|Decrease|Scrap off/);
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
    assertChecklistRows(sliceFor(back, "first"), backShaping.firstRows);
    assertChecklistRows(sliceFor(back, "second"), backShaping.secondRows);
    assertChecklistRows(sliceFor(front, "first"), frontShaping.firstRows);
    assertChecklistRows(sliceFor(front, "second"), frontShaping.secondRows);
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
    expect(back.join("\n")).toMatch(/carriage on the (left|right)/);
    expect(front.join("\n")).toMatch(/carriage on the (left|right)/);
    expect(front.join("\n")).toMatch(/Bind off|Hold|Decrease/);
    expect(back.join("\n")).not.toContain(SET_IN_HELD_NECKLINE_FINISH_SENTENCE);
    const backShaping = setInNecklinePrintShaping(
      result.neckShoulderShapingChart,
      result.debug.armholeStartRow,
      setInBackPrintShapingOptions({ centerSeamHalf: true, shallowRound: false }),
    );
    const frontShaping = setInNecklinePrintShaping(
      result.frontNeckShoulderShapingChart,
      result.debug.armholeStartRow,
      setInFrontPrintShapingOptions({ splitFront: true, roundNeck: false, centerBindOff: 0 }),
    );
    expect(back).toEqual(backShaping.paragraphs);
    expect(front).toEqual(frontShaping.paragraphs);
    assertChecklistRows(back, backShaping.firstRows);
    assertChecklistRows(front, frontShaping.firstRows);
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
