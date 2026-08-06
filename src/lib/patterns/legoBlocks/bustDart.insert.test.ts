import { describe, expect, it } from "vitest";
import {
  calculateBustDart,
  insertBustDartIntoFrontBodyDisplayRows,
  type BustDartPatternDisplayRow,
} from "./bustDart";

describe("insertBustDartIntoFrontBodyDisplayRows", () => {
  it("splits knit-to-armhole BODY into dart sequence", () => {
    const result = calculateBustDart({
      enabled: true,
      cupSize: "C",
      sizeGroup: "misses",
      stitchesPerInch: 5,
      rowsPerInch: 7,
      frontConstruction: "pullover",
      frontStitchCount: 100,
      armholeOpeningGarmentRc: 140,
      hemRows: 22,
      bodyToArmholeRows: 118,
    });
    expect(result.active).toBe(true);

    const rows: BustDartPatternDisplayRow[] = [
      { kind: "piece", title: "FRONT" },
      { kind: "section", title: "BODY" },
      {
        kind: "block",
        rc: "RC: 022",
        paragraphs: ["Knit to RC 140."],
        stitchCount: 100,
      },
      { kind: "section", title: "ARMHOLE" },
      { kind: "block", paragraphs: ["Bind off."] },
    ];

    const out = insertBustDartIntoFrontBodyDisplayRows(rows, result, {
      formatRc: (rc) => `RC: ${String(rc).padStart(3, "0")}`,
      knitToRcLine: (t) => `Knit to RC ${t}.`,
    });

    const bodyText = out
      .filter((r) => r.kind === "block")
      .flatMap((r) => (r.kind === "block" ? r.paragraphs : []))
      .join("\n");
    expect(bodyText).toContain("Knit to RC 133.");
    expect(bodyText).toMatch(/Add bust darts/);
    expect(bodyText).toContain("Knit to RC 140.");
    expect(bodyText).toContain("Bind off.");
  });

  it("does not mutate back rows when inactive", () => {
    const rows: BustDartPatternDisplayRow[] = [
      { kind: "section", title: "BODY" },
      { kind: "block", paragraphs: ["Knit to RC 140."] },
    ];
    const inactive = calculateBustDart({
      enabled: false,
      cupSize: "C",
      sizeGroup: "misses",
      stitchesPerInch: 5,
      rowsPerInch: 7,
      frontConstruction: "pullover",
      frontStitchCount: 100,
      armholeOpeningGarmentRc: 140,
      hemRows: 22,
      bodyToArmholeRows: 118,
    });
    const out = insertBustDartIntoFrontBodyDisplayRows(rows, inactive, {
      formatRc: (rc) => String(rc),
      knitToRcLine: (t) => `Knit to RC ${t}.`,
    });
    expect(out).toEqual(rows);
  });
});
