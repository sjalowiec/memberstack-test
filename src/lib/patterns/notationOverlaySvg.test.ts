import { describe, expect, it } from "vitest";
import { neckShoulderShapingChartFromRows } from "./neckShoulderShapingChart";
import { neckShoulderChartRowsFromTimeline } from "./neckShoulderShapingChartRows";
import {
  innerNeckDecreaseNotationLinesFromTimeline,
  renderNotationOverlayDiagram,
} from "./notationOverlaySvg";
import type { RowEntry, ShapingEvent } from "./shapingTimeline";
import { DEMO_NECK_SHOULDER_SHAPING_CHART } from "./neckShoulderShapingChart";

function neckLabelsFromOverlayHtml(html: string): string[] {
  const m = html.match(/ns-notation-overlay__stack--neck[^>]*>([\s\S]*?)<\/div>/);
  if (!m?.[1]) return [];
  return [...m[1].matchAll(/class="ns-notation-overlay__label">([^<]*)/g)].map((x) => String(x[1]));
}

function stubRow(rc: number, innerRight: number): RowEntry {
  const ev: ShapingEvent[] =
    innerRight > 0
      ? [{ kind: "decrease", side: "right", edge: "inner", amount: innerRight }]
      : [];
  return {
    row: rc,
    events: ev,
    stitchesL: 30,
    stitchesR: 30,
    netChangeL: 0,
    netChangeR: innerRight > 0 ? -innerRight : 0,
    isSplit: true,
    centerWidth: 10,
    leftOuterEdge: 1,
    leftInnerEdge: 10,
    rightInnerEdge: 20,
    rightOuterEdge: 30,
  };
}

describe("innerNeckDecreaseNotationLinesFromTimeline", () => {
  it("returns 1s-1r-26x for 26 consecutive single-stitch inner-neck decreases", () => {
    const tl: RowEntry[] = Array.from({ length: 26 }, (_, i) => stubRow(500 + i, 1));
    expect(innerNeckDecreaseNotationLinesFromTimeline(tl, "right")).toEqual(["1s-1r-26x"]);
  });

  it("groups by interval change only (mixed gaps)", () => {
    const tl: RowEntry[] = [
      stubRow(10, 1),
      stubRow(12, 1),
      stubRow(14, 1),
      stubRow(15, 1),
      stubRow(16, 1),
    ];
    expect(innerNeckDecreaseNotationLinesFromTimeline(tl, "right")).toEqual(["1s-2r-3x", "1s-1r-2x"]);
  });
});

describe("renderNotationOverlayDiagram V-neck inner-neck path", () => {
  it("injects timeline-based neck notation when innerNeckNotationFromTimeline is true", () => {
    const tl: RowEntry[] = Array.from({ length: 26 }, (_, i) => stubRow(100 + i, 1));
    const rows = neckShoulderChartRowsFromTimeline(tl);
    const chart = neckShoulderShapingChartFromRows(rows, { timeline: tl });
    const html = renderNotationOverlayDiagram(chart, "right", {
      innerNeckNotationFromTimeline: true,
      outlineImageSrc: "/images/patterns/shoulder-front-icon-v.svg",
    });
    expect(neckLabelsFromOverlayHtml(html)).toEqual(["1s-1r-26x"]);
  });

  it("leaves round-neck demo neck notation unchanged when timeline is absent (flag ignored)", () => {
    const htmlFlag = renderNotationOverlayDiagram(DEMO_NECK_SHOULDER_SHAPING_CHART, "right", {
      innerNeckNotationFromTimeline: true,
    });
    const htmlBase = renderNotationOverlayDiagram(DEMO_NECK_SHOULDER_SHAPING_CHART, "right");
    expect(neckLabelsFromOverlayHtml(htmlFlag)).toEqual(neckLabelsFromOverlayHtml(htmlBase));
    expect(neckLabelsFromOverlayHtml(htmlBase).length).toBeGreaterThan(0);
  });
});
