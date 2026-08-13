/**
 * Generic adapter: bind-off / decrease events on one or two edges → {@link ShapingMapData}.
 *
 * Pattern-agnostic. Callers (Skill Builders, pattern instructions, help content) supply
 * already-calculated stitch/row events. This module does not know about sweaters or
 * Skill Builders and does not recompute shaping math.
 */

import type {
  ShapingMapData,
  ShapingMapLayout,
  ShapingMapPath,
  ShapingMapStep,
} from "./shapingMapSvg";

export type ShapingMapEdgeKind = "bindOff" | "decrease";

/** One shaping action on a single edge, at an absolute chart row number. */
export type ShapingMapEdgeEvent = {
  /** Machine / worksheet row where the action is worked. Must not be 0 unless the work starts at 0. */
  row: number;
  /** Stitches bound off or decreased (positive count). */
  stitches: number;
  kind: ShapingMapEdgeKind;
  /** Optional on-chart label. Defaults to `-{stitches}` (sweater-chart convention). */
  label?: string;
};

export type ShapingMapShoulderMode = "straight" | "shaped";

/** Which inner-edge (neck) sides receive on-chart BO/Dec labels in a symmetrical chart. */
export type ShapingMapNeckLabelSides = "left" | "right" | "both" | "none";

export type ShapingMapFromEdgesInput = {
  title?: string;
  /** Lowest row on the chart (bottom). Typically the neckline-starting row. */
  startRow: number;
  /** Highest row on the chart (top). Inclusive. */
  endRow: number;
  /** Center-neck bind-off at {@link startRow}. Omit or 0 when there is no center bind-off. */
  centerStitches?: number;
  /**
   * Stitches remaining at the shoulder after neck-edge shaping.
   * Straight: drawn as the top horizontal edge (not as outside-edge bind-off steps).
   * Shaped: the outside-edge events should consume this width.
   */
  remainingStitches?: number;
  shoulderMode: ShapingMapShoulderMode;
  /** Inner-edge (neck) actions. */
  neckEvents: readonly ShapingMapEdgeEvent[];
  /** Outer-edge (shoulder / armhole) bind-offs. Empty for a straight outside edge. */
  shoulderEvents?: readonly ShapingMapEdgeEvent[];
  edgeLabels?: {
    shoulder?: string;
    neck?: string;
  };
  /**
   * `symmetrical`: emit mirrored left and right paths with an optional center
   * bind-off gap between them. Default `single-edge` (one shoulder).
   */
  layout?: ShapingMapLayout;
  /**
   * When {@link layout} is `symmetrical`, which sides get neck-edge step labels.
   * Default `left` — repeating BO/Dec on both inner edges is usually too busy;
   * a compact legend below the chart can carry the full wording.
   */
  neckLabelSides?: ShapingMapNeckLabelSides;
  /**
   * Override the on-chart center bind-off callout. Pass `""` to hide it
   * (for example when a compact HTML legend below the chart carries the full text).
   */
  centerLabel?: string;
  /**
   * When {@link layout} is `symmetrical`, which sides get outside-shoulder step labels.
   * Default `both`. Pass `left` for a full-neckline overview that keeps the right half
   * as a clean visual mirror.
   */
  shoulderLabelSides?: ShapingMapNeckLabelSides;
  practicePiece?: ShapingMapData["practicePiece"];
  centerAnnotation?: ShapingMapData["centerAnnotation"];
};

function defaultStepLabel(event: ShapingMapEdgeEvent): string {
  if (event.label != null) return event.label;
  return `-${event.stitches}`;
}

function eventsToSteps(
  events: readonly ShapingMapEdgeEvent[],
  direction: "up" | "down",
): ShapingMapStep[] {
  const ordered =
    direction === "up"
      ? [...events].sort((a, b) => a.row - b.row)
      : [...events].sort((a, b) => b.row - a.row);
  const steps: ShapingMapStep[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const cur = ordered[i]!;
    const next = ordered[i + 1];
    const rows = next
      ? Math.max(0, direction === "up" ? next.row - cur.row : cur.row - next.row)
      : 0;
    if (cur.stitches <= 0) continue;
    steps.push({
      stitches: cur.stitches,
      rows,
      label: defaultStepLabel(cur),
    });
  }
  return steps;
}

function sumStitches(events: readonly ShapingMapEdgeEvent[]): number {
  return events.reduce((sum, event) => sum + Math.max(0, event.stitches), 0);
}

