import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { inchesToRows } from "./sleevelessRowAccounting";
import { BUST_DART_STYLE_KEY } from "./legoBlocks/bustDart";

function baseFit(overrides: Record<string, unknown> = {}) {
  return {
    finished_bust_chest: 40,
    back_neck_to_hem: 22,
    armhole_depth: 8,
    neck_opening: 3,
    shoulder_width: 4.25,
    front_neck_depth: 3,
    back_neck_depth: 1,
    ...overrides,
  };
}

function gauge() {
  return { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 };
}

function allParagraphs(rows: readonly SleevelessPatternDisplayRow[]): string[] {
  return rows.flatMap((row) => {
    if (row.kind === "bustDartCustomization") return row.instructionParagraphs ?? [];
    if (row.kind !== "block") return [];
    return [...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? [])];
  });
}

function sectionParagraphs(
  rows: readonly SleevelessPatternDisplayRow[],
  sectionTitle: string,
): string[] {
  const out: string[] = [];
  let inSection = false;
  for (const row of rows) {
    if (row.kind === "section") {
      inSection = row.title === sectionTitle;
      continue;
    }
    if (!inSection) continue;
    if (row.kind === "bustDartCustomization") {
      out.push(...(row.instructionParagraphs ?? []));
      continue;
    }
    if (row.kind !== "block") continue;
    out.push(...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? []));
  }
  return out;
}

