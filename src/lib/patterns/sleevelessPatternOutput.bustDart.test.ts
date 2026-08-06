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
    if (!inSection || row.kind !== "block") continue;
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
    expect(frontBody).toMatch(/Add bust darts \(cup C\)/i);
    expect(frontBody).toMatch(/1″ below the armhole/i);
    expect(frontBody).toMatch(/Place \d+ needles in hold/i);
    expect(backBody).not.toMatch(/bust dart/i);

    const armholeRc = r.debug.rowsFromCastOnToArmholeStart;
    const offset = inchesToRows(1, 7);
    expect(frontBody).toContain(`RC ${armholeRc - offset}`);
    expect(r.debug.hemRows + r.debug.bodyRows).toBe(armholeRc);
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
    expect(frontText).toMatch(/Add bust darts \(cup B\)/i);
    expect(frontText).toMatch(/side \(armhole\) edge/i);
    expect(frontText).toMatch(/RIGHT FRONT/i);
    expect(allParagraphs(r.displayRows).join("\n")).not.toMatch(/bust dart/i);
  });

  it("darts off: front BODY matches no-dart wording (no bust dart prose)", () => {
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

    expect(allParagraphs(withOff.frontDisplayRows).join("\n")).not.toMatch(/bust dart/i);
    expect(allParagraphs(withOff.frontDisplayRows).join("\n")).toBe(
      allParagraphs(legacy.frontDisplayRows).join("\n"),
    );
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
});
