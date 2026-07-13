import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";

const DROP_SHOULDER_PATTERN = {
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

function firstBlockAfterSection(
  rows: readonly SleevelessPatternDisplayRow[],
  sectionTitle: string,
): Extract<SleevelessPatternDisplayRow, { kind: "block" }> | undefined {
  const sectionIdx = rows.findIndex((r) => r.kind === "section" && r.title === sectionTitle);
  if (sectionIdx < 0) return undefined;
  return rows
    .slice(sectionIdx + 1)
    .find((r): r is Extract<SleevelessPatternDisplayRow, { kind: "block" }> => r.kind === "block");
}

function castOnBlock(
  rows: readonly SleevelessPatternDisplayRow[],
): Extract<SleevelessPatternDisplayRow, { kind: "block" }> | undefined {
  return rows.find(
    (r): r is Extract<SleevelessPatternDisplayRow, { kind: "block" }> =>
      r.kind === "block" && r.paragraphs.some((p) => /^Cast on \d+ stitches/i.test(p)),
  );
}

function countPrintStitchLabels(html: string, stitchCount: number): number {
  const needle = `<div class="print-inst-sts">${stitchCount} sts</div>`;
  let count = 0;
  let pos = 0;
  while (true) {
    const idx = html.indexOf(needle, pos);
    if (idx < 0) break;
    count++;
    pos = idx + needle.length;
  }
  return count;
}

describe("pattern stitch count column", () => {
  it("shows the same stitch count on cast-on, hem, and body when unchanged (drop-shoulder print)", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const rows = result.displayRows;

    const castOn = castOnBlock(rows);
    const hem = firstBlockAfterSection(rows, "HEM");
    const body = firstBlockAfterSection(rows, "BODY");

    expect(castOn?.stitchCount).toBeGreaterThan(0);
    expect(hem?.stitchCount).toBe(castOn?.stitchCount);
    expect(body?.stitchCount).toBe(castOn?.stitchCount);

    const sts = castOn!.stitchCount!;
    const printHtml = renderSleevelessPrintPieceHtml(rows, "", "back");
    expect(countPrintStitchLabels(printHtml, sts)).toBeGreaterThanOrEqual(3);
  });

  it("shows the same stitch count on cast-on, hem, and body when unchanged (sleeveless print)", () => {
    const result = generateSleevelessBackPattern(DROP_SHOULDER_PATTERN);
    const rows = result.displayRows;

    const castOn = castOnBlock(rows);
    const hem = firstBlockAfterSection(rows, "HEM");
    const body = firstBlockAfterSection(rows, "BODY");

    expect(castOn?.stitchCount).toBeGreaterThan(0);
    expect(hem?.stitchCount).toBe(castOn?.stitchCount);
    expect(body?.stitchCount).toBe(castOn?.stitchCount);

    const sts = castOn!.stitchCount!;
    const printHtml = renderSleevelessPrintPieceHtml(rows, "", "back");
    expect(countPrintStitchLabels(printHtml, sts)).toBeGreaterThanOrEqual(3);
  });

  it("leaves the right column blank when stitchCount is undefined (tips)", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const marker = result.displayRows.find(
      (r) => r.kind === "block" && r.tipId === "sleeveless-piece-markers-back",
    );
    expect(marker?.stitchCount).toBeUndefined();

    const printHtml = renderSleevelessPrintPieceHtml(result.displayRows, "", "back");
    const markerTipIdx = printHtml.indexOf('data-tip-id="sleeveless-piece-markers-back"');
    expect(markerTipIdx).toBeGreaterThanOrEqual(0);
    const rowStart = printHtml.lastIndexOf('<div class="print-inst-row', markerTipIdx);
    const rowEnd = printHtml.indexOf("</div>", markerTipIdx);
    const markerRowHtml = printHtml.slice(rowStart, rowEnd);
    expect(markerRowHtml).not.toContain('class="print-inst-sts"');
    expect(markerRowHtml).toContain("print-inst-row--full");
  });

  it("shows final shoulder stitch count on all four shoulder completion blocks (pullover front and back)", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const shoulderSts = result.debug.shoulderStitches!;
    expect(shoulderSts).toBeGreaterThan(0);

    function shoulderCompletionBlocks(
      rows: readonly SleevelessPatternDisplayRow[],
      sectionTitle: string,
    ): Extract<SleevelessPatternDisplayRow, { kind: "block" }>[] {
      let inSection = false;
      const out: Extract<SleevelessPatternDisplayRow, { kind: "block" }>[] = [];
      for (const row of rows) {
        if (row.kind === "section" && row.title === sectionTitle) {
          inSection = true;
          continue;
        }
        if (inSection && row.kind === "section") break;
        if (!inSection || row.kind !== "block") continue;
        const text = [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])].join("\n");
        if (/The (first|second) shoulder is complete/i.test(text)) {
          out.push(row);
        }
      }
      return out;
    }

    const backCompletions = shoulderCompletionBlocks(
      result.displayRows,
      "BACK NECKLINE & SHOULDERS",
    );
    const frontCompletions = shoulderCompletionBlocks(
      result.frontDisplayRows,
      "FRONT NECKLINE & SHOULDERS",
    );

    expect(backCompletions).toHaveLength(2);
    expect(frontCompletions).toHaveLength(2);
    for (const block of [...backCompletions, ...frontCompletions]) {
      expect(block.stitchCount).toBe(shoulderSts);
    }

    const backPrint = renderSleevelessPrintPieceHtml(result.displayRows, "", "back");
    const frontPrint = renderSleevelessPrintPieceHtml(result.frontDisplayRows, "", "front");
    expect(countPrintStitchLabels(backPrint, shoulderSts)).toBe(2);
    expect(countPrintStitchLabels(frontPrint, shoulderSts)).toBe(2);
  });
});
