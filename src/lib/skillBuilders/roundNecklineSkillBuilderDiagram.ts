import { buildShapingMapDataFromEdges, type ShapingMapEdgeEvent } from "../patterns/shapingMapFromEdges";
import {
  buildSecondShoulderInstructionTableRows,
  renderActiveSideChecklistHtml,
  type ActiveSideInstructionTableRow,
} from "../patterns/neckShoulderShapingChartHtml";
import {
  formatCenterBindOffChartLabel,
  renderShapingMapSvg,
  SHAPING_MAP_KNIT_ROW_HEIGHT_RATIO,
  type ShapingMapData,
} from "../patterns/shapingMapSvg";
import {
  SHAPING_ROW_COUNTER_START,
  type FirstShoulderRowAction,
  type RoundNecklineSkillBuilderResult,
} from "./roundNecklineSkillBuilders";

export type SkillBuilderShoulderSide = "left" | "right";

function parseAction(
  row: FirstShoulderRowAction,
): { stitches: number; kind: "bindOff" | "decrease" } | null {
  if (row.edge === "even") return null;
  const namedDecrease = /decrease/i.test(row.action);
  const stitches = namedDecrease
    ? 1
    : Number.parseInt(row.action.replace(/\D+/g, ""), 10) || 0;
  if (stitches <= 0) return null;
  const kind: "bindOff" | "decrease" =
    namedDecrease || stitches <= 1 ? "decrease" : "bindOff";
  return { stitches: kind === "decrease" ? 1 : stitches, kind };
}

function stepLabel(_kind: "bindOff" | "decrease", stitches: number): string {
  return `-${stitches}`;
}

function collectEdgeEvents(
  result: RoundNecklineSkillBuilderResult,
  includeOutsideLabels: boolean,
): {
  startRow: number;
  endRow: number;
  neckEvents: ShapingMapEdgeEvent[];
  shoulderEvents: ShapingMapEdgeEvent[];
} {
  const startRow = SHAPING_ROW_COUNTER_START;
  // Include the completion row so grid, RC labels, and row-span run through
  // neckDepthRows (RC 000 through RC 006 at 16/24 shallow back).
  const endRow = startRow + result.neckDepthRows;
  const neckEvents: ShapingMapEdgeEvent[] = [];
  const shoulderEvents: ShapingMapEdgeEvent[] = [];

  for (const row of result.firstShoulderRows) {
    const parsed = parseAction(row);
    if (!parsed) continue;
    const event = {
      row: row.row,
      stitches: parsed.stitches,
      kind: parsed.kind,
      label:
        row.edge === "neck" || (includeOutsideLabels && row.edge === "outside")
          ? stepLabel(parsed.kind, parsed.stitches)
          : "",
    };
    if (row.edge === "neck") neckEvents.push(event);
    else if (row.edge === "outside") shoulderEvents.push(event);
  }

  return { startRow, endRow, neckEvents, shoulderEvents };
}

function checklistAction(row: FirstShoulderRowAction): string {
  if (row.edge === "even") return "Knit even";
  if (/decrease/i.test(row.action)) return "Decrease 1 st";
  const amount = Number.parseInt(row.action.replace(/\D+/g, ""), 10) || 0;
  return amount > 0 ? `Bind off ${amount} sts` : row.action.replace(/\s+at the .+$/i, "").trim();
}

function checklistEdge(row: FirstShoulderRowAction): string {
  if (row.edge === "neck") return "Neck";
  if (row.edge === "outside") return "Shoulder";
  return row.row % 2 === 0 ? "Neck" : "Shoulder";
}

/**
 * Convert a generated Skill Builder worksheet into {@link ShapingMapData}.
 * Does not recalculate stitch/row counts — it only maps the worksheet events
 * onto the shared sweater-pattern shaping chart as a full symmetrical neckline.
 */
export function buildRoundNecklineSkillBuilderShapingMapData(
  result: RoundNecklineSkillBuilderResult,
): ShapingMapData {
  const { startRow, endRow, neckEvents, shoulderEvents } = collectEdgeEvents(result, false);

  return buildShapingMapDataFromEdges({
    title: `${result.exerciseTitle} shaping chart`,
    startRow,
    endRow,
    centerStitches: result.centerBindOffStitches,
    remainingStitches: result.finalShoulderStitches,
    shoulderMode: result.shoulderStyle,
    neckEvents,
    shoulderEvents,
    layout: "symmetrical",
    neckLabelSides: "left",
    shoulderLabelSides: "left",
    centerLabel: "",
    practicePiece: {
      evenRows: result.rowsBeforeNeckline,
      castOnStitches: result.castOnStitches,
      startingShoulderStitches: result.firstShoulderSectionStitches,
    },
    centerAnnotation: {
      bindOff: formatCenterBindOffChartLabel(result.centerBindOffStitches),
    },
  });
}

