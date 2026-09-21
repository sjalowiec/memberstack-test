import { describe, expect, it } from "vitest";
import { calculateSlopeShaping } from "./legoBlocks/slopeShaping";
import { buildSidewaysCardiganBodyInstructions } from "./sidewaysCardiganBodyInstructions";
import type { SidewaysCardiganBodyCalcInput } from "./sidewaysCardiganBodyCalc";
import { formatRcColon, type SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import {
  buildSidewaysCardiganBodyDisplayRows,
  compactSlopeSequence,
  EVERY_OTHER_ROW_GLOSSARY_ID,
  MANUAL_WRAP_GLOSSARY_ID,
  renderSidewaysCardiganBodyDisplayHtml,
  SHORT_ROW_DECREASE_GLOSSARY_ID,
  SHORT_ROW_INCREASE_GLOSSARY_ID,
  SHORT_ROW_PARTIAL_KNITTING_GLOSSARY_ID,
  shortRowActionRowCounters,
  SIDEWAYS_CARDIGAN_BODY_SECTION_TITLES,
  CAST_ON_RAG_GLOSSARY_ID,
  CLOSED_CAST_ON_GLOSSARY_ID,
  EWRAP_CAST_ON_GLOSSARY_ID,
  RAVEL_CORD_GLOSSARY_ID,
} from "./sidewaysCardiganPatternOutput";
import { renderSidewaysCardiganBodySequenceHtml } from "./sidewaysCardiganBodyInstructions";

const SAMPLE: SidewaysCardiganBodyCalcInput = {
  garmentLengthInches: 22,
  vNeckDepthInches: 8,
  finishedBustCircumferenceInches: 40,
  finishedUpperArmInches: 14,
  neckOpeningWidthInches: 7,
  backNeckDepthInches: 1,
  stitchesPerInch: 5,
  rowsPerInch: 7,
};

function cardiganOk() {
  const result = buildSidewaysCardiganBodyInstructions(SAMPLE, "cardigan");
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.instructions;
}

function pulloverOk() {
  const result = buildSidewaysCardiganBodyInstructions(SAMPLE, "pullover");
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.instructions;
}

function sectionTitles(rows: readonly SleevelessPatternDisplayRow[]): string[] {
  return rows.filter((row) => row.kind === "section").map((row) => row.title);
}

function blocks(rows: readonly SleevelessPatternDisplayRow[]) {
  return rows.filter(
    (row): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> => row.kind === "block",
  );
}

function allTrustedAndPlain(rows: readonly SleevelessPatternDisplayRow[]): string {
  return blocks(rows)
    .flatMap((row) => [...row.paragraphs, ...(row.trustedParagraphs ?? [])])
    .join("\n");
}

describe("sideways cardigan BODY display adapter", () => {
  const instructions = cardiganOk();
  const rows = buildSidewaysCardiganBodyDisplayRows(instructions);
  const html = renderSidewaysCardiganBodyDisplayHtml(instructions);
  const text = allTrustedAndPlain(rows);

  it("uses the established section order", () => {
    expect(rows[0]).toEqual({ kind: "piece", title: "BODY" });
    expect(sectionTitles(rows)).toEqual([...SIDEWAYS_CARDIGAN_BODY_SECTION_TITLES]);
  });

  it("uses calculated RC landmarks with formatRcColon", () => {
    const { landmarks } = instructions;
    expect(text).toContain(formatRcColon(landmarks.endFirstVShaping));
    expect(text).toContain(formatRcColon(landmarks.firstSideSeam));
    expect(text).toContain(formatRcColon(landmarks.firstBackNeckEdge));
    expect(text).toContain(formatRcColon(landmarks.secondBackNeckEdge));
    expect(text).toContain(formatRcColon(landmarks.secondSideSeam));
    expect(text).toContain(formatRcColon(landmarks.startFinalVShaping));
    expect(text).toContain(formatRcColon(landmarks.endSecondVShaping));
    expect(text).toContain(formatRcColon(landmarks.finalBindOff));
    expect(landmarks.endFirstVShaping).toBe(26);
    expect(landmarks.firstSideSeam).toBe(70);
    expect(landmarks.firstBackNeckEdge).toBe(114);
    expect(landmarks.secondBackNeckEdge).toBe(166);
    expect(landmarks.secondSideSeam).toBe(210);
    expect(landmarks.startFinalVShaping).toBe(254);
    expect(landmarks.endSecondVShaping).toBe(280);
  });

  it("uses calculated stitch counts, not hard-coded sample literals in the adapter source path", () => {
    const fullWidth = instructions.calc.garmentLengthStitches;
    const starting = instructions.startingFrontStitches;
    const backNeckLive = instructions.backNeckLiveStitches;
    expect(fullWidth).toBe(110);
    expect(starting).toBe(70);
    expect(backNeckLive).toBe(104);
    expect(text).toContain(String(fullWidth));
    expect(text).toContain(String(starting));
    expect(text).toContain(String(backNeckLive));
    expect(text).toContain(String(instructions.calc.armholeDepthStitches));
    expect(text).toContain(String(instructions.calc.backNeckDepthStitches));
    const stitchCounts = blocks(rows)
      .map((row) => row.stitchCount)
      .filter((n): n is number => n !== undefined);
    expect(stitchCounts).toContain(starting);
    expect(stitchCounts).toContain(fullWidth);
  });

  it("lists 13 short-row actions for the increase and the reversed decrease", () => {
    const slope = calculateSlopeShaping(
      instructions.calc.vNeckDepthStitches,
      instructions.calc.halfNeckRows,
    );
    expect(slope.ok).toBe(true);
    if (!slope.ok) throw new Error(slope.reason);
    expect(slope.shapingActions).toBe(13);
    expect(instructions.increaseSequence).toEqual(slope.sequence);
    expect(instructions.decreaseSequence).toEqual([...slope.sequence].reverse());
    expect(compactSlopeSequence(instructions.increaseSequence)).toEqual([
      { stitches: 4, times: 1 },
      { stitches: 3, times: 12 },
    ]);
    expect(compactSlopeSequence(instructions.decreaseSequence)).toEqual([
      { stitches: 3, times: 12 },
      { stitches: 4, times: 1 },
    ]);

    const firstV = blocks(rows).find((row) => row.bodyShapingChartId === "sideways-cardigan-first-v-neck");
    const secondV = blocks(rows).find((row) => row.bodyShapingChartId === "sideways-cardigan-second-v-neck");
    expect(firstV?.bodyShapingChartRows).toHaveLength(13);
    expect(secondV?.bodyShapingChartRows).toHaveLength(13);
    expect(firstV?.bodyShapingChartRows?.map((row) => Number(row.action.match(/\d+/)?.[0]))).toEqual(
      instructions.increaseSequence,
    );
    expect(secondV?.bodyShapingChartRows?.map((row) => Number(row.action.match(/\d+/)?.[0]))).toEqual(
      instructions.decreaseSequence,
    );
    expect(text).toContain("Return 4 stitches to work once.");
    expect(text).toContain("Return 3 stitches to work 12 times.");
    expect(text).toContain("Place 3 stitches into hold 12 times.");
    expect(text).toContain("Place 4 stitches into hold once.");
  });

  it("shows calculated increase action RCs through the even V section", () => {
    const rcs = shortRowActionRowCounters(
      instructions.firstV.rowInterval === 2 ? 0 : instructions.firstV.rowInterval,
      instructions.firstV.rowInterval,
      instructions.firstV.shapingActions,
    );
    expect(rcs).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
    expect(text).toContain(`${formatRcColon(0)}, ${formatRcColon(2)}, through ${formatRcColon(24)}`);
    expect(text).toContain(`End at ${formatRcColon(26)}`);
  });

  it("uses the approved glossary IDs", () => {
    expect(html).toContain(`data-glossary-id="${SHORT_ROW_INCREASE_GLOSSARY_ID}"`);
    expect(html).toContain(`data-glossary-id="${SHORT_ROW_DECREASE_GLOSSARY_ID}"`);
    expect(html).toContain(`data-glossary-id="${SHORT_ROW_PARTIAL_KNITTING_GLOSSARY_ID}"`);
    expect(html).toContain(`data-glossary-id="${EVERY_OTHER_ROW_GLOSSARY_ID}"`);
    expect(html).toContain(`data-glossary-id="${MANUAL_WRAP_GLOSSARY_ID}"`);
    expect(html).toContain(`data-glossary-id="${EWRAP_CAST_ON_GLOSSARY_ID}"`);
    expect(html).toContain(`data-glossary-id="${CAST_ON_RAG_GLOSSARY_ID}"`);
    expect(html).toContain(`data-glossary-id="${RAVEL_CORD_GLOSSARY_ID}"`);
    expect(html).toContain(`data-glossary-id="${CLOSED_CAST_ON_GLOSSARY_ID}"`);
  });

  it("ends the enclosing row at RC 280, not RC 281", () => {
    expect(instructions.landmarks.endSecondVShaping).toBe(280);
    expect(instructions.landmarks.finalBindOff).toBe(280);
    expect(text).toContain(`End at ${formatRcColon(280)}, not ${formatRcColon(281)}`);
    const bindOff = blocks(rows).at(-1);
    expect(bindOff?.rc).toBe(formatRcColon(280));
    expect(bindOff?.paragraphs.join(" ")).toMatch(/Bind off all 110 stitches loosely/);
    expect(text).not.toMatch(/End at RC: 281/);
  });

  it("does not emit the temporary landmark or section-row dumps", () => {
    expect(html).not.toContain("sideways-body-landmarks");
    expect(html).not.toContain("sideways-body-sections");
    expect(html).not.toContain("sideways-body-sequence");
    expect(html).not.toContain("print-summary-dl");
    expect(html).toContain("pattern-section");
    expect(html).toContain("pattern-subsection");
    expect(html).toContain('id="sg-body"');
  });

  it("leaves pullover output on the numbered sequence renderer", () => {
    const pullover = pulloverOk();
    expect(buildSidewaysCardiganBodyDisplayRows(pullover)).toEqual([]);
    expect(renderSidewaysCardiganBodyDisplayHtml(pullover)).toBe("");
    const pulloverHtml = renderSidewaysCardiganBodySequenceHtml(pullover);
    expect(pulloverHtml).toContain("sideways-body-sequence");
    expect(pulloverHtml).toContain("sideways-body-landmarks");
    expect(pulloverHtml).toMatch(/starts at a side seam/i);
  });
});
