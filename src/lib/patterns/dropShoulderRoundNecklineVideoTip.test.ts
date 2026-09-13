import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  DROP_SHOULDER_ROUND_NECKLINE_VIDEO_CONTENT_ID,
  DROP_SHOULDER_ROUND_NECKLINE_VIDEO_COPY,
  DROP_SHOULDER_ROUND_NECKLINE_VIDEO_HEADING,
  DROP_SHOULDER_ROUND_NECKLINE_VIDEO_TIP_ID,
  dropShoulderRoundNecklineVideoApplies,
  dropShoulderRoundNecklineVideoBodyHtml,
  dropShoulderRoundNecklineVideoRow,
  resolveDropShoulderRoundNecklineVideo,
} from "./dropShoulderRoundNecklineVideoTip";
import { patternTipWrapperHtml } from "./sleevelessPatternOutput";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import videosPublic from "../../data/videos-public.json";
import type { PublicVideoRow } from "../lessonVideo";

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

function dropShoulderPattern(style: {
  neckline: string;
  frontStyle: string;
  bodyShape?: string;
}): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedSize: 1,
      easeChoice: "standard",
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(
        WOMENS_SIZE_1_CHART_ROW,
        "standard",
        { bodyShape: style.bodyShape ?? "straight" },
      ),
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "misses",
      neckline: style.neckline,
      bodyShape: style.bodyShape ?? "straight",
      frontStyle: style.frontStyle,
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 6,
      availableNeedles: 200,
    },
  };
}

function isRoundNeckHelpTipRow(row: { kind: string; tipId?: string }): boolean {
  return row.kind === "block" && row.tipId === DROP_SHOULDER_ROUND_NECKLINE_VIDEO_TIP_ID;
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
    paragraphs?: string[];
    trustedParagraphs?: string[];
    rc?: string;
  }[],
): string {
  return rows
    .filter((r) => r.kind === "block")
    .map((r) => [r.rc ?? "", blockPlainText(r)].filter(Boolean).join(" "))
    .join("\n");
}

const tipModuleSource = readFileSync(
  join(__dirname, "dropShoulderRoundNecklineVideoTip.ts"),
  "utf8",
);
const outputModuleSource = readFileSync(join(__dirname, "dropShoulderPatternOutput.ts"), "utf8");

describe("dropShoulderRoundNecklineVideoTip unit", () => {
  it("resolves catalog content_id 2212 (title, Vimeo id, privacy hash, poster)", () => {
    const video = resolveDropShoulderRoundNecklineVideo();
    const row = (videosPublic as PublicVideoRow[]).find(
      (v) => String(v.content_id) === "2212",
    );
    expect(DROP_SHOULDER_ROUND_NECKLINE_VIDEO_CONTENT_ID).toBe(2212);
    expect(video).not.toBeNull();
    expect(row).toBeTruthy();
    expect(video!.id).toBe(String(row!.vimeo_id));
    expect(video!.title).toBe("Shallow Neckline, No Shoulder Shaping");
    expect(video!.privacyHash).toBe(row!.vimeo_hash);
    expect(video!.posterUrl).toBe(row!.posterUrl);
  });

  it("does not hard-code Vimeo id 1218264661 in the tip or Drop Shoulder generator", () => {
    expect(tipModuleSource).toContain("DROP_SHOULDER_ROUND_NECKLINE_VIDEO_CONTENT_ID = 2212");
    expect(tipModuleSource).toContain("sleevelessHelpVideoFromCatalog");
    expect(tipModuleSource).not.toContain("1218264661");
    expect(outputModuleSource).not.toContain("1218264661");
  });

  it("renders a closed-by-default Quick Tip that embeds the catalog player", () => {
    const video = resolveDropShoulderRoundNecklineVideo();
    expect(video).not.toBeNull();
    const body = dropShoulderRoundNecklineVideoBodyHtml(video);
    expect(body).toContain(`data-content-id="${DROP_SHOULDER_ROUND_NECKLINE_VIDEO_CONTENT_ID}"`);
    expect(body).toContain(`player.vimeo.com/video/${video!.id}`);
    expect(body).toContain(`h=${video!.privacyHash}`);
    expect(body).toContain(`data-poster-url="${video!.posterUrl}"`);
    expect(body).toContain(video!.title);
    expect(body).toContain(DROP_SHOULDER_ROUND_NECKLINE_VIDEO_COPY);
    expect(body).not.toContain("autoplay=1");
    expect(body).toContain("<iframe");

    const row = dropShoulderRoundNecklineVideoRow(video);
    expect(row).not.toBeNull();
    expect(row!.tipPresentation).toBe("quick-tip");
    expect(row!.tipHtmlIsFull).toBe(true);
    expect(row!.tipId).toBe(DROP_SHOULDER_ROUND_NECKLINE_VIDEO_TIP_ID);
    expect(row!.tipHtml).toContain("pattern-quick-tip__details");
    expect(row!.tipHtml).not.toContain("<details open");
    expect(row!.tipHtml).toContain(DROP_SHOULDER_ROUND_NECKLINE_VIDEO_HEADING);

    const html = patternTipWrapperHtml(row!);
    expect(html).toContain('class="pattern-tip pattern-quick-tip"');
    expect(html).toContain(`data-tip-id="${DROP_SHOULDER_ROUND_NECKLINE_VIDEO_TIP_ID}"`);
  });

  it("returns null when the catalog video cannot be resolved", () => {
    expect(dropShoulderRoundNecklineVideoRow(null)).toBeNull();
    expect(dropShoulderRoundNecklineVideoBodyHtml(null)).toBe("");
  });

  it("applies only to pullover round-neck shaping (not V-neck or cardigan)", () => {
    expect(
      dropShoulderRoundNecklineVideoApplies({
        isVNeck: false,
        isCardigan: false,
        hasRoundNeckShaping: true,
      }),
    ).toBe(true);
    expect(
      dropShoulderRoundNecklineVideoApplies({
        isVNeck: true,
        isCardigan: false,
        hasRoundNeckShaping: true,
      }),
    ).toBe(false);
    expect(
      dropShoulderRoundNecklineVideoApplies({
        isVNeck: false,
        isCardigan: true,
        hasRoundNeckShaping: true,
      }),
    ).toBe(false);
    expect(
      dropShoulderRoundNecklineVideoApplies({
        isVNeck: false,
        isCardigan: false,
        hasRoundNeckShaping: false,
      }),
    ).toBe(false);
  });
});

