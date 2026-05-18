import { describe, expect, it } from "vitest";
import {
  ARMHOLE_RC_FROM_RESET_NOTE,
  generateSleevelessBackPattern,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";

function basePattern(styleNeckline: string): Record<string, unknown> {
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
      neckline: styleNeckline,
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function collectParagraphs(rows: readonly SleevelessPatternDisplayRow[]): string[] {
  const out: string[] = [];
  for (const row of rows) {
    if (row.kind === "block") {
      out.push(...row.paragraphs);
    }
  }
  return out;
}

function armholeSectionParagraphs(rows: readonly SleevelessPatternDisplayRow[]): string[] {
  const out: string[] = [];
  let inArmhole = false;
  for (const row of rows) {
    if (row.kind === "section") {
      inArmhole = row.title === "ARMHOLE";
      continue;
    }
    if (!inArmhole || row.kind !== "block") continue;
    out.push(...row.paragraphs);
  }
  return out;
}

describe("sleeveless armhole RC wording", () => {
  it("back ARMHOLE section includes reset note and Armhole RC targets (not body RC)", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const armhole = armholeSectionParagraphs(r.displayRows);
    expect(armhole.some((p) => p.includes(ARMHOLE_RC_FROM_RESET_NOTE))).toBe(true);
    expect(
      armhole.some(
        (p) =>
          /Knit to Armhole RC:\d{3}/i.test(p) || /knit in pattern to Armhole RC:\d{3}/i.test(p)
      )
    ).toBe(true);
    expect(armhole.some((p) => /^Knit to RC:\d{3}\.$/i.test(p.trim()))).toBe(false);
    expect(armhole.some((p) => /^Knit to RC \d+\.$/i.test(p.trim()))).toBe(false);
  });

  it("V-neck front intro and milestone explain Armhole RC after reset", () => {
    const r = generateSleevelessBackPattern(basePattern("v-neck"));
    const frontParas = collectParagraphs(r.frontDisplayRows);
    expect(
      frontParas.some((p) => p.includes("After the armhole reset, use Armhole RC"))
    ).toBe(true);
    expect(
      frontParas.some((p) =>
        /row counter was reset at the beginning of armhole shaping/i.test(p)
      )
    ).toBe(true);
    expect(
      frontParas.some((p) => /Front neckline \(V-neck\) shaping begins at Armhole RC/i.test(p))
    ).toBe(true);
    const localNeck = r.debug.frontNecklineStartLocalRC;
    expect(localNeck).toBeDefined();
    const neckPadded = String(Math.max(0, Math.floor(localNeck!))).padStart(3, "0");
    expect(
      frontParas.some((p) => p.includes(`Armhole RC ${neckPadded}`) || p.includes(`Armhole RC ${localNeck}`))
    ).toBe(true);
  });

  it("round-neck front shares armhole reset note and Armhole RC targets", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const armhole = armholeSectionParagraphs(r.frontDisplayRows);
    expect(armhole.some((p) => p.includes(ARMHOLE_RC_FROM_RESET_NOTE))).toBe(true);
    expect(armhole.some((p) => /Armhole RC:\d{3}/i.test(p))).toBe(true);
  });

  it("body section still uses garment RC knit-to (not Armhole RC)", () => {
    const r = generateSleevelessBackPattern(basePattern("v-neck"));
    let inBody = false;
    let bodyKnitTo: string | undefined;
    for (const row of r.frontDisplayRows) {
      if (row.kind === "section" && row.title === "BODY") inBody = true;
      if (row.kind === "section" && row.title !== "BODY") inBody = false;
      if (!inBody || row.kind !== "block") continue;
      const p = row.paragraphs[0]?.trim() ?? "";
      if (/^Knit to /i.test(p)) bodyKnitTo = p;
    }
    expect(bodyKnitTo).toBeDefined();
    expect(bodyKnitTo).toMatch(/^Knit to RC \d+\.$/);
    expect(bodyKnitTo).not.toMatch(/Armhole/i);
  });
});
