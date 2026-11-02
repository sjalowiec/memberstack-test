import { describe, expect, it } from "vitest";
import { formatParentheticalRcList, normalizeParentheticalRcLists } from "./parentheticalRcList";
import { formatRcColon } from "./sleevelessPatternOutput";

describe("formatParentheticalRcList", () => {
  it("writes RC once and pads every reading to three digits", () => {
    expect(formatParentheticalRcList([6, 12, 18, 24, 30, 36, 42])).toBe(
      "(RC: 006, 012, 018, 024, 030, 036, 042)",
    );
    expect(formatParentheticalRcList([0, 1])).toBe("(RC: 000, 001)");
    expect(formatParentheticalRcList([4])).toBe("(RC: 004)");
    expect(formatParentheticalRcList([113, 115])).toBe("(RC: 113, 115)");
    expect(formatParentheticalRcList([1000])).toBe("(RC: 1000)");
  });

  it("uses the same digits as an individual heading", () => {
    for (const rc of [0, 6, 42, 119, 1000]) {
      expect(formatParentheticalRcList([rc])).toBe(`(${formatRcColon(rc)})`);
    }
  });
});

describe("normalizeParentheticalRcLists", () => {
  it("collapses a repeated RC label and pads short readings", () => {
    expect(normalizeParentheticalRcLists("(RC: 006, RC: 012, RC: 018)")).toBe("(RC: 006, 012, 018)");
    expect(normalizeParentheticalRcLists("<em>(RC: 6, 12)</em>")).toBe("<em>(RC: 006, 012)</em>");
    expect(normalizeParentheticalRcLists("(RC: 006, 012)")).toBe("(RC: 006, 012)");
  });

  it("leaves individual headings and non-parenthetical lists alone", () => {
    const heading = "RC: 006 Bind off 6 stitches at the beginning of the next 2 rows.";
    expect(normalizeParentheticalRcLists(heading)).toBe(heading);
    const prose =
      "Decrease 1 stitch at each side when the counter reads RC: 006, RC: 012, before knitting that row.";
    expect(normalizeParentheticalRcLists(prose)).toBe(prose);
  });
});
