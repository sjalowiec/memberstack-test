import { describe, expect, it } from "vitest";
import {
  completedRowsAfterKey,
  completedRowsAfterStep,
  KNITSYNC_SWATCH,
  selectKnitSyncInstruction,
} from "./knitsyncPattern";

const total = KNITSYNC_SWATCH.rows.length;

describe("KnitSync swatch mechanics", () => {
  it("is a 20-row swatch cast on 40 stitches", () => {
    expect(total).toBe(20);
    expect(KNITSYNC_SWATCH.castOnStitches).toBe(40);
    expect(KNITSYNC_SWATCH.startingCarriageSide).toBe("right");
    expect(KNITSYNC_SWATCH.rows.map((row) => row.row)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  it("knits straight, then shapes one carriage-side stitch on two decrease rows and two increase rows", () => {
    const kinds = KNITSYNC_SWATCH.rows.map((row) => row.kind);
    expect(kinds.filter((kind) => kind === "decrease")).toHaveLength(2);
    expect(kinds.filter((kind) => kind === "increase")).toHaveLength(2);
    expect(KNITSYNC_SWATCH.rows[6]).toMatchObject({
      row: 7,
      kind: "decrease",
      carriageSide: "right",
      stitchesBefore: 40,
      stitchesAfter: 39,
    });
    expect(KNITSYNC_SWATCH.rows[7]).toMatchObject({
      row: 8,
      kind: "decrease",
      carriageSide: "left",
      stitchesBefore: 39,
      stitchesAfter: 38,
    });
    expect(KNITSYNC_SWATCH.rows[12]).toMatchObject({
      row: 13,
      kind: "increase",
      carriageSide: "right",
      stitchesBefore: 38,
      stitchesAfter: 39,
    });
    expect(KNITSYNC_SWATCH.rows[13]).toMatchObject({
      row: 14,
      kind: "increase",
      carriageSide: "left",
      stitchesBefore: 39,
      stitchesAfter: 40,
    });
  });

  it("keeps stitch count and carriage side continuous", () => {
    const rows = KNITSYNC_SWATCH.rows;
    expect(rows[0]?.stitchesBefore).toBe(40);
    expect(rows[0]?.carriageSide).toBe("right");
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]!;
      const delta = row.stitchesAfter - row.stitchesBefore;
      expect(delta).toBe(row.kind === "knit" ? 0 : row.kind === "decrease" ? -1 : 1);
      expect(row.stitchesAfter).toBeGreaterThan(0);
      if (index > 0) {
        expect(row.stitchesBefore).toBe(rows[index - 1]!.stitchesAfter);
        expect(row.carriageSide).not.toBe(rows[index - 1]!.carriageSide);
      }
      if (row.kind === "knit") {
        expect(row.instruction).toContain(`Carriage on the ${row.carriageSide}`);
        expect(row.instruction).not.toContain("Before knitting this row");
      } else {
        expect(row.instruction).toContain(`Before knitting this row`);
        expect(row.instruction).toContain(`${row.carriageSide}-edge stitch`);
      }
    }
    expect(rows.at(-1)?.stitchesAfter).toBe(40);
    expect(rows.at(-1)?.carriageSide).toBe("left");
  });
});

describe("instruction selection", () => {
  it("shows the next row, so 9 completed rows display row 10", () => {
    const start = selectKnitSyncInstruction(KNITSYNC_SWATCH, 0);
    expect(start.currentRow).toBe(1);
    expect(start.previousText).toContain("Cast on 40");
    expect(start.upcomingRow).toBe(2);
    expect(start.currentText).toContain("Carriage on the right");
    expect(start.currentText).toContain("Knit the row");

    const atNine = selectKnitSyncInstruction(KNITSYNC_SWATCH, 9);
    expect(atNine.completedRows).toBe(9);
    expect(atNine.currentRow).toBe(10);
    expect(atNine.previousRow).toBe(9);
    expect(atNine.upcomingRow).toBe(11);
    expect(atNine.heading).toBe("Row 10 of 20");
    expect(atNine.currentText).toContain("38 stitches");
    expect(atNine.currentText).toContain("Carriage on the left");
    expect(atNine.metaLabel).toContain("38 stitches on the machine");

    const firstDecrease = selectKnitSyncInstruction(KNITSYNC_SWATCH, 6);
    expect(firstDecrease.currentRow).toBe(7);
    expect(firstDecrease.currentText).toContain("Before knitting this row");
    expect(firstDecrease.currentText).toContain("right-edge stitch");
  });
});

describe("row advancement, reversal, and completion", () => {
  it("advances and reverses one row at a time and stops at both ends", () => {
    expect(completedRowsAfterStep(0, "reverse", total)).toBe(0);
    expect(completedRowsAfterStep(0, "advance", total)).toBe(1);
    expect(completedRowsAfterStep(9, "advance", total)).toBe(10);
    expect(completedRowsAfterStep(10, "reverse", total)).toBe(9);
    expect(completedRowsAfterStep(20, "advance", total)).toBe(20);
    expect(completedRowsAfterStep(19, "advance", total)).toBe(20);
  });

  it("follows Sky Turner arrow keys and ignores a held key", () => {
    expect(completedRowsAfterKey(9, { key: "ArrowRight" }, total).completedRows).toBe(10);
    expect(completedRowsAfterKey(9, { key: "ArrowDown" }, total).completedRows).toBe(10);
    expect(completedRowsAfterKey(10, { key: "ArrowLeft" }, total).completedRows).toBe(9);
    expect(completedRowsAfterKey(10, { key: "ArrowUp" }, total).completedRows).toBe(9);

    const held = completedRowsAfterKey(4, { key: "ArrowRight", repeat: true }, total);
    expect(held.completedRows).toBe(4);
    expect(held.decision.command?.direction).toBeNull();

    const done = selectKnitSyncInstruction(
      KNITSYNC_SWATCH,
      completedRowsAfterKey(20, { key: "ArrowRight", code: "ArrowRight" }, total).completedRows,
    );
    expect(done.complete).toBe(true);
    expect(done.canAdvance).toBe(false);
    expect(done.canReverse).toBe(true);
    expect(done.currentRow).toBeNull();
    expect(done.previousRow).toBe(20);
    expect(done.upcomingText).toBe("None");
    expect(done.currentText).toContain("All 20 rows are knitted");
    expect(done.currentText).toContain("Carriage is on the right");
  });

  it("returns to the last instruction when an accidental completion is reversed", () => {
    const completed = completedRowsAfterKey(20, { key: "ArrowLeft" }, total).completedRows;
    const view = selectKnitSyncInstruction(KNITSYNC_SWATCH, completed);
    expect(completed).toBe(19);
    expect(view.currentRow).toBe(20);
    expect(view.upcomingText).toBe("None");
    expect(view.canAdvance).toBe(true);
  });
});
