import { describe, expect, it } from "vitest";
import {
  castOnMethodQuickTipBodyHtml,
  EWRAP_CAST_ON_GLOSSARY_ID,
  generateSleevelessBackPattern,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";

function basePattern(): Record<string, unknown> {
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
    style: {
      recipientCategory: "misses",
      neckline: "round",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function firstCastOnBlock(
  rows: readonly SleevelessPatternDisplayRow[],
): Extract<SleevelessPatternDisplayRow, { kind: "block" }> | undefined {
  return rows.find(
    (row) =>
      row.kind === "block" &&
      row.paragraphs.some((p) => /^Cast on \d+ stitches/i.test(p)),
  ) as Extract<SleevelessPatternDisplayRow, { kind: "block" }> | undefined;
}

describe("sleeveless cast-on pattern tip", () => {
  it("keeps cast-on instruction plain and adds tip with e-wrap glossary on back and front", () => {
    const r = generateSleevelessBackPattern(basePattern());
    const back = firstCastOnBlock(r.displayRows);
    const front = firstCastOnBlock(r.frontDisplayRows);

    expect(back?.paragraphs[0]).toMatch(/^Cast on \d+ stitches for the back\.?$/);
    expect(back?.tipPresentation).toBe("quick-tip");
    expect(back?.tipHtmlIsFull).toBe(true);
    expect(back?.tipId).toBe("sleeveless-cast-on-back");
    expect(back?.tipHtml).toContain("pattern-quick-tip__details");
    expect(back?.tipHtml).toContain(castOnMethodQuickTipBodyHtml());
    expect(back?.tipHtml).toContain(`data-glossary-id="${EWRAP_CAST_ON_GLOSSARY_ID}"`);
    expect(back?.tipHtml).toContain('data-term="e-wrap cast on"');
    expect(back?.tipHtml).not.toContain("Cast on ");

    expect(front?.paragraphs[0]).toMatch(/^Cast on \d+ stitches for the front\.?$/);
    expect(front?.tipPresentation).toBe("quick-tip");
    expect(front?.tipId).toBe("sleeveless-cast-on-front");

    const printHtml = renderSleevelessPrintPieceHtml(r.displayRows, "");
    expect(printHtml).toMatch(/Cast on \d+ stitches for the back/);
    expect(printHtml).toMatch(/e-wrap cast on/);
    expect(printHtml).toMatch(new RegExp(`data-glossary-id="${EWRAP_CAST_ON_GLOSSARY_ID}"`));
  });
});
