import { describe, expect, it } from "vitest";
import {
  DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO,
  DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID,
  PATTERN_TIP_MEDIA_NO_PRINT_CLASS,
  dropShoulderShoulderBindOffVideoBodyHtml,
  dropShoulderShoulderBindOffVideoRow,
} from "./dropShoulderShoulderBindOffVideo";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { isTipHiddenForPrint } from "./patternTipDismiss";
import { patternTipWrapperHtml } from "./sleevelessPatternOutput";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

class TipPrintStub {
  attrs: Record<string, string> = {};
  readonly classList: { contains: (name: string) => boolean };

  constructor(classes: string[] = []) {
    const set = new Set(classes);
    this.classList = { contains: (name: string) => set.has(name) };
  }

  getAttribute(name: string): string | null {
    return name in this.attrs ? this.attrs[name] : null;
  }

  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }

  removeAttribute(name: string): void {
    delete this.attrs[name];
  }

  hasAttribute(name: string): boolean {
    return name in this.attrs;
  }
}

function bindOffTipPrintStub(opts: { dismissed?: boolean } = {}): TipPrintStub {
  const tip = new TipPrintStub(["pattern-tip", "pattern-quick-tip"]);
  tip.setAttribute("data-tip-id", DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID);
  if (opts.dismissed) {
    tip.setAttribute("data-tip-dismissed", "true");
  }
  return tip;
}

function tipForIsTipHiddenForPrint(stub: TipPrintStub): HTMLElement {
  return stub as unknown as HTMLElement & {
    classList: { contains: (name: string) => boolean };
  };
}

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
    expect(body).toContain(PATTERN_TIP_MEDIA_NO_PRINT_CLASS);
    expect(body).toContain('class="ds-bindoff-video__caption"');
  });

  it("builds a collapsible Quick Tip display row (dismissible, printable like other tips)", () => {
    const row = dropShoulderShoulderBindOffVideoRow();
    expect(row.kind).toBe("block");
    expect(row.paragraphs).toEqual([]);
    expect(row.tipPresentation).toBe("quick-tip");
    expect(row.tipHtmlIsFull).toBe(true);
    expect(row.tipId).toBe(DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID);
    expect(row.tipWrapperClass).toBeUndefined();
    expect(row.tipHtml).toContain("Bind-Off Refresher");
    expect(row.tipHtml).toContain("player.vimeo.com/video/1208746621");
  });

  it("renders as a Pattern Tip wrapper without the never-print wrapper class", () => {
    const html = patternTipWrapperHtml(dropShoulderShoulderBindOffVideoRow());
    expect(html).toContain('class="pattern-tip pattern-quick-tip"');
    expect(html).not.toContain("pattern-print-personalization-never-print");
    expect(html).toContain(`data-tip-id="${DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID}"`);
    expect(html).toContain("pattern-quick-tip__details");
    expect(html).toContain("Bind-Off Refresher");
    expect(html).toContain(PATTERN_TIP_MEDIA_NO_PRINT_CLASS);
    expect(html).toContain("<iframe");
  });

  describe("print visibility (same rules as other pattern tips)", () => {
    it("prints when Show Tips is on and the tip is not dismissed", () => {
      const tip = bindOffTipPrintStub();
      expect(isTipHiddenForPrint(tipForIsTipHiddenForPrint(tip), true)).toBe(false);
    });

    it("does not print when Show Tips is off", () => {
      const tip = bindOffTipPrintStub();
      expect(isTipHiddenForPrint(tipForIsTipHiddenForPrint(tip), false)).toBe(true);
    });

    it("does not print when individually dismissed", () => {
      const tip = bindOffTipPrintStub({ dismissed: true });
      expect(isTipHiddenForPrint(tipForIsTipHiddenForPrint(tip), true)).toBe(true);
    });
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

    const videoRow = rows[videoIdx];
    expect(videoRow.kind).toBe("block");
    if (videoRow.kind === "block") {
      expect(videoRow.tipPresentation).toBe("quick-tip");
      expect(videoRow.tipHtmlIsFull).toBe(true);
      expect(videoRow.tipWrapperClass).toBeUndefined();
    }

    const next = rows[videoIdx + 1];
    expect(next.kind).toBe("block");
    if (next.kind === "block") {
      const text = (next.trustedParagraphs ?? next.paragraphs).join(" ");
      expect(text).toContain("Begin back neckline shaping.");
    }

    expect(rows.filter(isVideoTipRow).length).toBe(1);
    expect(result.frontDisplayRows.filter(isVideoTipRow).length).toBe(0);
    expect(result.sleeveDisplayRows.filter(isVideoTipRow).length).toBe(0);
  });
});
