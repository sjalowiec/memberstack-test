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
import { formatSidewaysHeldStitchCensus } from "./sidewaysCardiganDisplayFormat";
import { renderPatternDisplayBlockHtml } from "./sleevelessPatternDisplayHtml";
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

function blockAfterSection(
  rows: readonly SleevelessPatternDisplayRow[],
  title: string,
): Extract<SleevelessPatternDisplayRow, { kind: "block" }> | undefined {
  const index = rows.findIndex((row) => row.kind === "section" && row.title === title);
  const next = index >= 0 ? rows[index + 1] : undefined;
  return next?.kind === "block" ? next : undefined;
}

function lastInstruction(
  row: Extract<SleevelessPatternDisplayRow, { kind: "block" }> | undefined,
): string {
  const lines = row?.trustedParagraphs?.length ? row.trustedParagraphs : row?.paragraphs ?? [];
  return lines.at(-1) ?? "";
}

function headerCountLabel(
  row: Extract<SleevelessPatternDisplayRow, { kind: "block" }> | undefined,
): string | undefined {
  if (!row) return undefined;
  if (row.stitchCensus && row.stitchCensus.held > 0) {
    return formatSidewaysHeldStitchCensus(row.stitchCensus);
  }
  if (row.stitchCount !== undefined) return `${row.stitchCount} sts`;
  return undefined;
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
    expect(stitchCounts).toContain(fullWidth);
    expect(stitchCounts).not.toContain(starting);
    const firstV = blockAfterSection(rows, "FIRST V-NECK");
    expect(firstV?.stitchCensus).toEqual({
      working: starting,
      held: instructions.calc.vNeckDepthStitches,
      total: fullWidth,
    });
    expect(firstV?.stitchCount).toBeUndefined();
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

  it("renders Cardigan BODY Lego for the Women's 5-inch V / 7.5-inch neck / 5×7 gauge case", () => {
    const sueCardigan: SidewaysCardiganBodyCalcInput = {
      garmentLengthInches: 25,
      vNeckDepthInches: 5,
      finishedBustCircumferenceInches: 46,
      finishedUpperArmInches: 14.5,
      neckOpeningWidthInches: 7.5,
      backNeckDepthInches: 1,
      stitchesPerInch: 5,
      rowsPerInch: 7,
    };
    const result = buildSidewaysCardiganBodyInstructions(sueCardigan, "cardigan");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    const { instructions } = result;
    expect(instructions.garmentStyle).toBe("cardigan");
    expect(instructions.calc.vNeckDepthStitches).toBe(26);
    expect(instructions.calc.halfNeckRows).toBe(26);
    expect(instructions.firstV.shapingActions).toBe(13);
    expect(instructions.increaseSequence).toEqual(Array(13).fill(2));
    expect(calculateSlopeShaping(26, 26).ok).toBe(false);

    const html = renderSidewaysCardiganBodyDisplayHtml(instructions);
    expect(html).toContain("pattern-section");
    expect(html).toContain("CAST ON");
    expect(html).toContain("FIRST V-NECK");
    expect(html).toContain("Return 2 stitches to work 13 times.");
    expect(html).not.toContain("sideways-body-sequence");
    expect(html).not.toMatch(/must exceed the even half-neck rows/i);
  });

  it("does not call the back neck a straight back neck in Cardigan BODY copy", () => {
    expect(text).not.toMatch(/straight back neck/i);
    expect(html).not.toMatch(/straight back neck/i);
  });

  it("puts the starting stitch state in the section header and the ending state in the last instruction", () => {
    const starting = instructions.startingFrontStitches;
    const held = instructions.calc.vNeckDepthStitches;
    const total = instructions.calc.garmentLengthStitches;
    const census = formatSidewaysHeldStitchCensus({ working: starting, held, total });
    const allWorking = `${total} sts`;

    const castOn = blockAfterSection(rows, "CAST ON");
    const firstV = blockAfterSection(rows, "FIRST V-NECK");
    const firstShoulder = blockAfterSection(rows, "FIRST FRONT SHOULDER");
    const secondV = blockAfterSection(rows, "SECOND V-NECK");

    expect(headerCountLabel(castOn)).toBe(allWorking);
    expect(castOn?.stitchCensus).toBeUndefined();
    expect(lastInstruction(castOn)).toBe(`Continue with ${census}.`);
    expect(renderPatternDisplayBlockHtml(castOn!)).toContain(`>${allWorking}<`);
    expect(renderPatternDisplayBlockHtml(castOn!)).not.toContain("sleeveless-pattern-sts--census");

    expect(headerCountLabel(firstV)).toBe(census);
    expect(firstV?.stitchCount).toBeUndefined();
    expect(lastInstruction(firstV)).toBe(`End at ${formatRcColon(26)} with ${allWorking}.`);
    expect(renderPatternDisplayBlockHtml(firstV!)).toContain("sleeveless-pattern-sts--census");
    expect(renderPatternDisplayBlockHtml(firstV!)).toContain(census);

    expect(headerCountLabel(firstShoulder)).toBe(allWorking);
    expect(firstShoulder?.stitchCensus).toBeUndefined();
    expect(lastInstruction(firstShoulder)).toContain(formatRcColon(70));

    expect(headerCountLabel(secondV)).toBe(allWorking);
    expect(secondV?.stitchCensus).toBeUndefined();
    expect(text).toContain(`After the last short-row action, ${census}.`);
    expect(lastInstruction(secondV)).toBe(
      `End at ${formatRcColon(280)}, not ${formatRcColon(281)}, with ${allWorking}.`,
    );
    expect(renderPatternDisplayBlockHtml(secondV!)).toContain(`>${allWorking}<`);
    expect(renderPatternDisplayBlockHtml(secondV!)).not.toContain("sleeveless-pattern-sts--census");
    expect(html).not.toContain(`then ${total} working`);
  });

  it("states Cast On and V-neck working/held transitions from the calculated model", () => {
    const starting = instructions.startingFrontStitches;
    const held = instructions.calc.vNeckDepthStitches;
    const total = instructions.calc.garmentLengthStitches;
    const census = formatSidewaysHeldStitchCensus({ working: starting, held, total });
    expect(text).toContain(`Bring ${total} needles into work.`);
    expect(text).toContain(`Place the ${held} neckline stitches into hold.`);
    expect(text).toContain(`Leave ${starting} body stitches working.`);
    expect(text).toContain(`Continue with ${census}.`);
    expect(text).toContain(`Begin with ${starting} stitches working and ${held} stitches held.`);
    expect(text).toContain(`After the final action, all ${total} stitches are working.`);
    expect(text).toContain(`End at ${formatRcColon(26)} with ${total} sts.`);
    expect(text).toContain(`Begin with all ${total} stitches working.`);
    expect(text).toContain(`After the last short-row action, ${census}.`);
    expect(text).toContain(
      `During the final two-row interval, return all held stitches to work and knit across all ${total} stitches to enclose the wraps.`,
    );
    expect(text).toContain(
      `End at ${formatRcColon(280)}, not ${formatRcColon(281)}, with ${total} sts.`,
    );
  });

  it("renders the 68-stitch Cardigan example with start-state headers and ending-state instructions", () => {
    const sixtyEight: SidewaysCardiganBodyCalcInput = {
      garmentLengthInches: 17,
      vNeckDepthInches: 5,
      finishedBustCircumferenceInches: 40,
      finishedUpperArmInches: 14,
      neckOpeningWidthInches: 7,
      backNeckDepthInches: 1,
      stitchesPerInch: 4,
      rowsPerInch: 6,
    };
    const result = buildSidewaysCardiganBodyInstructions(sixtyEight, "cardigan");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    const { instructions: model } = result;
    expect(model.calc.garmentLengthStitches).toBe(68);
    expect(model.calc.vNeckDepthStitches).toBe(20);
    expect(model.startingFrontStitches).toBe(48);

    const displayRows = buildSidewaysCardiganBodyDisplayRows(model);
    const displayText = allTrustedAndPlain(displayRows);
    const census = formatSidewaysHeldStitchCensus({ working: 48, held: 20, total: 68 });
    expect(census).toBe("48 working · 20 held · 68 total");

    const castOn = blockAfterSection(displayRows, "CAST ON");
    const firstV = blockAfterSection(displayRows, "FIRST V-NECK");
    const firstShoulder = blockAfterSection(displayRows, "FIRST FRONT SHOULDER");
    const secondV = blockAfterSection(displayRows, "SECOND V-NECK");

    expect(headerCountLabel(castOn)).toBe("68 sts");
    expect(lastInstruction(castOn)).toBe(`Continue with ${census}.`);
    expect(renderPatternDisplayBlockHtml(castOn!)).toContain(">68 sts<");
    expect(renderPatternDisplayBlockHtml(castOn!)).not.toContain("sleeveless-pattern-sts--census");

    expect(headerCountLabel(firstV)).toBe(census);
    expect(lastInstruction(firstV)).toMatch(/with 68 sts\.$/);
    expect(renderPatternDisplayBlockHtml(firstV!)).toContain(census);
    expect(renderPatternDisplayBlockHtml(firstV!)).toContain("sleeveless-pattern-sts--census");

    expect(headerCountLabel(firstShoulder)).toBe("68 sts");
    expect(lastInstruction(firstShoulder)).toMatch(/End at RC:/);

    expect(headerCountLabel(secondV)).toBe("68 sts");
    expect(displayText).toContain(`After the last short-row action, ${census}.`);
    expect(lastInstruction(secondV)).toMatch(/with 68 sts\.$/);
    expect(renderPatternDisplayBlockHtml(secondV!)).toContain(">68 sts<");
    expect(renderPatternDisplayBlockHtml(secondV!)).not.toContain("sleeveless-pattern-sts--census");

    expect(displayText).toContain("Bring 68 needles into work.");
    expect(displayText).toContain("Place the 20 neckline stitches into hold.");
    expect(displayText).toContain("Leave 48 body stitches working.");
    expect(displayText).toContain("Begin with 48 stitches working and 20 stitches held.");
    expect(displayText).toContain("After the final action, all 68 stitches are working.");
    expect(displayText).toContain("Begin with all 68 stitches working.");
    expect(displayText).toContain(
      "During the final two-row interval, return all held stitches to work and knit across all 68 stitches to enclose the wraps.",
    );
    expect(displayText).not.toMatch(/straight back neck/i);
    expect(displayText).not.toContain("48 sts");
  });
});
