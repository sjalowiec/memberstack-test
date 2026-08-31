import { describe, expect, it } from "vitest";
import {
  ARMHOLE_RC_FROM_RESET_NOTE,
  generateSleevelessBackPattern,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";
import {
  RESET_ROW_COUNTER_TEXT,
  RESTART_ROW_COUNTER_TEXT,
  STOP_ROW_COUNTER_TEXT,
  formatRowCounterResetGarmentRcLabel,
  rowCounterResetBlockHtml,
  rowCounterRestartBlockHtml,
  rowCounterStopBlockHtml,
} from "./rowCounterReset";
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

function firstArmholeBindOffBlock(rows: readonly SleevelessPatternDisplayRow[]) {
  let inArmhole = false;
  for (const row of rows) {
    if (row.kind === "section") {
      inArmhole = row.title === "ARMHOLE";
      continue;
    }
    if (
      inArmhole &&
      row.kind === "block" &&
      row.paragraphs.some((p) => /Bind off OR hold/i.test(p))
    ) {
      return row;
    }
  }
  return undefined;
}

describe("rowCounterResetBlockHtml", () => {
  it("renders the exact required wording", () => {
    expect(RESET_ROW_COUNTER_TEXT).toBe("RESET ROW COUNTER TO 000");
    const html = rowCounterResetBlockHtml(120);
    expect(html).toContain(RESET_ROW_COUNTER_TEXT);
  });

  it("shows the garment RC immediately above the reset button", () => {
    expect(formatRowCounterResetGarmentRcLabel(120)).toBe("RC: 120");
    const html = rowCounterResetBlockHtml(120);
    expect(html).toContain('class="row-counter-reset__garment-rc"');
    expect(html).toContain("RC: 120");
    const rcIdx = html.indexOf("RC: 120");
    const resetIdx = html.indexOf(RESET_ROW_COUNTER_TEXT);
    expect(rcIdx).toBeGreaterThanOrEqual(0);
    expect(resetIdx).toBeGreaterThan(rcIdx);
  });

  it("includes a reset/refresh icon and is not a dismissible pattern tip", () => {
    const html = rowCounterResetBlockHtml(0);
    expect(html).toContain("row-counter-reset__icon");
    expect(html).toContain("<svg");
    expect(html).not.toContain("pattern-tip");
    expect(html).not.toContain("pattern-tip-dismiss");
    expect(html).not.toContain("<details");
  });
});

describe("rowCounterStopBlockHtml", () => {
  it("reuses the existing row-counter-reset control with STOP ROW COUNTER wording", () => {
    expect(STOP_ROW_COUNTER_TEXT).toBe("STOP ROW COUNTER");
    const html = rowCounterStopBlockHtml(0);
    expect(html).toContain("RC: 000");
    expect(html).toContain(STOP_ROW_COUNTER_TEXT);
    expect(html).not.toContain(RESET_ROW_COUNTER_TEXT);
    expect(html).toContain('class="row-counter-reset"');
    expect(html).toContain("row-counter-reset__icon");
    expect(html).not.toContain("pattern-tip");
  });
});

describe("rowCounterRestartBlockHtml", () => {
  it("reuses the existing row-counter-reset control with RESTART ROW COUNTER AT 000 wording", () => {
    expect(RESTART_ROW_COUNTER_TEXT).toBe("RESTART ROW COUNTER AT 000");
    const html = rowCounterRestartBlockHtml(0);
    expect(html).toContain("RC: 000");
    expect(html).toContain(RESTART_ROW_COUNTER_TEXT);
    expect(html).not.toContain(RESET_ROW_COUNTER_TEXT);
    expect(html).not.toContain(STOP_ROW_COUNTER_TEXT);
    expect(html).toContain('class="row-counter-reset"');
    expect(html).toContain("row-counter-reset__icon");
    expect(html).not.toContain("pattern-tip");
  });
});

describe("sleeveless armhole row counter reset block", () => {
  it("marks the first armhole block as a row-counter-reset action and drops the old wording", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const block = firstArmholeBlock(r.displayRows);
    expect(block?.kind).toBe("block");
    if (block?.kind !== "block") throw new Error("expected armhole block");
    expect(block.rowCounterReset).toBe(true);
    expect(block.rowCounterResetGarmentRc).toBeGreaterThan(0);
    expect(block.paragraphs).not.toContain(OLD_RESET_WORDING);
    expect(block.paragraphs.some((p) => p.includes(OLD_RESET_WORDING))).toBe(false);
  });

  it("drops the explanatory reset note and leads with the bind-off instruction", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const reset = firstArmholeBlock(r.displayRows);
    if (reset?.kind !== "block") throw new Error("expected armhole reset block");
    expect(reset.rowCounterReset).toBe(true);
    expect(reset.paragraphs).toEqual([]);

    const bindOff = firstArmholeBindOffBlock(r.displayRows);
    if (bindOff?.kind !== "block") throw new Error("expected armhole bind-off block");
    expect(bindOff.paragraphs.some((p) => p.includes(ARMHOLE_RC_FROM_RESET_NOTE))).toBe(false);
    expect(bindOff.paragraphs[0]).toMatch(
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
    expect(html).toContain("row-counter-reset__garment-rc");

    const resetIdx = html.indexOf(RESET_ROW_COUNTER_TEXT);
    const bindOffIdx = html.search(/Bind off OR hold \d+ stitches at the armhole edge/);
    const armholeRcIdx = html.indexOf("RC: 000", resetIdx);
    expect(resetIdx).toBeGreaterThanOrEqual(0);
    expect(bindOffIdx).toBeGreaterThan(resetIdx);
    expect(armholeRcIdx).toBeGreaterThan(resetIdx);
    expect(armholeRcIdx).toBeLessThan(bindOffIdx);
  });

  it("renders the reset marker exactly once per armhole (no duplicated wording)", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const html = renderSleevelessPrintPieceHtml(r.displayRows, "");
    const visibleMarkers = html.split(`>${RESET_ROW_COUNTER_TEXT}<`).length - 1;
    expect(visibleMarkers).toBe(1);
  });
});
