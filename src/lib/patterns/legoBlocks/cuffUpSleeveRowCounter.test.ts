import { describe, expect, it } from "vitest";
import { buildDropShoulderSleeveDisplayRows } from "../dropShoulderPatternOutput";
import {
  buildDropShoulderSleeveShapingChartRows,
  dropShoulderSleevePreShapingSpan,
  dropShoulderSleeveShapingRcSequence,
} from "../dropShoulderSleeveShapingChart";
import { renderSleevelessPrintPieceHtml } from "../sleevelessPatternPrintRender";
import type { SleevelessPatternDisplayRow } from "../sleevelessPatternOutput";
import {
  buildSidewaysCardiganSleeveInstructions,
  renderSidewaysCardiganSleeveSequenceHtml,
} from "../sidewaysCardiganSleeveInstructions";
import type { SidewaysCardiganSleeveCalcInput } from "../sidewaysCardiganSleeveCalc";
import {
  CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET,
  cuffUpSleeveBodyRowCounter,
} from "./cuffUpSleeveRowCounter";

const SHARED_SLEEVE = {
  topSts: 42,
  wristSts: 36,
  sleeveBodyRows: 72,
  direction: "cuff-up" as const,
};

const TOP_DOWN_SAMPLE = {
  topSts: 80,
  wristSts: 40,
  cuffRows: 20,
  sleeveBodyRows: 100,
  sleeveTotalRows: 120,
  direction: "top-down" as const,
};

function sleeveBodyRcValues(rows: readonly SleevelessPatternDisplayRow[]): number[] {
  const start = rows.findIndex((row) => row.kind === "section" && row.title === "SLEEVE BODY");
  const values: number[] = [];
  for (let i = start + 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.kind === "section") break;
    if (row.kind === "block" && row.rc) {
      values.push(Number(row.rc.replace(/\D/g, "")));
    }
  }
  return values;
}

function sectionIndex(rows: readonly SleevelessPatternDisplayRow[], title: string): number {
  return rows.findIndex((row) => row.kind === "section" && row.title === title);
}

function resetIndex(rows: readonly SleevelessPatternDisplayRow[]): number {
  return rows.findIndex(
    (row) =>
      row.kind === "block" &&
      (row.paragraphs ?? []).includes(CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET),
  );
}

function shapingRcList(rows: readonly SleevelessPatternDisplayRow[]): number[] {
  const line = rows
    .filter((row) => row.kind === "block")
    .flatMap((row) => (row.kind === "block" ? [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])] : []))
    .find((paragraph) => /<em>\(RC:/.test(paragraph));
  const match = line?.match(/<em>\(RC: ([^)]+)\)<\/em>/);
  if (!match) return [];
  return match[1]!.split(", ").map((n) => parseInt(n.trim(), 10));
}

