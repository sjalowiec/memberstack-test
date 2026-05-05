/**
 * Dev-only wiring trace for neckline + shoulder chart / SVG (no formula changes).
 */

import { buildNeckShoulderShapingChartRows } from "./neckShoulderShapingChartRows";
import { calculateRoundNecklineShaping } from "./legoBlocks/roundNeckline";
import { buildTimeline, type RowEntry } from "./shapingTimeline";
import { renderShoulderShapingSvg } from "./shoulderShapingSvg";
import { neckShoulderShapingChartFromRows } from "./neckShoulderShapingChart";

export type NeckShoulderWiringDebugCase = {
  necklineStitches: number;
  shoulderStitchesPerSide: number;
  /** Total neckline section rows including center bind-off row. */
  neckDepthRows: number;
  firstShapingRow: number;
  /** B — stitches after armhole (N + 2× shoulder per side for symmetric split). */
  stitchesAfterArmhole: number;
};

/** Example from product: 53 sts, 38 per side; center bind-off / first timeline row = RC 249 (same RC as sleeveless front neckline start). */
export const DEBUG_CASE_FRONT_53: NeckShoulderWiringDebugCase = {
  necklineStitches: 53,
  shoulderStitchesPerSide: 38,
  neckDepthRows: 41,
  firstShapingRow: 249,
  stitchesAfterArmhole: 53 + 38 * 2,
};

function summarizeTimelineRow(e: RowEntry): string {
  const parts: string[] = [];
  for (const ev of e.events) {
    parts.push(`${ev.kind} ${ev.side} ${ev.edge} ×${ev.amount}`);
  }
  return `RC ${e.row}: ${parts.join("; ") || "(no events)"}`;
}

function svgActionSummaryFromTimeline(sorted: RowEntry[]): string[] {
  const lines: string[] = [];
  for (const e of sorted) {
    const inner = e.events.filter((x) => x.edge === "inner" && x.amount > 0);
    const outer = e.events.filter((x) => x.edge === "outer" && x.amount > 0);
    if (inner.length || outer.length) {
      lines.push(
        `RC ${e.row}: neck [${inner.map((x) => `${x.kind}×${x.amount}`).join(", ")}] shoulder [${outer.map((x) => `×${x.amount}`).join(", ")}]`
      );
    }
  }
  return lines;
}

/**
 * Printable trace: LEGO plan → timeline → chart rows → SVG HTML + action list.
 */
export function formatNeckShoulderWiringDebug(c: NeckShoulderWiringDebugCase): string {
  const plan = calculateRoundNecklineShaping({ necklineStitches: c.necklineStitches });
  const timeline = buildTimeline({
    firstShapingRow: c.firstShapingRow,
    shoulderStitchesPerSide: c.shoulderStitchesPerSide,
    centerNeckBindOff: c.necklineStitches,
    neckDepthRows: c.neckDepthRows,
    neckProfile: "back",
    stitchesAfterArmhole: c.stitchesAfterArmhole,
  });
  const chartRows = buildNeckShoulderShapingChartRows({
    firstShapingRow: c.firstShapingRow,
    shoulderStitchesPerSide: c.shoulderStitchesPerSide,
    centerNeckBindOff: c.necklineStitches,
    neckDepthRows: c.neckDepthRows,
    neckProfile: "back",
    stitchesAfterArmhole: c.stitchesAfterArmhole,
  });
  const chart = neckShoulderShapingChartFromRows(chartRows, { timeline });
  const svgHtml = renderShoulderShapingSvg(chart, "right");
  const svgActions = svgActionSummaryFromTimeline([...timeline].sort((a, b) => a.row - b.row));

  const parts: string[] = [];
  parts.push("=== calculateRoundNecklineShaping ===");
  parts.push(JSON.stringify(plan, null, 2));
  parts.push("");
  parts.push("=== buildTimeline (row summaries) ===");
  for (const row of timeline) {
    parts.push(summarizeTimelineRow(row));
  }
  parts.push("");
  parts.push("=== chart rows (leftNeck / rightNeck / sides) ===");
  for (const r of chartRows) {
    parts.push(
      `RC ${r.row} | ${r.action} | L arm ${r.leftSide} L neck ${r.leftNeck} C ${r.centerNeck} R neck ${r.rightNeck} R arm ${r.rightSide}`
    );
  }
  parts.push("");
  parts.push("=== SVG: timeline-derived neck/shoulder actions ===");
  parts.push(svgActions.join("\n"));
  parts.push("");
  parts.push("=== SVG HTML (length chars) ===");
  parts.push(`<svg>…</svg> length = ${svgHtml.length}`);

  return parts.join("\n");
}
