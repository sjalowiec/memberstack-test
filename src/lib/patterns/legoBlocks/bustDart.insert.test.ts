import { describe, expect, it } from "vitest";
import {
  calculateBustDart,
  insertBustDartIntoFrontBodyDisplayRows,
  type BustDartPatternDisplayRow,
} from "./bustDart";
import {
  OPTIONAL_BUST_DART_TIP_ID,
  renderBustDartCustomizationPrintHtml,
  renderBustDartCustomizationScreenHtml,
} from "../bustDartFrontSlotHtml";

const helpers = {
  formatRc: (rc: number) => `RC: ${String(rc).padStart(3, "0")}`,
  knitToRcLine: (t: number) => `Knit to RC ${t}.`,
  knitRowsToRcLine: (rows: number, t: number) =>
    rows === 1 ? `Knit 1 row to RC ${t}.` : `Knit ${rows} rows to RC ${t}.`,
  knitRowsEvenToRcLine: (rows: number, t: number) =>
    rows === 1 ? `Knit 1 row even to RC ${t}.` : `Knit ${rows} rows even to RC ${t}.`,
};

describe("insertBustDartIntoFrontBodyDisplayRows", () => {
  it("splits knit-to-armhole BODY into dart sequence when active", () => {
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

    const out = insertBustDartIntoFrontBodyDisplayRows(rows, result, helpers);
    const slot = out.find((r) => r.kind === "bustDartCustomization");
    expect(slot?.kind).toBe("bustDartCustomization");
    if (slot?.kind === "bustDartCustomization") {
      expect(slot.active).toBe(true);
      expect(slot.instructionParagraphs.join("\n")).toMatch(/Work the short-row bust darts/);
      expect(slot.instructionParagraphs.join("\n")).toMatch(/On each side of the Front center/);
    }

    const bodyText = out
      .filter((r) => r.kind === "block")
      .flatMap((r) => (r.kind === "block" ? r.paragraphs : []))
      .join("\n");
    expect(bodyText).toContain("Knit 111 rows to RC 133.");
    expect(bodyText).toContain("Knit 7 rows even to RC 140.");
    expect(bodyText).toContain("Bind off.");

    const dartText =
      slot?.kind === "bustDartCustomization" ? slot.instructionParagraphs.join("\n") : "";
    expect(dartText).toMatch(/Reset the row counter to RC 133/);
    expect(dartText).not.toMatch(/Continue knitting across all stitches to RC/i);
    // Exactly one authoritative knit-to-armhole instruction (the post-dart BODY block).
    const continueToArmhole = [...bodyText.split("\n"), ...dartText.split("\n")].filter((line) =>
      /to RC 140/i.test(line),
    );
    expect(continueToArmhole).toEqual(["Knit 7 rows even to RC 140."]);
  });

  it("eligible women’s pattern without dart still splits and inserts Optional Bust Dart slot", () => {
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
    expect(inactive.active).toBe(false);
    expect(inactive.dartStartGarmentRc).toBe(133);

    const rows: BustDartPatternDisplayRow[] = [
      { kind: "section", title: "BODY" },
      { kind: "block", paragraphs: ["Knit to RC 140."] },
      { kind: "section", title: "ARMHOLE" },
      { kind: "block", paragraphs: ["Begin armhole shaping."] },
    ];
    const out = insertBustDartIntoFrontBodyDisplayRows(rows, inactive, helpers);
    const slot = out.find((r) => r.kind === "bustDartCustomization");
    expect(slot?.kind).toBe("bustDartCustomization");
    if (slot?.kind === "bustDartCustomization") {
      expect(slot.active).toBe(false);
      expect(slot.instructionParagraphs).toEqual([]);
      expect(slot.placementOffsetRows).toBe(7);
    }
    const bodyBlocks = out.filter((r) => r.kind === "block").map((r) => (r.kind === "block" ? r.paragraphs[0] : ""));
    expect(bodyBlocks[0]).toMatch(/Knit 111 rows to RC 133/);
    expect(bodyBlocks[1]).toMatch(/Knit 7 rows even to RC 140/);
  });

  it("does not mutate men’s / ineligible rows", () => {
    const rows: BustDartPatternDisplayRow[] = [
      { kind: "section", title: "BODY" },
      { kind: "block", paragraphs: ["Knit to RC 140."] },
    ];
    const men = calculateBustDart({
      enabled: true,
      cupSize: "C",
      sizeGroup: "men",
      stitchesPerInch: 5,
      rowsPerInch: 7,
      frontConstruction: "pullover",
      frontStitchCount: 100,
      armholeOpeningGarmentRc: 140,
      hemRows: 22,
      bodyToArmholeRows: 118,
    });
    const out = insertBustDartIntoFrontBodyDisplayRows(rows, men, helpers);
    expect(out).toEqual(rows);
  });
});

describe("bustDartFrontSlotHtml print/screen", () => {
  const base = {
    kind: "bustDartCustomization" as const,
    active: false,
    cupSize: null as string | null,
    dartStartGarmentRc: 133,
    armholeOpeningGarmentRc: 140,
    placementOffsetRows: 7,
    rowsFromHemToDartStart: 111,
    rowsFromDartToArmhole: 7,
    instructionParagraphs: [] as string[],
    errors: [] as string[],
  };

  it("screen shows Optional Bust Dart control when inactive", () => {
    const html = renderBustDartCustomizationScreenHtml(base);
    expect(html).toMatch(/Optional Bust Dart/);
    expect(html).toMatch(/Add Bust Dart/);
    expect(html).toMatch(/data-bust-dart-pattern-open/);
    expect(html).toMatch(/no-print/);
    expect(html).toMatch(new RegExp(`data-tip-id="${OPTIONAL_BUST_DART_TIP_ID}"`));
    expect(html).toMatch(/pattern-tip/);
    expect(html).toMatch(/pattern-print-personalization-never-print/);
  });

  it("active screen keeps Update/Remove and is not a dismissable tip", () => {
    const html = renderBustDartCustomizationScreenHtml({
      ...base,
      active: true,
      cupSize: "C",
      instructionParagraphs: ["Work the short-row bust darts, Cup C."],
    });
    expect(html).toMatch(/Update Bust Dart/);
    expect(html).toMatch(/Remove Bust Dart/);
    expect(html).toMatch(/data-bust-dart-active="true"/);
    expect(html).not.toMatch(/data-tip-id=/);
    expect(html).not.toMatch(/class="[^"]*pattern-tip/);
  });

  it("print omits inactive slot entirely", () => {
    expect(renderBustDartCustomizationPrintHtml(base)).toBe("");
  });

  it("print includes active dart heading and instructions; no controls", () => {
    const html = renderBustDartCustomizationPrintHtml({
      ...base,
      active: true,
      cupSize: "C",
      instructionParagraphs: [
        "Work the short-row bust darts, Cup C.",
        "On each side of the Front center, place 4 needles in hold.",
      ],
    });
    expect(html).toMatch(/Bust Dart \(Cup C\)/);
    expect(html).toMatch(/Work the short-row bust darts/);
    expect(html).not.toMatch(/data-bust-dart-pattern-open|Update Bust Dart|Remove Bust Dart/);
  });
});
