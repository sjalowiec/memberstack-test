import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  generateSleevelessBackPattern,
  LIFELINE_BEFORE_DIVIDING_NECKLINE_PLAIN,
  LIFELINE_GLOSSARY_ID,
} from "./sleevelessPatternOutput";
import { renderActiveShoulderChartIntroHtml } from "./neckShoulderShapingChartHtml";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";

const LIFELINE_PLAIN_LOWER = LIFELINE_BEFORE_DIVIDING_NECKLINE_PLAIN.toLowerCase();

function stripHtmlToPlain(html: string): string {
  return String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function necklineSectionRows(
  rows: readonly { kind: string; title?: string }[],
  title: "BACK NECKLINE & SHOULDERS" | "FRONT NECKLINE & SHOULDERS",
) {
  const idx = rows.findIndex((r) => r.kind === "section" && r.title === title);
  expect(idx).toBeGreaterThanOrEqual(0);
  const nextSection = rows.findIndex((r, i) => i > idx && r.kind === "section");
  return rows.slice(idx + 1, nextSection >= 0 ? nextSection : undefined);
}

function sectionTrustedAndParagraphText(
  sectionRows: readonly {
    kind: string;
    paragraphs?: string[];
    trustedParagraphs?: string[];
    tipId?: string;
    tipPresentation?: string;
  }[],
): string {
  return sectionRows
    .filter((r) => r.kind === "block")
    .flatMap((r) => [...(r.trustedParagraphs ?? []), ...(r.paragraphs ?? [])])
    .join("\n");
}

function countLifelineReminders(text: string): number {
  const plain = stripHtmlToPlain(text).toLowerCase();
  const matches = plain.match(/optional:\s*add a lifeline before dividing the neckline\./g);
  return matches?.length ?? 0;
}

const SLEEVELESS_BASE = {
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
  style: { recipientCategory: "misses", neckline: "round", frontStyle: "closed" },
  yarnGaugeMachine: {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  },
};

const DROP_SHOULDER_BASE = {
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
    },
  },
  yarnGaugeMachine: {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  },
  style: {
    construction: "drop-shoulder",
    frontStyle: "closed",
    neckline: "round",
  },
};