/** Sweater-style single-shoulder map for the working Left / Right checklist. */
export function buildRoundNecklineSkillBuilderShoulderMapData(
  result: RoundNecklineSkillBuilderResult,
): ShapingMapData {
  const { startRow, endRow, neckEvents, shoulderEvents } = collectEdgeEvents(result, true);

  return buildShapingMapDataFromEdges({
    title: `${result.exerciseTitle} shoulder shaping chart`,
    startRow,
    endRow,
    centerStitches: result.centerBindOffStitches,
    remainingStitches: result.finalShoulderStitches,
    shoulderMode: result.shoulderStyle,
    neckEvents,
    shoulderEvents,
    layout: "single-edge",
    centerLabel: "",
    edgeLabels: { shoulder: "Outside Edge", neck: "Neck Edge" },
  });
}

export function buildRoundNecklineSkillBuilderShoulderDiagramSvg(
  result: RoundNecklineSkillBuilderResult,
  side: SkillBuilderShoulderSide,
): string {
  return renderShapingMapSvg(buildRoundNecklineSkillBuilderShoulderMapData(result), {
    // Canonical single-edge data has the outside at the left and the neck at the right
    // (left shoulder on the machine). Mirror only the right-shoulder working chart.
    mirror: side === "right",
    rowHeightRatio: SHAPING_MAP_KNIT_ROW_HEIGHT_RATIO,
    rowNumberPad: 3,
    completionRowBand: true,
  });
}

export function buildRoundNecklineSkillBuilderLeftChecklistRows(
  result: RoundNecklineSkillBuilderResult,
): ActiveSideInstructionTableRow[] {
  const rows = result.firstShoulderRows.map((row) => ({
    rc: row.row,
    carriagePosition: row.row % 2 === 0 ? "Right" : "Left",
    action: checklistAction(row),
    edge: checklistEdge(row),
    stitchesRemaining: row.stitchesAfter,
  }));
  // Chart endRow is neckDepthRows (RC 006 at 16/24 shallow). Shaping rows stop
  // one RC earlier; append that completion knit-even so Finish comes after it.
  const completionRc = SHAPING_ROW_COUNTER_START + result.neckDepthRows;
  if (rows.at(-1)?.rc === completionRc) return rows;
  const last = rows.at(-1);
  rows.push({
    rc: completionRc,
    carriagePosition: completionRc % 2 === 0 ? "Right" : "Left",
    action: "Knit even",
    edge: "Shoulder",
    stitchesRemaining: last?.stitchesRemaining ?? result.finalShoulderStitches,
  });
  return rows;
}

export function buildRoundNecklineSkillBuilderRightChecklistRows(
  result: RoundNecklineSkillBuilderResult,
): ActiveSideInstructionTableRow[] {
  return buildSecondShoulderInstructionTableRows(
    buildRoundNecklineSkillBuilderLeftChecklistRows(result),
  );
}

export function buildRoundNecklineSkillBuilderBeforeYouBegin(
  result: RoundNecklineSkillBuilderResult,
): string {
  return `Follow the chart to cast on ${result.castOnStitches} sts and knit ${result.rowsBeforeNeckline} rows even. At the shaping row, break the yarn and scrap off the right shoulder stitches (${result.secondShoulderSectionStitches} sts). Join yarn at the center neck edge and bind off ${result.centerBindOffStitches} center stitches. Then knit and shape the left shoulder, followed by the right shoulder.`;
}

/**
 * Practice-piece diagram: the shared sweater-pattern shaping map, drawn to scale
 * as a full symmetrical neckline (both shoulders + center bind-off).
 */
export function buildRoundNecklineSkillBuilderDiagramSvg(
  result: RoundNecklineSkillBuilderResult,
): string {
  return renderShapingMapSvg(buildRoundNecklineSkillBuilderShapingMapData(result), {
    rowHeightRatio: SHAPING_MAP_KNIT_ROW_HEIGHT_RATIO,
    rowNumberPad: 3,
    completionRowBand: true,
  });
}

export function buildRoundNecklineSkillBuilderDiagramHtml(
  result: RoundNecklineSkillBuilderResult,
): string {
  const svg = buildRoundNecklineSkillBuilderDiagramSvg(result);
  return `<div class="shaping-map sb-shaping-map">
  <div class="shaping-map__scroll">${svg}</div>
</div>`;
}

export function buildRoundNecklineSkillBuilderShoulderWorkHtml(
  result: RoundNecklineSkillBuilderResult,
  side: SkillBuilderShoulderSide,
): { chartHtml: string; checklistHtml: string } {
  const svg = buildRoundNecklineSkillBuilderShoulderDiagramSvg(result, side);
  const rows =
    side === "left"
      ? buildRoundNecklineSkillBuilderLeftChecklistRows(result)
      : buildRoundNecklineSkillBuilderRightChecklistRows(result);
  const chartId = `sb-${result.builderId}-${result.exerciseId}-${side}`;
  return {
    chartHtml: `<div class="shaping-map sb-shaping-map sb-shaping-map--shoulder">
  <div class="shaping-map__scroll">${svg}</div>
</div>`,
    checklistHtml: renderActiveSideChecklistHtml(rows, chartId),
  };
}
