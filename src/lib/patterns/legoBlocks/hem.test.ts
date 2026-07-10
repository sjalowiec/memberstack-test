import { describe, expect, it } from "vitest";
import {
  HEM_GLOSSARY_ID,
  HEM_SECTION_TITLE,
  hemSectionHeadingHtml,
  hemSectionRow,
} from "./hem";
import { generateSleevelessBackPattern } from "../sleevelessPatternOutput";
import { generateDropShoulderPattern } from "../dropShoulderPatternOutput";
import type { SleevelessPatternDisplayRow } from "../sleevelessPatternOutput";

const SLEEVELESS_PATTERN = {
  fit: {
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
  style: { neckline: "round", frontStyle: "closed" },
  yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
};

const DROP_SHOULDER_PATTERN = {
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
  yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  style: { construction: "drop-shoulder", frontStyle: "closed", neckline: "round" },
};

function renderedText(rows: SleevelessPatternDisplayRow[]): string {
  const parts: string[] = [];
  for (const row of rows) {
    if (row.kind === "section") {
      parts.push(row.title);
      if (row.titleHtml) parts.push(row.titleHtml);
    } else if (row.kind === "block") {
      for (const p of row.paragraphs ?? []) parts.push(String(p));
      for (const p of row.trustedParagraphs ?? []) parts.push(String(p));
      if (row.tipHtml) parts.push(String(row.tipHtml));
    }
  }
  return parts.join("\n");
}

describe("shared HEM lego block", () => {
  it("uses HEM as the section title and links glossary id 1783693868473 on the heading", () => {
    expect(HEM_GLOSSARY_ID).toBe(1783693868473);
    expect(HEM_SECTION_TITLE).toBe("HEM");
    const section = hemSectionRow();
    expect(section.kind).toBe("section");
    expect(section.title).toBe("HEM");
    expect(section.titleHtml).toBe(hemSectionHeadingHtml());
    expect(section.titleHtml).toContain("glossary-tooltip-placeholder");
    expect(section.titleHtml).toContain(`data-glossary-id="${HEM_GLOSSARY_ID}"`);
    expect(section.titleHtml).toContain('data-term="HEM"');
  });

  it("exposes only the glossary-linked heading (no Hem Treatment help card markup)", () => {
    const section = hemSectionRow();
    expect(section.titleHtml ?? "").not.toContain("pattern-help-card");
    expect(section.titleHtml ?? "").not.toContain("Hem Treatment");
  });
});

describe("HEM section in generated patterns (heading only, no help card)", () => {
  it("sleeveless links the HEM glossary on the heading and renders no Hem Treatment help card", () => {
    const result = generateSleevelessBackPattern(SLEEVELESS_PATTERN);
    for (const rows of [result.displayRows, result.frontDisplayRows]) {
      const section = rows.find((r) => r.kind === "section" && r.title === "HEM");
      expect(section).toBeDefined();
      expect(section?.kind === "section" ? section.titleHtml : "").toContain(
        `data-glossary-id="${HEM_GLOSSARY_ID}"`,
      );
      const text = renderedText(rows);
      expect(text).not.toContain("RIBBED HEM");
      expect(text).not.toContain("Hem Treatment");
      expect(rows.some((r) => r.kind === "block" && r.tipId?.startsWith("pattern-hem"))).toBe(
        false,
      );
    }
  });

  it("drop shoulder links the HEM glossary on the heading and renders no Hem Treatment help card", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    for (const rows of [result.displayRows, result.frontDisplayRows]) {
      const section = rows.find((r) => r.kind === "section" && r.title === "HEM");
      expect(section).toBeDefined();
      expect(section?.kind === "section" ? section.titleHtml : "").toContain(
        `data-glossary-id="${HEM_GLOSSARY_ID}"`,
      );
      const text = renderedText(rows);
      expect(text).not.toContain("RIBBED HEM");
      expect(text).not.toContain("Hem Treatment");
      expect(rows.some((r) => r.kind === "block" && r.tipId?.startsWith("pattern-hem"))).toBe(
        false,
      );
    }
  });

  it("drop shoulder cardigan fronts render the HEM heading with no help card", () => {
    const result = generateDropShoulderPattern({
      ...DROP_SHOULDER_PATTERN,
      style: { ...DROP_SHOULDER_PATTERN.style, frontStyle: "open" },
    });
    const section = result.frontDisplayRows.find(
      (r) => r.kind === "section" && r.title === "HEM",
    );
    expect(section).toBeDefined();
    expect(renderedText(result.frontDisplayRows)).not.toContain("Hem Treatment");
  });

  it("no longer emits RIBBED HEM in plain-text lines for either pattern", () => {
    const sleeveless = generateSleevelessBackPattern(SLEEVELESS_PATTERN);
    const dropShoulder = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const sleevelessText = sleeveless.lines.join("\n");
    const dropShoulderText = dropShoulder.lines.join("\n");
    expect(sleevelessText).not.toContain("RIBBED HEM");
    expect(sleevelessText).toMatch(/(^|\n)HEM(\n|$)/);
    expect(dropShoulderText).not.toContain("RIBBED HEM");
    expect(dropShoulderText).toContain("-- HEM --");
  });

  it("preserves the pattern-specific cast-on stitch count outside the shared block", () => {
    const result = generateSleevelessBackPattern(SLEEVELESS_PATTERN);
    const castOn = result.displayRows.find(
      (r) => r.kind === "block" && r.paragraphs?.some((p) => /^Cast on \d+ stitches/.test(p)),
    );
    expect(castOn).toBeDefined();
  });
});