describe("neckline-section lifeline reminder", () => {
  it("sleeveless back: one lifeline reminder after the opening sentence with glossary link", () => {
    const result = generateSleevelessBackPattern(SLEEVELESS_BASE);
    const sectionText = sectionTrustedAndParagraphText(
      necklineSectionRows(result.displayRows, "BACK NECKLINE & SHOULDERS"),
    );
    expect(sectionText).toContain("Begin back neckline and shoulder shaping.");
    expect(countLifelineReminders(sectionText)).toBe(1);
    expect(sectionText).toContain(`data-glossary-id="${LIFELINE_GLOSSARY_ID}"`);
    expect(sectionText).toContain('data-term="lifeline"');
    expect(sectionText.indexOf("Begin back neckline and shoulder shaping.")).toBeLessThan(
      stripHtmlToPlain(sectionText).toLowerCase().indexOf(LIFELINE_PLAIN_LOWER),
    );
    expect(sectionText).not.toContain("pattern-quick-tip");
    expect(sectionText).not.toContain("sleeveless-lifeline-neck-shoulder");
  });

  it("sleeveless front pullover: one lifeline reminder near the top of the neckline section", () => {
    const result = generateSleevelessBackPattern(SLEEVELESS_BASE);
    const sectionText = sectionTrustedAndParagraphText(
      necklineSectionRows(result.frontDisplayRows, "FRONT NECKLINE & SHOULDERS"),
    );
    expect(countLifelineReminders(sectionText)).toBe(1);
    expect(sectionText).toContain(`data-glossary-id="${LIFELINE_GLOSSARY_ID}"`);
    expect(sectionText).toMatch(/Use the checklist below/i);
    expect(sectionText.toLowerCase().indexOf("use the checklist below")).toBeLessThan(
      stripHtmlToPlain(sectionText).toLowerCase().indexOf(LIFELINE_PLAIN_LOWER),
    );
  });

  it("sleeveless cardigan front: omits the lifeline reminder", () => {
    const result = generateSleevelessBackPattern({
      ...SLEEVELESS_BASE,
      style: { recipientCategory: "misses", neckline: "round", frontStyle: "open" },
    });
    const sectionText = sectionTrustedAndParagraphText(
      necklineSectionRows(result.frontDisplayRows, "FRONT NECKLINE & SHOULDERS"),
    );
    expect(countLifelineReminders(sectionText)).toBe(0);
  });

  it("drop-shoulder back: one lifeline reminder after Begin back neckline shaping.", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_BASE);
    const sectionText = sectionTrustedAndParagraphText(
      necklineSectionRows(result.displayRows, "BACK NECKLINE & SHOULDERS"),
    );
    expect(sectionText).toContain("Begin back neckline shaping.");
    expect(countLifelineReminders(sectionText)).toBe(1);
    expect(sectionText).toContain(`data-glossary-id="${LIFELINE_GLOSSARY_ID}"`);
    expect(sectionText.indexOf("Begin back neckline shaping.")).toBeLessThan(
      stripHtmlToPlain(sectionText).toLowerCase().indexOf(LIFELINE_PLAIN_LOWER),
    );
  });

  it("drop-shoulder front pullover: one lifeline reminder after the opening neckline sentence", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_BASE);
    const sectionText = sectionTrustedAndParagraphText(
      necklineSectionRows(result.frontDisplayRows, "FRONT NECKLINE & SHOULDERS"),
    );
    expect(countLifelineReminders(sectionText)).toBe(1);
    expect(sectionText).toContain(`data-glossary-id="${LIFELINE_GLOSSARY_ID}"`);
    expect(sectionText).toMatch(/for the neck\.|Shape the neck\./i);
  });

  it("does not duplicate the lifeline reminder inside the shaping chart intro checklist", () => {
    const chartHtml = renderActiveShoulderChartIntroHtml({
      localStartRcLabel: "RC:050",
      centerBindOffStitches: 10,
      includeWorkflowSteps: true,
    });
    expect(countLifelineReminders(chartHtml)).toBe(0);
    expect(chartHtml).toContain("Before Shaping");
    expect(chartHtml).toContain("Knit until Armhole RC reaches 050.");
  });

  it("includes the lifeline reminder in interactive and print neckline section output once each", () => {
    const sleeveless = generateSleevelessBackPattern(SLEEVELESS_BASE);
    const drop = generateDropShoulderPattern(DROP_SHOULDER_BASE);

    for (const [rows, title] of [
      [sleeveless.displayRows, "BACK NECKLINE & SHOULDERS"] as const,
      [sleeveless.frontDisplayRows, "FRONT NECKLINE & SHOULDERS"] as const,
      [drop.displayRows, "BACK NECKLINE & SHOULDERS"] as const,
      [drop.frontDisplayRows, "FRONT NECKLINE & SHOULDERS"] as const,
    ]) {
      const sectionText = sectionTrustedAndParagraphText(necklineSectionRows(rows, title));
      const printHtml = renderSleevelessPrintPieceHtml(rows, "");
      const printPlain = stripHtmlToPlain(printHtml);
      expect(countLifelineReminders(sectionText)).toBe(1);
      expect(countLifelineReminders(printPlain)).toBeGreaterThanOrEqual(1);
      expect(printPlain.toLowerCase()).toContain(LIFELINE_PLAIN_LOWER);
      expect(printHtml).toContain(`data-glossary-id="${LIFELINE_GLOSSARY_ID}"`);
      expect(printHtml).toMatch(
        /class="print-line">Optional: Add a[\s\S]*before dividing the neckline\./i,
      );
    }
  });
});
