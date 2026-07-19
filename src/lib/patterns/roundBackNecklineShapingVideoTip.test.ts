import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  PATTERN_TIP_MEDIA_NO_PRINT_CLASS,
  ROUND_BACK_NECKLINE_SHAPING_VIDEO,
  ROUND_BACK_NECKLINE_SHAPING_VIDEO_TIP_ID,
  isBeginBackNecklineShapingLine,
  roundBackNecklineShapingVideoBodyHtml,
  roundBackNecklineShapingVideoRow,
  splitAfterRoundBackNecklineIntro,
} from "./roundBackNecklineShapingVideoTip";
import { patternTipWrapperHtml, generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { lifelineBeforeDividingNecklineReminderTrustedHtml } from "./sleevelessPatternOutput";

describe("roundBackNecklineShapingVideoTip unit", () => {
  it("exposes the hardcoded video metadata and copy", () => {
    expect(ROUND_BACK_NECKLINE_SHAPING_VIDEO).toEqual({
      vimeoId: "1211185343",
      title: "Shape a Round Back Neckline",
      summaryLabel: "Need help shaping the back neckline?",
      introText:
        "Watch a short demonstration of dividing the neckline and working each shoulder separately.",
    });
    expect(ROUND_BACK_NECKLINE_SHAPING_VIDEO_TIP_ID).toBe("round-back-neckline-shaping-video");
  });

  it("renders a closed-by-default Quick Tip with responsive Vimeo embed (no autoplay)", () => {
    const body = roundBackNecklineShapingVideoBodyHtml();
    expect(body).toContain("player.vimeo.com/video/1211185343");
    expect(body).not.toContain("autoplay=1");
    expect(body).toContain("<iframe");
    expect(body).toContain('title="Shape a Round Back Neckline"');
    expect(body).toContain(ROUND_BACK_NECKLINE_SHAPING_VIDEO.introText);
    expect(body).toContain(PATTERN_TIP_MEDIA_NO_PRINT_CLASS);

    const row = roundBackNecklineShapingVideoRow();
    expect(row.tipPresentation).toBe("quick-tip");
    expect(row.tipHtmlIsFull).toBe(true);
    expect(row.tipId).toBe(ROUND_BACK_NECKLINE_SHAPING_VIDEO_TIP_ID);
    expect(row.tipHtml).toContain("pattern-quick-tip__details");
    expect(row.tipHtml).not.toContain("<details open");
    expect(row.tipHtml).toContain("Need help shaping the back neckline?");

    const html = patternTipWrapperHtml(row);
    expect(html).toContain('class="pattern-tip pattern-quick-tip"');
    expect(html).toContain(`data-tip-id="${ROUND_BACK_NECKLINE_SHAPING_VIDEO_TIP_ID}"`);
    expect(html).toContain(PATTERN_TIP_MEDIA_NO_PRINT_CLASS);
  });

  it("splits summary lines after begin + lifeline intro", () => {
    const lifeline = lifelineBeforeDividingNecklineReminderTrustedHtml();
    const split = splitAfterRoundBackNecklineIntro([
      "Begin back neckline and shoulder shaping.",
      lifeline,
      "Place center neckline needles in hold.",
      "Use the checklist below for row-by-row neckline and shoulder shaping.",
    ]);
    expect(split).not.toBeNull();
    expect(split!.intro).toEqual([
      "Begin back neckline and shoulder shaping.",
      lifeline,
    ]);
    expect(split!.rest[0]).toMatch(/Place center neckline needles/i);
    expect(isBeginBackNecklineShapingLine("Begin back neckline shaping.")).toBe(true);
    expect(splitAfterRoundBackNecklineIntro(["Use the checklist below."])).toBeNull();
  });
});

const WOMENS_SIZE_1_CHART_ROW: ChartRow = {
  size: 1,
  bust_or_chest: 31.5,
  waist: 22.5,
  hip: 33.5,
  garment_back_length: 21,
  armhole_depth: 7,
  shoulder_width: 12,
  neck_opening: 6,
  front_neck_depth: 4,
  back_neck_depth: 1,
  upper_arm: 9.75,
  wrist: 5.25,
  sleeve_length: 16.25,
};

function dropShoulderRoundPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedSize: 1,
      easeChoice: "standard",
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(
        WOMENS_SIZE_1_CHART_ROW,
        "standard",
        { bodyShape: "straight" },
      ),
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "misses",
      neckline: "round",
      bodyShape: "straight",
      frontStyle: "closed",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 6,
      availableNeedles: 200,
    },
  };
}

