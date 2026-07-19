/**
 * Regression: straight-shoulder Drop Shoulder back neckline (the browser case):
 *
 * BACK NECKLINE & SHOULDERS
 * RC: 000
 * Begin back neckline shaping.
 * Optional: Add a lifeline before dividing the neckline.
 * Drop-shoulder shoulders are worked straight — there is no shoulder shaping.
 * [Quick Tip]
 * RIGHT SIDE
 */
import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { ROUND_BACK_NECKLINE_SHAPING_VIDEO_TIP_ID } from "./roundBackNecklineShapingVideoTip";
import { patternTipWrapperHtml } from "./sleevelessPatternOutput";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

const STRAIGHT_SHOULDER_CHART: ChartRow = {
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

function straightShoulderDropShoulderPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedSize: 1,
      easeChoice: "standard",
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(
        STRAIGHT_SHOULDER_CHART,
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

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Mirror of sleevelessPatternPageShared instructionRowHtml tip handling. */
function simulateInteractiveBlockHtml(row: {
  tipHtml?: string;
  tipHtmlIsFull?: boolean;
  tipId?: string;
  tipPresentation?: "quick-tip" | "help-card";
  tipWrapperClass?: string;
  paragraphs?: string[];
  trustedParagraphs?: string[];
  rc?: string;
}): string {
  const leftBits: string[] = [];
  if (row.rc) leftBits.push(`<p class="sleeveless-pattern-rc">${row.rc}</p>`);
  const trusted = row.trustedParagraphs;
  if (trusted && trusted.length > 0) {
    for (const p of trusted) {
      const t = String(p).trim();
      if (t) leftBits.push(`<p class="sleeveless-pattern-line">${t}</p>`);
    }
  } else {
    for (const p of row.paragraphs ?? []) {
      const t = String(p).trim();
      if (t) leftBits.push(`<p class="sleeveless-pattern-line">${t}</p>`);
    }
  }
  if (row.tipHtml) {
    leftBits.push(patternTipWrapperHtml(row as Parameters<typeof patternTipWrapperHtml>[0]));
  }
  return leftBits.join("");
}

describe("straight-shoulder Drop Shoulder back neckline tip (browser regression)", () => {
  it("attaches the video Quick Tip to the intro block (after begin/lifeline/straight, before RIGHT SIDE)", () => {
    const result = generateDropShoulderPattern(straightShoulderDropShoulderPattern());
    const idx = result.displayRows.findIndex(
      (r) => r.kind === "section" && r.title === "BACK NECKLINE & SHOULDERS",
    );
    expect(idx).toBeGreaterThanOrEqual(0);

    const introIdx = result.displayRows.findIndex(
      (r, i) =>
        i > idx &&
        r.kind === "block" &&
        r.tipId === ROUND_BACK_NECKLINE_SHAPING_VIDEO_TIP_ID,
    );
    expect(introIdx).toBeGreaterThan(idx);

    const intro = result.displayRows[introIdx];
    expect(intro?.kind).toBe("block");
    if (intro?.kind !== "block") return;

    const plain = stripHtml((intro.trustedParagraphs ?? []).join(" "));
    expect(plain).toMatch(/Begin back neckline shaping/);
    expect(plain.toLowerCase()).toContain("lifeline before dividing the neckline");
    expect(plain).toMatch(/Drop-shoulder shoulders are worked straight/);
    expect(intro.rc).toMatch(/RC:\s*000/i);
    expect(intro.tipPresentation).toBe("quick-tip");
    expect(intro.tipHtmlIsFull).toBe(true);
    expect(intro.tipHtml).toContain("1211185343");
    expect(intro.tipHtml).toContain("Need help shaping the back neckline?");

    // Exactly one tip with this id (not a separate tip-only row plus intro).
    expect(
      result.displayRows.filter(
        (r) => r.kind === "block" && r.tipId === ROUND_BACK_NECKLINE_SHAPING_VIDEO_TIP_ID,
      ),
    ).toHaveLength(1);

    const after = result.displayRows[introIdx + 1];
    expect(after?.kind).toBe("block");
    if (after?.kind === "block") {
      expect((after.trustedParagraphs ?? []).join(" ")).toMatch(/RIGHT SIDE|subheading:RIGHT SIDE/);
      expect(after.tipId).not.toBe(ROUND_BACK_NECKLINE_SHAPING_VIDEO_TIP_ID);
    }
  });

  it("interactive renderer mirror emits tip HTML after intro copy on the same block", () => {
    const result = generateDropShoulderPattern(straightShoulderDropShoulderPattern());
    const intro = result.displayRows.find(
      (r) => r.kind === "block" && r.tipId === ROUND_BACK_NECKLINE_SHAPING_VIDEO_TIP_ID,
    );
    expect(intro?.kind).toBe("block");
    if (intro?.kind !== "block") return;
    const html = simulateInteractiveBlockHtml(intro);
    const introAt = html.search(/Begin back neckline shaping/i);
    const tipAt = html.indexOf("round-back-neckline-shaping-video");
    expect(introAt).toBeGreaterThan(-1);
    expect(tipAt).toBeGreaterThan(introAt);
    expect(html).toContain("1211185343");
    expect(html).toContain("Need help shaping the back neckline?");
  });

  it("print HTML places the tip between intro copy and RIGHT SIDE", () => {
    const result = generateDropShoulderPattern(straightShoulderDropShoulderPattern());
    const html = renderSleevelessPrintPieceHtml(result.displayRows, "");
    expect(html).toContain("1211185343");
    expect(html).toContain("Need help shaping the back neckline?");
    expect(html).toContain('data-tip-id="round-back-neckline-shaping-video"');

    const introAt = html.search(/Begin back neckline shaping/i);
    const tipAt = html.indexOf("round-back-neckline-shaping-video");
    const rightAt = html.search(/RIGHT SIDE/i);
    expect(introAt).toBeGreaterThan(-1);
    expect(tipAt).toBeGreaterThan(introAt);
    expect(rightAt).toBeGreaterThan(tipAt);
  });
});
