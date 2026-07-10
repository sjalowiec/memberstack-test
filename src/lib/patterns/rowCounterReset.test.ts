import { describe, expect, it } from "vitest";
import {
  ARMHOLE_RC_FROM_RESET_NOTE,
  generateSleevelessBackPattern,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";
import { RESET_ROW_COUNTER_TEXT, rowCounterResetBlockHtml } from "./rowCounterReset";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";

const OLD_RESET_WORDING = "Reset Armhole RC to RC:000.";

function basePattern(neckline: string): Record<string, unknown> {
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
    style: { recipientCategory: "misses", neckline },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function firstArmholeBlock(rows: readonly SleevelessPatternDisplayRow[]) {
  let inArmhole = false;
  for (const row of rows) {
    if (row.kind === "section") {
      inArmhole = row.title === "ARMHOLE";
      continue;
    }
    if (inArmhole && row.kind === "block") return row;
  }
  return undefined;
}

describe("rowCounterResetBlockHtml", () => {
  it("renders the exact required wording", () => {
    expect(RESET_ROW_COUNTER_TEXT).toBe("RESET ROW COUNTER TO 000");
    const html = rowCounterResetBlockHtml();
    expect(html).toContain(RESET_ROW_COUNTER_TEXT);
  });

  it("includes a reset/refresh icon and is not a dismissible pattern tip", () => {
    const html = rowCounterResetBlockHtml();
    expect(html).toContain("row-counter-reset__icon");
    expect(html).toContain("<svg");
    expect(html).not.toContain("pattern-tip");
    expect(html).not.toContain("pattern-tip-dismiss");
    expect(html).not.toContain("<details");
  });
});

describe("sleeveless armhole row counter reset block", () => {
  it("marks the first armhole block as a row-counter-reset action and drops the old wording", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const block = firstArmholeBlock(r.displayRows);
    expect(block?.kind).toBe("block");
    if (block?.kind !== "block") throw new Error("expected armhole block");
    expect(block.rowCounterReset).toBe(true);
    expect(block.paragraphs).not.toContain(OLD_RESET_WORDING);
    expect(block.paragraphs.some((p) => p.includes(OLD_RESET_WORDING))).toBe(false);
  });

  it("drops the explanatory reset note and leads with the bind-off instruction", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const block = firstArmholeBlock(r.displayRows);
    if (block?.kind !== "block") throw new Error("expected armhole block");
    expect(block.paragraphs.some((p) => p.includes(ARMHOLE_RC_FROM_RESET_NOTE))).toBe(false);
    expect(block.paragraphs[0]).toMatch(
      /^Bind off OR hold \d+ stitches at the armhole edge \(carriage side\)\. Knit across\.$/,
    );
  });

  it("front piece also uses the reset marker without the old wording", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const block = firstArmholeBlock(r.frontDisplayRows);
    if (block?.kind !== "block") throw new Error("expected front armhole block");
    expect(block.rowCounterReset).toBe(true);
    expect(block.paragraphs.some((p) => p.includes(OLD_RESET_WORDING))).toBe(false);
  });
});

describe("row counter reset in printed pattern", () => {
  it("renders the reset block in place of the old sentence, before the bind-off instruction", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const html = renderSleevelessPrintPieceHtml(r.displayRows, "");

    expect(html).toContain("row-counter-reset");
    expect(html).toContain(RESET_ROW_COUNTER_TEXT);
    expect(html).not.toContain(OLD_RESET_WORDING);
    expect(html).not.toContain(ARMHOLE_RC_FROM_RESET_NOTE);

    const resetIdx = html.indexOf(RESET_ROW_COUNTER_TEXT);
    const bindOffIdx = html.search(/Bind off OR hold \d+ stitches at the armhole edge/);
    expect(resetIdx).toBeGreaterThanOrEqual(0);
    expect(bindOffIdx).toBeGreaterThan(resetIdx);
  });

  it("renders the reset marker exactly once per armhole (no duplicated wording)", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const html = renderSleevelessPrintPieceHtml(r.displayRows, "");
    const visibleMarkers = html.split(`>${RESET_ROW_COUNTER_TEXT}<`).length - 1;
    expect(visibleMarkers).toBe(1);
  });
});
