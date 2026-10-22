import { describe, expect, it } from "vitest";
import { KNITSYNC_SWATCH, type KnitSyncPattern } from "./knitsyncPattern";
import { shapingAlertDecision, shapingHighlightRow } from "./knitsyncShapingAlert";

const pattern = KNITSYNC_SWATCH;

function step(from: number, to: number, alertedRows: readonly number[] = [], soundEnabled = true) {
  return shapingAlertDecision({
    pattern,
    fromCompleted: from,
    toCompleted: to,
    soundEnabled,
    alertedRows,
  });
}

describe("shaping alert timing", () => {
  it("beeps only when the counter first reaches 6, 7, 12, and 13", () => {
    let completed = 0;
    let alertedRows: readonly number[] = [];
    const beeps: number[] = [];
    for (let next = 1; next <= pattern.rows.length; next += 1) {
      const decision = step(completed, next, alertedRows);
      if (decision.alert) beeps.push(next);
      alertedRows = decision.alertedRows;
      completed = next;
    }
    expect(beeps).toEqual([6, 7, 12, 13]);
    expect(alertedRows).toEqual([7, 8, 13, 14]);
  });

  it("highlights the shaping row that is about to be knitted", () => {
    expect(shapingHighlightRow(pattern, 5)).toBeNull();
    expect(shapingHighlightRow(pattern, 6)).toBe(7);
    expect(shapingHighlightRow(pattern, 7)).toBe(8);
    expect(shapingHighlightRow(pattern, 8)).toBeNull();
    expect(shapingHighlightRow(pattern, 12)).toBe(13);
    expect(shapingHighlightRow(pattern, 13)).toBe(14);
    expect(shapingHighlightRow(pattern, 14)).toBeNull();
    expect(shapingHighlightRow(pattern, 20)).toBeNull();
  });

  it("beeps for a bind-off row", () => {
    const bindOff: KnitSyncPattern = {
      name: "bind-off sample",
      castOnStitches: 10,
      startingCarriageSide: "right",
      rows: [
        {
          row: 1,
          kind: "knit",
          carriageSide: "right",
          stitchesBefore: 10,
          stitchesAfter: 10,
          summary: "Row 1 · Knit",
          instruction: "Knit the row.",
        },
        {
          row: 2,
          kind: "bind-off",
          carriageSide: "left",
          stitchesBefore: 10,
          stitchesAfter: 0,
          summary: "Row 2 · Bind off",
          instruction: "Bind off.",
        },
      ],
    };
    const shown = shapingAlertDecision({
      pattern: bindOff,
      fromCompleted: 0,
      toCompleted: 1,
      soundEnabled: true,
      alertedRows: [],
    });
    expect(shown.alert).toBe(true);
    expect(shown.highlightRow).toBe(2);
  });
});

describe("duplicate shaping alerts", () => {
  it("does not beep again when the same count is rendered or the counter stays put", () => {
    const first = step(5, 6);
    expect(first.alert).toBe(true);
    const again = step(6, 6, first.alertedRows);
    expect(again.alert).toBe(false);
    expect(again.highlightRow).toBe(7);
    expect(again.alertedRows).toEqual([7]);
  });

  it("updates the highlight on a manual reversal without beeping again", () => {
    const first = step(5, 6);
    const back = step(6, 5, first.alertedRows);
    expect(back.alert).toBe(false);
    expect(back.highlightRow).toBeNull();

    const returned = step(5, 6, back.alertedRows);
    expect(returned.alert).toBe(false);
    expect(returned.highlightRow).toBe(7);

    const nextShaping = step(6, 7, returned.alertedRows);
    expect(nextShaping.alert).toBe(true);
    expect(nextShaping.highlightRow).toBe(8);
  });

  it("does not beep when sound is off, and still highlights the shaping row", () => {
    const muted = step(11, 12, [], false);
    expect(muted.alert).toBe(false);
    expect(muted.highlightRow).toBe(13);
    expect(muted.alertedRows).toEqual([]);
  });
});