describe("cuff-up sleeve body row counter", () => {
  it("counts sleeve-body rows from zero after the cuff", () => {
    expect(cuffUpSleeveBodyRowCounter(12)).toBe(12);
    expect(CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET).toBe("Reset row counter to RC 000.");
  });

  it("keeps Sideways cuff-up sleeve-body milestones independent of the cuff treatment", () => {
    const base: SidewaysCardiganSleeveCalcInput = {
      direction: "cuff-up",
      finishedUpperArmInches: 14,
      finishedWristInches: 7,
      sleeveLengthInches: 17,
      stitchesPerInch: 5,
      rowsPerInch: 7,
      cuffDepthInches: 2,
      armholeDepthInches: 7,
    };
    const built = buildSidewaysCardiganSleeveInstructions(base);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const { calc } = built.instructions;
    expect(built.instructions.steps.find((step) => step.id === "sleeve-body")?.rowCounterStart).toBe(0);

    const html = renderSidewaysCardiganSleeveSequenceHtml(built.instructions);
    const resetAt = html.indexOf(CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET);
    const bodyAt = html.indexOf("SLEEVE BODY");
    expect(resetAt).toBeGreaterThan(html.indexOf("Choose one way to begin"));
    expect(resetAt).toBeGreaterThan(html.indexOf(`${calc.cuffRows} rows of ribbing`));
    expect(resetAt).toBeGreaterThan(html.indexOf(`${calc.cuffRows * 2} rows so the hem can be folded`));
    expect(resetAt).toBeGreaterThan(html.indexOf("Hand knit ribbing"));
    expect(bodyAt).toBeGreaterThan(resetAt);

    const rows = buildDropShoulderSleeveDisplayRows({
      topSts: calc.topSts,
      wristSts: calc.wristSts,
      cuffRows: calc.cuffRows,
      sleeveBodyRows: calc.sleeveBodyRows,
      sleeveTotalRows: calc.sleeveTotalRows,
      direction: "cuff-up",
      valid: true,
      optionalRibbing: true,
    });
    const chartInput = {
      topSts: calc.topSts,
      wristSts: calc.wristSts,
      cuffRows: calc.cuffRows,
      sleeveBodyRows: calc.sleeveBodyRows,
      sleeveTotalRows: calc.sleeveTotalRows,
      direction: "cuff-up" as const,
    };
    const sameBodyDifferentCuff = {
      ...chartInput,
      cuffRows: calc.cuffRows + 8,
      sleeveTotalRows: calc.sleeveTotalRows + 8,
    };
    expect(shapingRcList(rows)).toEqual(dropShoulderSleeveShapingRcSequence(chartInput));
    expect(dropShoulderSleeveShapingRcSequence(sameBodyDifferentCuff)).toEqual(
      dropShoulderSleeveShapingRcSequence(chartInput),
    );
    expect(shapingRcList(rows)[0]).toBe(dropShoulderSleevePreShapingSpan(chartInput).straightRows);
    expect(shapingRcList(rows)[0]).not.toBe(calc.cuffRows + dropShoulderSleevePreShapingSpan(chartInput).straightRows);

    const topDown = buildSidewaysCardiganSleeveInstructions({ ...base, direction: "top-down" });
    expect(topDown.ok).toBe(true);
    if (!topDown.ok) return;
    expect(renderSidewaysCardiganSleeveSequenceHtml(topDown.instructions)).not.toContain(
      CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET,
    );
    expect(topDown.instructions.steps.find((step) => step.id === "sleeve-body")?.rowCounterStart).toBe(0);
  });

  it("resets Drop Shoulder cuff-up after every cuff option and leaves top-down counters unchanged", () => {
    const milestones = [12, 40].map((cuffRows) => {
      const rows = buildDropShoulderSleeveDisplayRows({
        ...SHARED_SLEEVE,
        cuffRows,
        sleeveTotalRows: cuffRows + SHARED_SLEEVE.sleeveBodyRows,
        valid: true,
      });
      const choiceRows = buildDropShoulderSleeveDisplayRows({
        ...SHARED_SLEEVE,
        cuffRows,
        sleeveTotalRows: cuffRows + SHARED_SLEEVE.sleeveBodyRows,
        valid: true,
        optionalRibbing: true,
      });
      return { cuffRows, rows, choiceRows };
    });

    const [narrow, wide] = milestones;
    expect(narrow && wide).toBeTruthy();
    if (!narrow || !wide) return;
    expect(sleeveBodyRcValues(narrow.rows)).toEqual(sleeveBodyRcValues(wide.rows));
    expect(sleeveBodyRcValues(narrow.rows)[0]).toBe(0);
    expect(shapingRcList(narrow.rows)).toEqual([24, 48, 72]);
    expect(shapingRcList(narrow.rows)).toEqual(shapingRcList(wide.rows));
    expect(shapingRcList(narrow.choiceRows)).toEqual(shapingRcList(narrow.rows));

    for (const sample of [narrow, wide]) {
      for (const rows of [sample.rows, sample.choiceRows]) {
        const cuffAt = sectionIndex(rows, "CUFF");
        const resetAt = resetIndex(rows);
        const bodyAt = sectionIndex(rows, "SLEEVE BODY");
        expect(cuffAt).toBeGreaterThanOrEqual(0);
        expect(resetAt).toBeGreaterThan(cuffAt);
        expect(bodyAt).toBeGreaterThan(resetAt);
        expect(renderSleevelessPrintPieceHtml(rows, "", "sleeve")).toContain(
          CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET,
        );
      }
      const plainText = sample.rows
        .filter((row) => row.kind === "block")
        .flatMap((row) => (row.kind === "block" ? row.paragraphs : []))
        .join("\n");
      expect(plainText.indexOf(`Knit ${sample.cuffRows} rows even.`)).toBeLessThan(
        plainText.indexOf(CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET),
      );
      const choiceText = sample.choiceRows
        .filter((row) => row.kind === "block")
        .flatMap((row) => (row.kind === "block" ? (row.trustedParagraphs ?? []) : []))
        .join("\n");
      expect(choiceText.indexOf("Choose one way to begin")).toBeGreaterThanOrEqual(0);
      expect(choiceText).not.toContain(CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET);
    }

    const topDownRows = buildDropShoulderSleeveDisplayRows({ ...TOP_DOWN_SAMPLE, valid: true });
    const topDownText = topDownRows
      .filter((row) => row.kind === "block")
      .flatMap((row) => (row.kind === "block" ? [...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? [])] : []))
      .join("\n");
    expect(topDownText).not.toContain(CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET);
    expect(dropShoulderSleevePreShapingSpan(TOP_DOWN_SAMPLE)).toEqual({
      bodyStartRc: 0,
      firstShapingRc: 20,
      straightRows: 20,
    });
    expect(dropShoulderSleeveShapingRcSequence(TOP_DOWN_SAMPLE)[0]).toBe(20);
    expect(dropShoulderSleeveShapingRcSequence(TOP_DOWN_SAMPLE).at(-1)).toBe(96);
    expect(buildDropShoulderSleeveShapingChartRows(TOP_DOWN_SAMPLE).at(-1)?.rc).toBe(120);
    const cuffBlock = topDownRows.find(
      (row, index) =>
        row.kind === "block" &&
        topDownRows.slice(0, index).some((earlier) => earlier.kind === "section" && earlier.title === "CUFF"),
    );
    expect(cuffBlock && cuffBlock.kind === "block" ? cuffBlock.rc : "").toBe("RC: 100");
  });
});
