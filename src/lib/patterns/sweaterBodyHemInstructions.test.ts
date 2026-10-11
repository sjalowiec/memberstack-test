import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { generateSleevelessBackPattern, formatRcColon } from "./sleevelessPatternOutput";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import { buildSidewaysCardiganBodyInstructions } from "./sidewaysCardiganBodyInstructions";
import {
  sidewaysFoldedHemCastOnSentence,
  sidewaysFoldedHemTurningNeedle,
} from "./sidewaysCardiganFinishing";
import {
  buildSidewaysCardiganBodyDisplayRows,
  buildSidewaysPulloverBodyDisplayRows,
} from "./sidewaysCardiganPatternOutput";
import { SIDEWAYS_HUNG_HEM_GLOSSARY_ID } from "./sidewaysCardiganSleeveCuffCopy";
import { calculateSetInSleeveSweater } from "./setInSleeve/setInSleeveSweaterMath";
import {
  generateSetInSleeveInstructions,
  setInSleeveInstructionSection,
} from "./setInSleeve/setInSleeveInstructions";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import {
  finishedHemRowCounterLabel,
  SIDEWAYS_BODY_HEM_ROW_COUNTER_NOTE,
  sidewaysBodyHemChoiceLines,
  sweaterBodyHemChoiceLines,
} from "./sweaterBodyHemInstructions";

const MISSES: ChartRow = {
  bust_or_chest: 36,
  hip: 38,
  garment_back_length: 23,
  armhole_depth: 8,
  shoulder_width: 14,
  neck_opening: 7,
  front_neck_depth: 4.5,
  back_neck_depth: 1,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

function hemSectionText(rows: readonly SleevelessPatternDisplayRow[]): string {
  const start = rows.findIndex((row) => row.kind === "section" && row.title === "HEM");
  const parts: string[] = [];
  for (let i = start + 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.kind === "section") break;
    if (row.kind === "block") {
      parts.push(...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? []));
    }
  }
  return parts.join("\n").replace(/<[^>]+>/g, "");
}

function bodyStartRc(rows: readonly SleevelessPatternDisplayRow[]): string | undefined {
  const start = rows.findIndex((row) => row.kind === "section" && row.title === "BODY");
  const block = rows.slice(start + 1).find((row) => row.kind === "block" && row.rc);
  return block && block.kind === "block" ? block.rc : undefined;
}

describe("bottom-up body hem choices", () => {
  it("doubles folded hems and returns the counter to the finished hem reading", () => {
    const lines = sweaterBodyHemChoiceLines(122, 12, { plainText: true });
    const text = lines.join("\n");
    expect(text).toContain("The finished hem is 122 stitches and 12 rows deep.");
    expect(text).toContain(
      "1. Work 12 rows of ribbing in the needle arrangement of your choice. When the hem is complete, the row counter shows RC: 012.",
    );
    expect(text).toContain("2. Knit a hung hem for 24 rows so the hem can be folded. Reset the row counter to RC: 012.");
    expect(text).toContain(
      "3. Knit mock ribbing for 24 rows so the hem can be folded. Reset the row counter to RC: 012.",
    );
    expect(text).toContain(
      "4. Hand knit ribbing to the desired finished hem depth, then hang its stitches on the machine to continue the body. Set the row counter to RC: 012.",
    );
    expect(text).not.toContain("Reset row counter to RC: 000");
    expect(text).not.toContain("Reset row counter to RC 000");
    expect(finishedHemRowCounterLabel(12)).toBe(formatRcColon(12));
  });

  it("uses the singular row word and keeps a one-row finished hem", () => {
    const text = sweaterBodyHemChoiceLines(40, 1, { plainText: true }).join("\n");
    expect(text).toContain("1 row deep");
    expect(text).toContain("Work 1 row of ribbing");
    expect(text).toContain("for 2 rows so the hem can be folded");
    expect(text).toContain("RC: 001");
    expect(text).not.toContain("Reset the row counter to RC: 000");
  });

  it("prefixes set-in lines with RC: 000 and keeps the finished depth", () => {
    const text = sweaterBodyHemChoiceLines(80, 16, {
      plainText: true,
      rcPrefix: "RC: 000",
      finishedDepthLabel: "2.00 in",
    }).join("\n");
    expect(text).toContain("RC: 000 The finished hem is 80 stitches and 16 rows deep (2.00 in).");
    expect(text).toContain("RC: 000 2. Knit a hung hem for 32 rows");
    expect(text).toContain("Reset the row counter to RC: 016.");
  });
});

describe("sideways body hem choices", () => {
  it("keeps the turning needle and does not reset the row counter", () => {
    const needle = 6;
    const lines = sidewaysBodyHemChoiceLines(needle, "misses", { plainText: true });
    const text = lines.join("\n");
    expect(text).toContain(SIDEWAYS_BODY_HEM_ROW_COUNTER_NOTE);
    expect(text).toContain(sidewaysFoldedHemCastOnSentence(needle, "misses"));
    expect(text).toContain("Work ribbing for about 1 inch along the hem edge.");
    expect(text).toContain("twice the finished hem depth so the hem can be folded.");
    expect(text).toContain("Hand knit ribbing to the desired finished hem depth and sew it to the hem edge.");
    expect(text).not.toContain("Reset the row counter");
    expect(text).not.toContain("for 12 rows");
  });
});