describe("sleeveless bust darts integration", () => {
  it("women’s pullover with darts: front BODY includes dart; back does not", () => {
    const r = generateSleevelessBackPattern({
      fit: { sizingChart: "misses", selectedMeasurements: baseFit() },
      style: {
        recipientCategory: "misses",
        neckline: "round",
        frontStyle: "closed",
        [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "C" },
      },
      yarnGaugeMachine: gauge(),
    });

    const frontBody = sectionParagraphs(r.frontDisplayRows, "BODY").join("\n");
    const backBody = sectionParagraphs(r.displayRows, "BODY").join("\n");
    expect(frontBody).toMatch(/Stop the row counter at RC \d+, 1″ below the armhole opening/i);
    expect(frontBody).toMatch(/On each side of the Front center/i);
    expect(frontBody).toMatch(/1″ below the armhole/i);
    expect(frontBody).toMatch(/place \d+ needles in hold/i);
    expect(frontBody).not.toMatch(/Work the short-row bust darts/i);
    expect(frontBody).not.toMatch(/back or sleeves/i);
    expect(frontBody).not.toMatch(/front only/i);
    expect(backBody).not.toMatch(/bust dart/i);

    const armholeRc = r.debug.rowsFromCastOnToArmholeStart;
    const offset = inchesToRows(1, 7);
    expect(frontBody).toContain(`RC ${armholeRc - offset}`);
    expect(r.debug.hemRows + r.debug.bodyRows).toBe(armholeRc);

    const slot = r.frontDisplayRows.find((row) => row.kind === "bustDartCustomization");
    expect(slot?.kind).toBe("bustDartCustomization");
    if (slot?.kind === "bustDartCustomization") {
      expect(slot.cupSize).toBe("C");
      expect(slot.placementDistanceLabel).toBe("1″");
      const dartText = slot.instructionParagraphs.join("\n");
      expect(dartText).toMatch(/Reset the row counter to RC/);
      expect(dartText).not.toMatch(/Continue knitting across all stitches to RC/i);
      expect(dartText).not.toMatch(new RegExp(`to RC ${armholeRc} \\(armhole opening\\)`));
    }
    // Post-dart BODY block is the single continue-to-armhole instruction.
    const evenToArmhole = sectionParagraphs(r.frontDisplayRows, "BODY").filter((p) =>
      new RegExp(`Knit ${offset} rows even to RC ${armholeRc}`).test(p),
    );
    expect(evenToArmhole).toHaveLength(1);
  });

  it("women’s cardigan with darts: left front has dart + right-front mirror note", () => {
    const r = generateSleevelessBackPattern({
      fit: { sizingChart: "misses", selectedMeasurements: baseFit() },
      style: {
        recipientCategory: "misses",
        neckline: "round",
        frontStyle: "open",
        garmentStyle: "cardigan",
        [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "B" },
      },
      yarnGaugeMachine: gauge(),
    });

    const frontText = allParagraphs(r.frontDisplayRows).join("\n");
    expect(frontText).toMatch(/From the side \(armhole\) edge toward the Front center/i);
    expect(frontText).toMatch(/RIGHT FRONT/i);
    expect(frontText).not.toMatch(/Work the short-row bust darts/i);
    expect(frontText).not.toMatch(/On each side of the Front center/i);
    const slot = r.frontDisplayRows.find((row) => row.kind === "bustDartCustomization");
    expect(slot?.kind === "bustDartCustomization" && slot.cupSize).toBe("B");
    expect(allParagraphs(r.displayRows).join("\n")).not.toMatch(/bust dart/i);
  });

  it("darts off: eligible Front still splits at dart RC without dart knitting prose", () => {
    const withOff = generateSleevelessBackPattern({
      fit: { sizingChart: "misses", selectedMeasurements: baseFit() },
      style: {
        recipientCategory: "misses",
        neckline: "round",
        frontStyle: "closed",
        [BUST_DART_STYLE_KEY]: { enabled: false, cupSize: null },
      },
      yarnGaugeMachine: gauge(),
    });
    const legacy = generateSleevelessBackPattern({
      fit: { sizingChart: "misses", selectedMeasurements: baseFit() },
      style: { recipientCategory: "misses", neckline: "round", frontStyle: "closed" },
      yarnGaugeMachine: gauge(),
    });

    expect(allParagraphs(withOff.frontDisplayRows).join("\n")).not.toMatch(/Add bust darts/i);
    expect(allParagraphs(legacy.frontDisplayRows).join("\n")).not.toMatch(/Add bust darts/i);

    const offSlot = withOff.frontDisplayRows.find((r) => r.kind === "bustDartCustomization");
    const legacySlot = legacy.frontDisplayRows.find((r) => r.kind === "bustDartCustomization");
    expect(offSlot?.kind).toBe("bustDartCustomization");
    expect(legacySlot?.kind).toBe("bustDartCustomization");
    if (offSlot?.kind === "bustDartCustomization" && legacySlot?.kind === "bustDartCustomization") {
      expect(offSlot.active).toBe(false);
      expect(legacySlot.active).toBe(false);
      expect(offSlot.placementOffsetRows).toBe(legacySlot.placementOffsetRows);
    }

    const armholeRc = withOff.debug.rowsFromCastOnToArmholeStart;
    const offset = inchesToRows(1, 7);
    const body = sectionParagraphs(withOff.frontDisplayRows, "BODY").join("\n");
    expect(body).toContain(`RC ${armholeRc - offset}`);
    expect(body).toMatch(new RegExp(`Knit ${offset} rows even to RC ${armholeRc}`));
  });

  it("men’s pattern ignores enabled bust darts", () => {
    const r = generateSleevelessBackPattern({
      fit: { sizingChart: "men", selectedMeasurements: baseFit() },
      style: {
        recipientCategory: "men",
        neckline: "round",
        frontStyle: "closed",
        [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "C" },
      },
      yarnGaugeMachine: gauge(),
    });
    expect(allParagraphs(r.frontDisplayRows).join("\n")).not.toMatch(/bust dart/i);
  });

  it("inch and cm-stored gauges place the dart at the same garment RC", () => {
    // Same physical gauge: 5 sts/in and 7 rows/in, whether derived from a 4″ or 10 cm swatch.
    const inchGauge = {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    };
    const cmEquivalentGauge = {
      gaugeStitchesPerInch: (5 * 10) / 2.54 / (10 / 2.54), // = 5
      gaugeRowsPerInch: (7 * 10) / 2.54 / (10 / 2.54), // = 7
      availableNeedles: 200,
    };
    // Explicit cm→per-inch conversion: sts_per_10cm / 10 * 2.54
    const fromCmSwatch = {
      gaugeStitchesPerInch: (19.68503937007874 / 10) * 2.54, // ≈ 5
      gaugeRowsPerInch: (27.559055118110237 / 10) * 2.54, // ≈ 7
      availableNeedles: 200,
    };

    const inch = generateSleevelessBackPattern({
      fit: { sizingChart: "misses", selectedMeasurements: baseFit() },
      style: {
        recipientCategory: "misses",
        neckline: "round",
        frontStyle: "closed",
        [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "C" },
      },
      yarnGaugeMachine: inchGauge,
    });
    const cm = generateSleevelessBackPattern({
      fit: { sizingChart: "misses", selectedMeasurements: baseFit() },
      style: {
        recipientCategory: "misses",
        neckline: "round",
        frontStyle: "closed",
        [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "C" },
      },
      yarnGaugeMachine: fromCmSwatch,
    });

    expect(cmEquivalentGauge.gaugeStitchesPerInch).toBe(5);
    expect(cmEquivalentGauge.gaugeRowsPerInch).toBe(7);

    const inchRc = allParagraphs(inch.frontDisplayRows)
      .join("\n")
      .match(/Stop the row counter at RC (\d+)/)?.[1];
    const cmRc = allParagraphs(cm.frontDisplayRows)
      .join("\n")
      .match(/Stop the row counter at RC (\d+)/)?.[1];
    expect(inchRc).toBeDefined();
    expect(cmRc).toBe(inchRc);
    expect(inchesToRows(1, fromCmSwatch.gaugeRowsPerInch)).toBe(inchesToRows(1, 7));
  });

  it("print includes active dart instructions and omits inactive optional slot", async () => {
    const { renderSleevelessPrintPieceHtml } = await import("./sleevelessPatternPrintRender");
    const withDart = generateSleevelessBackPattern({
      fit: { sizingChart: "misses", selectedMeasurements: baseFit() },
      style: {
        recipientCategory: "misses",
        neckline: "round",
        frontStyle: "closed",
        [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "C" },
      },
      yarnGaugeMachine: gauge(),
    });
    const without = generateSleevelessBackPattern({
      fit: { sizingChart: "misses", selectedMeasurements: baseFit() },
      style: { recipientCategory: "misses", neckline: "round", frontStyle: "closed" },
      yarnGaugeMachine: gauge(),
    });

    const printWith = renderSleevelessPrintPieceHtml(withDart.frontDisplayRows, "", "front");
    const printWithout = renderSleevelessPrintPieceHtml(without.frontDisplayRows, "", "front");
    expect(printWith).toMatch(/>Bust Dart</);
    expect(printWith).toMatch(/Cup C/);
    expect(printWith).toMatch(/Stop the row counter at RC \d+, 1″ below the armhole opening/i);
    expect(printWith).toMatch(/On each side of the Front center/i);
    expect(printWith).toMatch(/bust-dart-front-slot__steps/);
    expect(printWith).not.toMatch(/Work the short-row bust darts/i);
    expect(printWith).not.toMatch(/back or sleeves/i);
    expect(printWith).not.toMatch(/data-bust-dart-pattern-open|Optional Bust Dart|Update Bust Dart|Remove Bust Dart/);
    expect(printWithout).not.toMatch(/Bust Dart|Optional Bust Dart|data-bust-dart/);
  });

  it("metric pattern shows cm placement and no inch symbol in dart instructions", () => {
    const r = generateSleevelessBackPattern({
      fit: { sizingChart: "misses", selectedMeasurements: baseFit() },
      style: {
        recipientCategory: "misses",
        neckline: "round",
        frontStyle: "closed",
        [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "C" },
      },
      yarnGauge: { gaugeRawUnit: "cm" },
      yarnGaugeMachine: { ...gauge(), gaugeRawUnit: "cm" },
    });
    const slot = r.frontDisplayRows.find((row) => row.kind === "bustDartCustomization");
    expect(slot?.kind).toBe("bustDartCustomization");
    if (slot?.kind === "bustDartCustomization") {
      expect(slot.measurementDisplayUnit).toBe("cm");
      expect(slot.placementDistanceLabel).toBe("2.5 cm");
      const dartText = slot.instructionParagraphs.join("\n");
      expect(dartText).toMatch(/2\.5 cm below the armhole opening/);
      expect(dartText).not.toMatch(/″/);
      expect(slot.dartStartGarmentRc).toBe(
        r.debug.rowsFromCastOnToArmholeStart - inchesToRows(1, 7),
      );
    }
  });
});