function extendNeckStepsToStartRow(
  neckSteps: ShapingMapStep[],
  neckEvents: readonly ShapingMapEdgeEvent[],
  startRow: number,
): void {
  if (neckSteps.length === 0 || neckEvents.length === 0) return;
  const lowestNeckRow = Math.min(...neckEvents.map((event) => event.row));
  const extraDown = Math.max(0, lowestNeckRow - startRow);
  const last = neckSteps[neckSteps.length - 1];
  if (last && extraDown > 0) last.rows = extraDown;
}

function withForcedLabels(
  events: readonly ShapingMapEdgeEvent[],
  include: boolean,
): ShapingMapEdgeEvent[] {
  if (include) return [...events];
  return events.map((event) => ({ ...event, label: "" }));
}

function buildHalfPaths(args: {
  side: "left" | "right";
  outsideX: number;
  startRow: number;
  endRow: number;
  remaining: number;
  shoulderMode: ShapingMapShoulderMode;
  neckEvents: readonly ShapingMapEdgeEvent[];
  shoulderEvents: readonly ShapingMapEdgeEvent[];
  includeNeckLabels: boolean;
  includeShoulderLabels: boolean;
}): ShapingMapPath[] {
  const {
    side,
    outsideX,
    startRow,
    endRow,
    remaining,
    shoulderMode,
    neckEvents,
    shoulderEvents,
    includeNeckLabels,
    includeShoulderLabels,
  } = args;
  const suffix = side === "right" ? "-right" : "";
  const labeledNeck = withForcedLabels(neckEvents, includeNeckLabels);
  const labeledShoulder = withForcedLabels(shoulderEvents, includeShoulderLabels);
  const highestNeckRow =
    neckEvents.length > 0 ? Math.max(...neckEvents.map((event) => event.row)) : startRow;
  const lowestShoulderRow =
    shoulderEvents.length > 0 ? Math.min(...shoulderEvents.map((event) => event.row)) : startRow;
  const paths: ShapingMapPath[] = [];

  if (shoulderMode === "shaped" && shoulderEvents.length > 0) {
    const shoulderSteps: ShapingMapStep[] = [];
    const riseToFirst = Math.max(0, lowestShoulderRow - startRow);
    if (riseToFirst > 0) {
      shoulderSteps.push({ stitches: 0, rows: riseToFirst, label: "" });
    }
    shoulderSteps.push(...eventsToSteps(labeledShoulder, "up"));
    const highestShoulderRow =
      shoulderEvents.length > 0 ? Math.max(...shoulderEvents.map((event) => event.row)) : startRow;
    const riseToEnd = Math.max(0, endRow - highestShoulderRow);
    if (riseToEnd > 0) {
      // Inclusive top line after the last outside action (completion-boundary row).
      shoulderSteps.push({ stitches: 0, rows: riseToEnd, label: "" });
    }
    const shoulderWidth = sumStitches(shoulderEvents);

    paths.push({
      id: `shoulder${suffix}`,
      label: "Shoulder",
      edge: side,
      rowDirection: "up",
      startX: outsideX,
      startRow,
      steps: shoulderSteps,
    });

    const neckSteps: ShapingMapStep[] = [];
    const knitEvenFromTop = Math.max(0, endRow - highestNeckRow);
    if (knitEvenFromTop > 0) {
      neckSteps.push({ stitches: 0, rows: knitEvenFromTop, label: "" });
    }
    neckSteps.push(...eventsToSteps(labeledNeck, "down"));
    extendNeckStepsToStartRow(neckSteps, neckEvents, startRow);

    if (neckSteps.length > 0) {
      paths.push({
        id: `neck${suffix}`,
        label: "Neck",
        edge: side,
        rowDirection: "down",
        startX: side === "left" ? shoulderWidth : outsideX - shoulderWidth,
        startRow: endRow,
        steps: neckSteps,
      });
    }
  } else {
    const verticalRows = Math.max(0, endRow - startRow);
    const shoulderSteps: ShapingMapStep[] = [];
    if (verticalRows > 0) {
      shoulderSteps.push({ stitches: 0, rows: verticalRows, label: "" });
    }
    if (remaining > 0) {
      shoulderSteps.push({
        stitches: remaining,
        rows: 0,
        label: includeShoulderLabels ? `${remaining} sts` : "",
      });
    }

    if (shoulderSteps.length > 0) {
      paths.push({
        id: `shoulder${suffix}`,
        label: "Shoulder",
        edge: side,
        rowDirection: "up",
        startX: outsideX,
        startRow,
        steps: shoulderSteps,
      });
    }

    const neckSteps: ShapingMapStep[] = [];
    const knitEvenFromTop = Math.max(0, endRow - highestNeckRow);
    if (knitEvenFromTop > 0) {
      neckSteps.push({ stitches: 0, rows: knitEvenFromTop, label: "" });
    }
    neckSteps.push(...eventsToSteps(labeledNeck, "down"));
    extendNeckStepsToStartRow(neckSteps, neckEvents, startRow);

    if (neckSteps.length > 0) {
      paths.push({
        id: `neck${suffix}`,
        label: "Neck",
        edge: side,
        rowDirection: "down",
        startX: side === "left" ? remaining : outsideX - remaining,
        startRow: endRow,
        steps: neckSteps,
      });
    }
  }

  return paths;
}