function dropShoulderVNeckPattern(): Record<string, unknown> {
  return {
    ...dropShoulderRoundPattern(),
    style: {
      ...((dropShoulderRoundPattern().style as Record<string, unknown>) ?? {}),
      neckline: "v",
    },
  };
}

const SLEEVELESS_ROUND = {
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

const SLEEVELESS_V_NECK = {
  ...SLEEVELESS_ROUND,
  style: { recipientCategory: "misses", neckline: "v", frontStyle: "closed" },
};

function isRoundBackNeckVideoTipRow(row: { kind: string; tipId?: string }): boolean {
  return row.kind === "block" && row.tipId === ROUND_BACK_NECKLINE_SHAPING_VIDEO_TIP_ID;
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

function blockPlainText(row: {
  paragraphs?: string[];
  trustedParagraphs?: string[];
}): string {
  return [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])]
    .join("\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectShapingInstructionText(
  rows: readonly {
    kind: string;
    tipId?: string;
    tipHtml?: string;
    paragraphs?: string[];
    trustedParagraphs?: string[];
    rc?: string;
  }[],
): string {
  // Instruction prose only  ignore tipHtml (video tip may ride on the intro block).
  return rows
    .filter((r) => r.kind === "block")
    .map((r) => [r.rc ?? "", blockPlainText(r)].filter(Boolean).join(" "))
    .join("\n");
}

describe("round back neckline shaping video  Drop Shoulder integration", () => {
  it("places the video tip once on BACK on the intro block, before RIGHT SIDE", () => {
    const result = generateDropShoulderPattern(dropShoulderRoundPattern());
    const backSection = necklineSectionRows(result.displayRows, "BACK NECKLINE & SHOULDERS");
    const videoIdx = backSection.findIndex(isRoundBackNeckVideoTipRow);
    expect(videoIdx).toBeGreaterThan(-1);

    const intro = backSection[videoIdx] as {
      paragraphs?: string[];
      trustedParagraphs?: string[];
      tipHtml?: string;
    };
    const introText = blockPlainText(intro);
    expect(introText).toMatch(/Begin back neckline shaping/i);
    expect(introText.toLowerCase()).toContain("lifeline before dividing the neckline");
    expect(intro.tipHtml).toContain("1211185343");

    const after = blockPlainText(
      backSection[videoIdx + 1] as { paragraphs?: string[]; trustedParagraphs?: string[] },
    );
    expect(after).toMatch(/RIGHT SIDE/i);

    expect(backSection.filter(isRoundBackNeckVideoTipRow)).toHaveLength(1);
    expect(result.displayRows.filter(isRoundBackNeckVideoTipRow)).toHaveLength(1);
    expect(result.frontDisplayRows.filter(isRoundBackNeckVideoTipRow)).toHaveLength(0);
    expect(result.sleeveDisplayRows.filter(isRoundBackNeckVideoTipRow)).toHaveLength(0);
  });

  it("includes Vimeo ID 1211185343 for qualifying round back necklines", () => {
    const result = generateDropShoulderPattern(dropShoulderRoundPattern());
    const tip = result.displayRows.find(isRoundBackNeckVideoTipRow);
    expect(tip?.kind).toBe("block");
    if (tip?.kind === "block") {
      expect(tip.tipHtml).toContain("1211185343");
      expect(blockPlainText(tip)).toMatch(/Begin back neckline shaping/i);
    }
  });

  it("does not appear in front neckline output (round or V-neck)", () => {
    const round = generateDropShoulderPattern(dropShoulderRoundPattern());
    const vneck = generateDropShoulderPattern(dropShoulderVNeckPattern());
    expect(round.frontDisplayRows.filter(isRoundBackNeckVideoTipRow)).toHaveLength(0);
    expect(vneck.frontDisplayRows.filter(isRoundBackNeckVideoTipRow)).toHaveLength(0);
  });

  it("still appears on BACK when the garment front is V-neck (back remains divide-and-shape round)", () => {
    const result = generateDropShoulderPattern(dropShoulderVNeckPattern());
    expect(result.displayRows.filter(isRoundBackNeckVideoTipRow)).toHaveLength(1);
    expect(result.frontDisplayRows.filter(isRoundBackNeckVideoTipRow)).toHaveLength(0);
  });

  it("does not change neckline shaping instruction copy or RC schedule text", () => {
    const withTip = generateDropShoulderPattern(dropShoulderRoundPattern());
    const backSection = necklineSectionRows(withTip.displayRows, "BACK NECKLINE & SHOULDERS");
    const text = collectShapingInstructionText(backSection);
    expect(text).toMatch(/Begin back neckline shaping/i);
    expect(text).toMatch(/RIGHT SIDE/i);
    expect(text).toMatch(/LEFT SIDE/i);
    expect(text).toMatch(/The first shoulder is complete/i);
    // Video tip lives in tipHtml, not instruction paragraphs.
    const tip = backSection.find(isRoundBackNeckVideoTipRow);
    expect(tip?.kind).toBe("block");
    if (tip?.kind === "block") {
      expect(tip.tipHtml).toContain("1211185343");
      expect(blockPlainText(tip)).not.toContain("1211185343");
      expect(blockPlainText(tip)).not.toContain("Need help shaping the back neckline");
    }
  });
});

describe("round back neckline shaping video  Sleeveless integration", () => {
  it("places the video tip once on BACK after begin/lifeline and before first-shoulder setup", () => {
    const result = generateSleevelessBackPattern(SLEEVELESS_ROUND);
    const backSection = necklineSectionRows(result.displayRows, "BACK NECKLINE & SHOULDERS");
    const videoIdx = backSection.findIndex(isRoundBackNeckVideoTipRow);
    expect(videoIdx).toBeGreaterThan(-1);

    const before = blockPlainText(
      backSection[videoIdx - 1] as { paragraphs?: string[]; trustedParagraphs?: string[] },
    );
    expect(before).toMatch(/Begin back neckline and shoulder shaping/i);
    expect(before.toLowerCase()).toContain("lifeline before dividing the neckline");
    expect(before).not.toMatch(/Place center neckline needles/i);

    const after = blockPlainText(
      backSection[videoIdx + 1] as { paragraphs?: string[]; trustedParagraphs?: string[] },
    );
    expect(after).toMatch(/Place center neckline needles/i);
    expect(after).toMatch(/Work needles .* first/i);

    expect(backSection.filter(isRoundBackNeckVideoTipRow)).toHaveLength(1);
    expect(result.displayRows.filter(isRoundBackNeckVideoTipRow)).toHaveLength(1);
    expect(result.frontDisplayRows.filter(isRoundBackNeckVideoTipRow)).toHaveLength(0);
  });

  it("includes Vimeo ID 1211185343 for qualifying round back necklines", () => {
    const result = generateSleevelessBackPattern(SLEEVELESS_ROUND);
    const tip = result.displayRows.find(isRoundBackNeckVideoTipRow);
    expect(tip?.kind).toBe("block");
    if (tip?.kind === "block") {
      expect(tip.tipHtml).toContain("1211185343");
    }
  });

  it("does not appear in front neckline output", () => {
    const round = generateSleevelessBackPattern(SLEEVELESS_ROUND);
    const vneck = generateSleevelessBackPattern(SLEEVELESS_V_NECK);
    expect(round.frontDisplayRows.filter(isRoundBackNeckVideoTipRow)).toHaveLength(0);
    expect(vneck.frontDisplayRows.filter(isRoundBackNeckVideoTipRow)).toHaveLength(0);
  });

  it("still appears on BACK when the garment front is V-neck", () => {
    const result = generateSleevelessBackPattern(SLEEVELESS_V_NECK);
    expect(result.displayRows.filter(isRoundBackNeckVideoTipRow)).toHaveLength(1);
    expect(result.frontDisplayRows.filter(isRoundBackNeckVideoTipRow)).toHaveLength(0);
  });

  it("does not change neckline shaping instruction copy", () => {
    const result = generateSleevelessBackPattern(SLEEVELESS_ROUND);
    const backSection = necklineSectionRows(result.displayRows, "BACK NECKLINE & SHOULDERS");
    const text = collectShapingInstructionText(backSection);
    expect(text).toMatch(/Begin back neckline and shoulder shaping/i);
    expect(text).toMatch(/Place center neckline needles/i);
    expect(text).toMatch(/Use the checklist below/i);
    expect(text).not.toContain("1211185343");
    expect(text).not.toContain("Need help shaping the back neckline");
  });

  it("does not appear for non-qualifying back necklines (missing neck/shoulder inputs)", () => {
    const result = generateSleevelessBackPattern({
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 22,
          armhole_depth: 8,
        },
      },
      style: { recipientCategory: "misses", neckline: "round", frontStyle: "closed" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
    });
    expect(result.displayRows.filter(isRoundBackNeckVideoTipRow)).toHaveLength(0);
    const backText = collectShapingInstructionText(
      necklineSectionRows(result.displayRows, "BACK NECKLINE & SHOULDERS"),
    );
    expect(backText).toMatch(/Set neck opening width/i);
  });
});