describe("drop shoulder round neckline helper — variant placement", () => {
  it("places the helper once on pullover FRONT, immediately before round-neck shaping", () => {
    const result = generateDropShoulderPattern(
      dropShoulderPattern({ neckline: "round", frontStyle: "closed" }),
    );
    const frontSection = necklineSectionRows(
      result.frontDisplayRows,
      "FRONT NECKLINE & SHOULDERS",
    );
    const videoIdx = frontSection.findIndex(isRoundNeckHelpTipRow);
    expect(videoIdx).toBeGreaterThan(-1);

    const after = blockPlainText(
      frontSection[videoIdx + 1] as { paragraphs?: string[]; trustedParagraphs?: string[] },
    );
    expect(after).toMatch(/center/i);
    expect(after).toMatch(/neck/i);

    expect(frontSection.filter(isRoundNeckHelpTipRow)).toHaveLength(1);
    expect(result.frontDisplayRows.filter(isRoundNeckHelpTipRow)).toHaveLength(1);
    expect(result.displayRows.filter(isRoundNeckHelpTipRow)).toHaveLength(0);
    expect(result.sleeveDisplayRows.filter(isRoundNeckHelpTipRow)).toHaveLength(0);
  });

  it("resolves video record 2212 in the generated pullover round pattern", () => {
    const video = resolveDropShoulderRoundNecklineVideo();
    const result = generateDropShoulderPattern(
      dropShoulderPattern({ neckline: "round", frontStyle: "closed" }),
    );
    const tip = result.frontDisplayRows.find(isRoundNeckHelpTipRow);
    expect(tip?.kind).toBe("block");
    if (tip?.kind === "block") {
      expect(tip.tipHtml).toContain(`data-content-id="${DROP_SHOULDER_ROUND_NECKLINE_VIDEO_CONTENT_ID}"`);
      expect(tip.tipHtml).toContain(`player.vimeo.com/video/${video!.id}`);
      expect(tip.tipHtml).toContain(`h=${video!.privacyHash}`);
      expect(tip.tipHtml).toContain(video!.title);
    }
  });

  it("also appears for shaped-body pullover round (neckline process is unchanged)", () => {
    const result = generateDropShoulderPattern(
      dropShoulderPattern({ neckline: "round", frontStyle: "closed", bodyShape: "shaped" }),
    );
    expect(result.frontDisplayRows.filter(isRoundNeckHelpTipRow)).toHaveLength(1);
  });

  it("does not appear for pullover V-neck", () => {
    const result = generateDropShoulderPattern(
      dropShoulderPattern({ neckline: "v", frontStyle: "closed" }),
    );
    expect(result.frontDisplayRows.filter(isRoundNeckHelpTipRow)).toHaveLength(0);
    expect(result.displayRows.filter(isRoundNeckHelpTipRow)).toHaveLength(0);
  });

  it("does not appear for cardigan round or V-neck (half-front CF process)", () => {
    const round = generateDropShoulderPattern(
      dropShoulderPattern({ neckline: "round", frontStyle: "open" }),
    );
    const vneck = generateDropShoulderPattern(
      dropShoulderPattern({ neckline: "v", frontStyle: "open" }),
    );
    expect(round.frontDisplayRows.filter(isRoundNeckHelpTipRow)).toHaveLength(0);
    expect(vneck.frontDisplayRows.filter(isRoundNeckHelpTipRow)).toHaveLength(0);
  });

  it("does not appear when neck/shoulder inputs are missing", () => {
    const result = generateDropShoulderPattern({
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 22,
          upper_arm: 12,
        },
      },
      style: {
        construction: "drop-shoulder",
        constructionAuthored: "drop-shoulder",
        recipientCategory: "misses",
        neckline: "round",
        frontStyle: "closed",
      },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 4,
        gaugeRowsPerInch: 6,
        availableNeedles: 200,
      },
    });
    expect(result.frontDisplayRows.filter(isRoundNeckHelpTipRow)).toHaveLength(0);
  });

  it("does not change front neckline shaping instruction copy", () => {
    const result = generateDropShoulderPattern(
      dropShoulderPattern({ neckline: "round", frontStyle: "closed" }),
    );
    const frontSection = necklineSectionRows(
      result.frontDisplayRows,
      "FRONT NECKLINE & SHOULDERS",
    );
    const text = collectShapingInstructionText(frontSection);
    expect(text).toMatch(/center/i);
    expect(text).toMatch(/neck/i);
    expect(text).not.toContain("Need help shaping the neckline");
    expect(text).not.toContain(String(DROP_SHOULDER_ROUND_NECKLINE_VIDEO_CONTENT_ID));
    const tip = frontSection.find(isRoundNeckHelpTipRow);
    expect(tip?.kind).toBe("block");
    if (tip?.kind === "block") {
      expect(blockPlainText(tip)).toBe("");
    }
  });
});