function sectionWidth(args: {
  shoulderMode: ShapingMapShoulderMode;
  remaining: number;
  neckEvents: readonly ShapingMapEdgeEvent[];
  shoulderEvents: readonly ShapingMapEdgeEvent[];
}): number {
  const neckStitches = sumStitches(args.neckEvents);
  if (args.shoulderMode === "shaped" && args.shoulderEvents.length > 0) {
    return sumStitches(args.shoulderEvents) + neckStitches;
  }
  return args.remaining + neckStitches;
}

/**
 * Build {@link ShapingMapData} for {@link renderShapingMapSvg} from generated edge events.
 *
 * Straight shoulders: vertical outside edge + remaining-stitch top, neck steps on the inside.
 * Shaped shoulders: outside bind-offs and neck-edge actions over the same row window.
 * The last neck step ends on its action row so the optional center bind-off attaches there
 * (the starting row is never forced down to 0).
 *
 * Pass `layout: "symmetrical"` for a mirrored left/right chart with an optional center
 * bind-off gap — reusable for Skill Builders, pattern instructions, or help content.
 */
export function buildShapingMapDataFromEdges(input: ShapingMapFromEdgesInput): ShapingMapData {
  const startRow = Math.floor(input.startRow);
  const endRow = Math.max(startRow, Math.floor(input.endRow));
  const remaining = Math.max(0, Math.floor(input.remainingStitches ?? 0));
  const centerStitches = Math.max(0, Math.floor(input.centerStitches ?? 0));
  const neckEvents = input.neckEvents.filter((event) => event.stitches > 0);
  const shoulderEvents = (input.shoulderEvents ?? []).filter((event) => event.stitches > 0);
  const layout: ShapingMapLayout = input.layout ?? "single-edge";
  const neckLabelSides: ShapingMapNeckLabelSides = input.neckLabelSides ?? "left";
  const shoulderLabelSides: ShapingMapNeckLabelSides = input.shoulderLabelSides ?? "both";

  const leftPaths = buildHalfPaths({
    side: "left",
    outsideX: 0,
    startRow,
    endRow,
    remaining,
    shoulderMode: input.shoulderMode,
    neckEvents,
    shoulderEvents,
    includeNeckLabels: layout !== "symmetrical" || neckLabelSides === "left" || neckLabelSides === "both",
    includeShoulderLabels:
      layout !== "symmetrical" || shoulderLabelSides === "left" || shoulderLabelSides === "both",
  });

  let paths = leftPaths;
  if (layout === "symmetrical") {
    const halfWidth = sectionWidth({
      shoulderMode: input.shoulderMode,
      remaining,
      neckEvents,
      shoulderEvents,
    });
    const totalWidth = halfWidth * 2 + centerStitches;
    const rightPaths = buildHalfPaths({
      side: "right",
      outsideX: totalWidth,
      startRow,
      endRow,
      remaining,
      shoulderMode: input.shoulderMode,
      neckEvents,
      shoulderEvents,
      includeNeckLabels: neckLabelSides === "right" || neckLabelSides === "both",
      includeShoulderLabels: shoulderLabelSides === "right" || shoulderLabelSides === "both",
    });
    paths = [...leftPaths, ...rightPaths];
  }

  return {
    title: input.title ?? "Shaping map",
    rowMin: startRow,
    rowMax: endRow,
    layout,
    ...(centerStitches > 0 ? { centerStitches } : {}),
    ...(input.centerLabel !== undefined ? { centerLabel: input.centerLabel } : {}),
    ...(input.practicePiece ? { practicePiece: input.practicePiece } : {}),
    ...(input.centerAnnotation ? { centerAnnotation: input.centerAnnotation } : {}),
    paths,
    edgeLabels: {
      ...(input.edgeLabels?.shoulder ? { shoulder: input.edgeLabels.shoulder } : {}),
      ...(input.edgeLabels?.neck ? { neck: input.edgeLabels.neck } : {}),
    },
  };
}
