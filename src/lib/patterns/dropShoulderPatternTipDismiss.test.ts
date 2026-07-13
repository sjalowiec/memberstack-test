import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID } from "./dropShoulderShoulderBindOffVideo";
import { DROP_SHOULDER_SLEEVE_CONSTRUCTION_CHOICE_TIP_ID } from "./dropShoulderSleeveConstruction";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { patternTipWrapperHtml } from "./sleevelessPatternOutput";
import {
  dismissTipId,
  loadDismissedTipIds,
  restoreTipId,
} from "./patternTipDismiss";
import { stubLocalStorage } from "./test/stubLocalStorage";

const CHART_ROW: ChartRow = {
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
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(CHART_ROW, "standard", {
        bodyShape: "straight",
      }),
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "misses",
      neckline: "round",
      bodyShape: "straight",
      frontStyle: "closed",
    },
    yarnGaugeMachine: { gaugeStitchesPerInch: 4, gaugeRowsPerInch: 6, availableNeedles: 200 },
  };
}

const KEY = "test-drop-shoulder-tips";

describe("drop shoulder pattern tip ids", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("assigns a unique stable data-tip-id to every generated tip wrapper", () => {
    const result = generateDropShoulderPattern(womensPulloverRoundPattern());
    const tipRows = [
      ...result.displayRows,
      ...result.frontDisplayRows,
      ...result.sleeveDisplayRows,
    ].filter(
      (r): r is Extract<(typeof result.displayRows)[number], { kind: "block" }> =>
        r.kind === "block" && !!r.tipId,
    );

    const ids = tipRows.map((r) => r.tipId!);
    expect(new Set(ids).size).toBe(ids.length);

    const bindOff = tipRows.find((r) => r.tipId === DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID);
    expect(bindOff).toBeDefined();
    expect(bindOff?.tipHtml).toContain("Bind-Off Refresher");

    for (const row of tipRows) {
      const html = patternTipWrapperHtml(row);
      expect(html).toContain(`data-tip-id="${row.tipId}"`);
      expect(html.match(/data-tip-id="/g)?.length).toBe(1);
    }
  });

  it("dismissing a later front tip id does not dismiss Bind Off Refresher", () => {
    const result = generateDropShoulderPattern(womensPulloverRoundPattern());
    const frontMarker = result.frontDisplayRows.find(
      (r) => r.kind === "block" && r.tipId === "sleeveless-piece-markers-front",
    );
    expect(frontMarker?.kind).toBe("block");

    dismissTipId(KEY, "sleeveless-piece-markers-front");

    const dismissed = loadDismissedTipIds(KEY);
    expect(dismissed.has("sleeveless-piece-markers-front")).toBe(true);
    expect(dismissed.has(DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID)).toBe(false);

    restoreTipId(KEY, "sleeveless-piece-markers-front");
  });

  it("includes distinct ids for bind off refresher and sleeve construction choice tip", () => {
    expect(DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID).toBe(
      "drop-shoulder-shoulder-bind-off-video",
    );
    expect(DROP_SHOULDER_SLEEVE_CONSTRUCTION_CHOICE_TIP_ID).toBe(
      "drop-shoulder-sleeve-construction-choice",
    );
    expect(DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID).not.toBe(
      DROP_SHOULDER_SLEEVE_CONSTRUCTION_CHOICE_TIP_ID,
    );
  });
});
