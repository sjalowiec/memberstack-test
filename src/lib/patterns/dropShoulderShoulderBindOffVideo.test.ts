import { describe, expect, it } from "vitest";
import {
  DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO,
  DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID,
  dropShoulderShoulderBindOffVideoBodyHtml,
  dropShoulderShoulderBindOffVideoRow,
} from "./dropShoulderShoulderBindOffVideo";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { patternTipWrapperHtml } from "./sleevelessPatternOutput";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

describe("dropShoulderShoulderBindOffVideo", () => {
  it("exposes the hardcoded video metadata", () => {
    expect(DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO).toEqual({
      vimeoId: "1208746621",
      title: "My Favorite Bind Off",
      duration: "1:20",
      heading: "Bind-Off Refresher",
    });
  });

  it("renders the Vimeo embed with title and duration in the tip body", () => {
    const body = dropShoulderShoulderBindOffVideoBodyHtml();
    expect(body).toContain("player.vimeo.com/video/1208746621");
    expect(body).toContain("<iframe");
    expect(body).toContain('title="My Favorite Bind Off"');
    expect(body).toContain("My Favorite Bind Off");
    expect(body).toContain("1:20");
  });

  it("builds a collapsible Quick Tip display row (screen-only, dismissible)", () => {
    const row = dropShoulderShoulderBindOffVideoRow();
    expect(row.kind).toBe("block");
    expect(row.paragraphs).toEqual([]);
    expect(row.tipPresentation).toBe("quick-tip");
    expect(row.tipHtmlIsFull).toBe(true);
    expect(row.tipId).toBe(DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID);
    // Screen-only: omitted from print via the shared never-print tip hook.
    expect(row.tipWrapperClass).toContain("pattern-print-personalization-never-print");
    // Heading is the collapsed summary label; embed lives in the expandable body.
    expect(row.tipHtml).toContain("Bind-Off Refresher");
    expect(row.tipHtml).toContain("player.vimeo.com/video/1208746621");
  });

  it("renders as a Pattern Tip wrapper (collapsible quick-tip)", () => {
    const html = patternTipWrapperHtml(dropShoulderShoulderBindOffVideoRow());
    expect(html).toContain('class="pattern-tip pattern-quick-tip pattern-print-personalization-never-print"');
    expect(html).toContain(`data-tip-id="${DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID}"`);
    expect(html).toContain("pattern-quick-tip__details");
    expect(html).toContain("Bind-Off Refresher");
    expect(html).toContain("<iframe");
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

function womensPulloverRoundPattern(): Record<string, unknown> {
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

function isVideoTipRow(row: {
  kind: string;
  tipId?: string;
}): boolean {
  return row.kind === "block" && row.tipId === DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID;
}

describe("drop shoulder pattern integration", () => {
  it("places the video Pattern Tip once, in BACK, immediately before the shoulder bind-off", () => {
    const result = generateDropShoulderPattern(womensPulloverRoundPattern());

    const rows = result.displayRows;
    const videoIdx = rows.findIndex(isVideoTipRow);
    expect(videoIdx).toBeGreaterThan(-1);

    // Rendered through the shared Pattern Tip system as a collapsible quick tip.
    const videoRow = rows[videoIdx];
    expect(videoRow.kind).toBe("block");
    if (videoRow.kind === "block") {
      expect(videoRow.tipPresentation).toBe("quick-tip");
      expect(videoRow.tipHtmlIsFull).toBe(true);
    }

    // The next block is the shoulder bind-off instructions.
    const next = rows[videoIdx + 1];
    expect(next.kind).toBe("block");
    if (next.kind === "block") {
      const text = (next.trustedParagraphs ?? next.paragraphs).join(" ");
      expect(text).toContain("Begin back neckline shaping.");
    }

    // Appears exactly once, and only in the BACK piece.
    expect(rows.filter(isVideoTipRow).length).toBe(1);
    expect(result.frontDisplayRows.filter(isVideoTipRow).length).toBe(0);
    expect(result.sleeveDisplayRows.filter(isVideoTipRow).length).toBe(0);
  });
});