describe("sweater pattern hem instructions", () => {
  it("keeps set-in body shaping on the finished hem reading", () => {
    const calculated = calculateSetInSleeveSweater({
      chartAudience: "misses",
      chartRow: MISSES,
      stitchesPerInch: 7,
      rowsPerInch: 10,
      availableNeedles: 400,
    });
    expect(calculated.ok).toBe(true);
    if (!calculated.ok) return;
    const doc = generateSetInSleeveInstructions(calculated);
    const back = setInSleeveInstructionSection(doc, "back");
    const hemRows = calculated.body.hemRows;
    const armholeRc = hemRows + calculated.body.rowsToArmhole;
    expect(back).toContain(`Cast on ${calculated.body.bodyBlock.hemStitches} stitches for the back.`);
    expect(back).toContain(`RC: 000 The finished hem is ${calculated.body.bodyBlock.hemStitches} stitches and ${hemRows} rows deep`);
    expect(back).toContain(`hung hem for ${hemRows * 2} rows so the hem can be folded. Reset the row counter to ${formatRcColon(hemRows)}.`);
    expect(back).toContain(`Knit in pattern to ${formatRcColon(armholeRc)}.`);
    expect(back.indexOf("Choose one way to work it:")).toBeLessThan(
      back.indexOf(`Knit in pattern to ${formatRcColon(armholeRc)}.`),
    );
  });

  it("keeps drop-shoulder and sleeveless body counters on the finished hem", () => {
    const pattern = {
      fit: {
        sizingChart: "women",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 24,
          upper_arm: 16,
          wrist: 8,
          sleeve_length: 12,
          shoulder_width: 16,
          neck_opening: 7,
          back_neck_depth: 1,
          front_neck_depth: 4,
          armhole_depth: 8,
        },
      },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
      style: { construction: "drop-shoulder", frontStyle: "closed", neckline: "round" },
    };
    const drop = generateDropShoulderPattern(pattern);
    const sleeveless = generateSleevelessBackPattern(pattern);
    for (const result of [drop, sleeveless]) {
      const hem = hemSectionText(result.displayRows);
      const folded = result.debug.hemRows * 2;
      expect(hem).toContain(`Work ${result.debug.hemRows} rows of ribbing`);
      expect(hem).toContain(`hung hem for ${folded} rows so the hem can be folded`);
      expect(hem).toContain(`Reset the row counter to ${formatRcColon(result.debug.hemRows)}.`);
      expect(hem).toContain(`Set the row counter to ${formatRcColon(result.debug.hemRows)}.`);
      expect(hem).toContain("hung hem");
      const hemBlock = result.displayRows.find(
        (row, index) =>
          row.kind === "block" &&
          result.displayRows.slice(0, index).some((earlier) => earlier.kind === "section" && earlier.title === "HEM"),
      );
      expect(hemBlock && hemBlock.kind === "block" ? hemBlock.trustedParagraphs?.join("\n") : "").toContain(
        `data-glossary-id="${SIDEWAYS_HUNG_HEM_GLOSSARY_ID}"`,
      );
      expect(bodyStartRc(result.displayRows)).toBe(formatRcColon(result.debug.hemRows));
      expect(result.debug.rowsFromCastOnToArmholeStart).toBe(result.debug.hemRows + result.debug.bodyRows);
    }
  });

  it("keeps sideways landmarks and the turning-needle hem", () => {
    const input = {
      garmentLengthInches: 22,
      vNeckDepthInches: 8,
      finishedBustCircumferenceInches: 40,
      finishedUpperArmInches: 14,
      neckOpeningWidthInches: 7,
      backNeckDepthInches: 1,
      stitchesPerInch: 5,
      rowsPerInch: 7,
    };
    const calc = calculateSidewaysCardiganBody(input);
    expect(calc.ok).toBe(true);
    if (!calc.ok) return;
    const cardigan = buildSidewaysCardiganBodyInstructions(input, "cardigan");
    const pullover = buildSidewaysCardiganBodyInstructions(input, "pullover");
    expect(cardigan.ok && pullover.ok).toBe(true);
    if (!cardigan.ok || !pullover.ok) return;
    const needle = sidewaysFoldedHemTurningNeedle(input.stitchesPerInch);
    const cardiganRows = buildSidewaysCardiganBodyDisplayRows(cardigan.instructions, input.stitchesPerInch);
    const pulloverRows = buildSidewaysPulloverBodyDisplayRows(pullover.instructions, input.stitchesPerInch);
    const visible = (rows: SleevelessPatternDisplayRow[]) =>
      rows
        .flatMap((row) => (row.kind === "block" ? [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])] : []))
        .join("\n")
        .replace(/<[^>]+>/g, "");
    for (const text of [visible(cardiganRows), visible(pulloverRows)]) {
      expect(text).toContain(sidewaysFoldedHemCastOnSentence(needle));
      expect(text).toContain(SIDEWAYS_BODY_HEM_ROW_COUNTER_NOTE);
      expect(text).not.toContain("Reset the row counter");
    }
    const firstV = cardiganRows.find(
      (row) => row.kind === "block" && row.bodyShapingChartId === "sideways-cardigan-first-v-neck",
    );
    expect(firstV && firstV.kind === "block" ? firstV.bodyShapingChartRows?.map((row) => row.rc) : []).toEqual(
      cardigan.instructions.firstV.actionRowCounters,
    );
    expect(pullover.instructions.landmarks.finalBindOff).toBe(pullover.instructions.calc.bust.actualTotalBustRows);
  });
});
