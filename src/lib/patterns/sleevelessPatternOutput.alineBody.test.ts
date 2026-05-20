import { describe, expect, it } from "vitest";
import {
  buildSleevelessBackDisplayRows,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import type { SleevelessAlineBodyShapingPlan } from "./sleevelessAlineShaping";
import { buildSleevelessBodyBlockPlan } from "./bodyBlock/sleevelessBodyBlock";
import { bodyBlockPlanToAlineShapingPlan } from "./sleevelessAlineShaping";

function bodyBlocks(rows: readonly SleevelessPatternDisplayRow[]) {
  let inBody = false;
  const blocks: SleevelessPatternDisplayRow[] = [];
  for (const row of rows) {
    if (row.kind === "section" && row.title === "BODY") {
      inBody = true;
      continue;
    }
    if (row.kind === "section") {
      inBody = false;
    }
    if (inBody && row.kind === "block") {
      blocks.push(row);
    }
  }
  return blocks;
}

function blockHasText(
  block: SleevelessPatternDisplayRow & { kind: "block" },
  re: RegExp,
): boolean {
  const paras = [...(block.paragraphs ?? []), ...(block.trustedParagraphs ?? [])];
  return paras.some((p) => re.test(p));
}

function countBodyParagraphMatches(
  blocks: readonly SleevelessPatternDisplayRow[],
  re: RegExp,
): number {
  let n = 0;
  for (const block of blocks) {
    if (block.kind !== "block") continue;
    for (const p of block.paragraphs ?? []) {
      if (re.test(p)) n++;
    }
    for (const p of block.trustedParagraphs ?? []) {
      if (re.test(p)) n++;
    }
    if (block.tipHtml && re.test(block.tipHtml)) n++;
  }
  return n;
}

describe("A-line BODY written instructions (single continuous span)", () => {
  const hemRows = 22;
  const bodyToArmholeRows = 73;
  const hemCastOnSts = 106;
  const bustBodySts = 128;

  const bodyPlan = buildSleevelessBodyBlockPlan({
    garmentStyle: "pullover",
    pieceRole: "back",
    bustCircumferenceInches: 64,
    hipCircumferenceInches: 53,
    stitchesPerInch: 4,
    rowsPerInch: 7,
    rowsToArmhole: bodyToArmholeRows,
    hemRows,
    mode: "auto",
    precomputedBustStitches: bustBodySts,
  });
  const aline: SleevelessAlineBodyShapingPlan = {
    ...bodyBlockPlanToAlineShapingPlan(bodyPlan, bodyToArmholeRows, hemRows),
    hemCastOnSts,
    bustBodySts,
  };

  it("hip narrower than bust: straight body, begin A-line, RC:095 armhole, 128 sts, Increase", () => {
    expect(bodyPlan.shapingDirection).toBe("increase");
    expect(aline.shapingType).toBe("increase-to-bust");
    expect(aline.bodyFirstHalf.rows + aline.bodySecondHalf.rows).toBe(bodyToArmholeRows);

    const rows = buildSleevelessBackDisplayRows({
      castOnSts: hemCastOnSts,
      armholeStartSts: bustBodySts,
      hemRows,
      hemRowsValid: true,
      bodyToArmholeRows,
      bodyRowsValid: true,
      armholeMath: null,
      firstArmholeRC: hemRows + bodyToArmholeRows,
      stitchesAfterArmhole: undefined,
      upperBackRows: 0,
      upperStartRc: 0,
      evenRowPadRows: 0,
      padStartRc: 0,
      neckChartRows: [],
      useNeckChartRows: false,
      alineBodyShaping: aline,
    });

    const blocks = bodyBlocks(rows);
    expect(countBodyParagraphMatches(blocks, /Knit 73 rows with A-line/i)).toBe(0);
    expect(countBodyParagraphMatches(blocks, /continuing side shaping/i)).toBe(0);
    expect(countBodyParagraphMatches(blocks, /Begin A-line shaping/i)).toBe(1);
    expect(countBodyParagraphMatches(blocks, /sts remain after shaping/i)).toBe(0);
    expect(countBodyParagraphMatches(blocks, /1 stitch at each side edge.*evenly across/i)).toBe(1);
    expect(countBodyParagraphMatches(blocks, /Decrease 1 stitch at each side edge/i)).toBe(0);
    expect(
      countBodyParagraphMatches(blocks, /glossary-tooltip-placeholder.*data-glossary-id="186"/),
    ).toBe(1);
    expect(
      countBodyParagraphMatches(blocks, /glossary-tooltip-placeholder.*data-glossary-id="178"/),
    ).toBe(0);

    const shapingBlock = blocks.find((b) => b.rc === "RC:022");
    expect(shapingBlock).toBeDefined();
    expect(shapingBlock && blockHasText(shapingBlock, /Begin A-line shaping/i)).toBe(true);
    expect(blocks.find((b) => b.rc === "RC:088")?.paragraphs?.some((p) => /Knit 7 rows straight/i.test(p))).toBe(
      true,
    );
    const armholeMarker = blocks.find((b) => b.rc === "RC:095");
    expect(armholeMarker).toBeDefined();
    expect(armholeMarker!.stitchCount).toBe(128);
    expect(armholeMarker!.paragraphs?.some((p) => /Begin armhole shaping/i.test(p))).toBe(true);
    expect(countBodyParagraphMatches(blocks, /Knit \d+ rows even/i)).toBe(0);
    expect(countBodyParagraphMatches(blocks, /Add markers for easier seaming/i)).toBe(0);

    const printHtml = renderSleevelessPrintPieceHtml(rows, "");
    expect(printHtml).toMatch(/glossary-tooltip-placeholder.*data-glossary-id="186"/);
    expect(printHtml).not.toMatch(/data-glossary-id="178"/);
  });
});
