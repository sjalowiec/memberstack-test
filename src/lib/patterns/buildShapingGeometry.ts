import type { RowEntry, ShapingEvent } from "./shapingTimeline";

export type ShapingGeometryPoint = {
  row: number;
  edge: "neck" | "shoulder" | "armhole" | string;
  side?: "left" | "right";
  stitchPosition?: number;
  stitchCount?: number;
  label?: string;
  isSimultaneous?: boolean;
};

export type ShapingEdge = {
  id: string;
  label: string;
  points: ShapingGeometryPoint[];
};

export type ShapingGeometry = {
  rows: number[];
  edges: ShapingEdge[];
  points: ShapingGeometryPoint[];
  minRow: number;
  maxRow: number;
};

function toGeometryEdgeId(event: ShapingEvent): "neck" | "shoulder" {
  if (event.edge === "inner" || event.edge === "center") return "neck";
  // TODO: current RowEntry does not distinguish armhole vs shoulder on edge "outer".
  return "shoulder";
}

function toPointSide(event: ShapingEvent): "left" | "right" | undefined {
  if (event.side === "left" || event.side === "right") return event.side;
  return undefined;
}

function stitchPositionFromRow(row: RowEntry, event: ShapingEvent): number | undefined {
  if (event.side === "left" && event.edge === "inner") return row.leftInnerEdge;
  if (event.side === "left" && event.edge === "outer") return row.leftOuterEdge;
  if (event.side === "right" && event.edge === "inner") return row.rightInnerEdge;
  if (event.side === "right" && event.edge === "outer") return row.rightOuterEdge;
  return undefined;
}

function edgeGroupId(point: ShapingGeometryPoint): string {
  return point.side ? `${point.edge}:${point.side}` : String(point.edge);
}

function edgeGroupLabel(point: ShapingGeometryPoint): string {
  const edgeLabel = String(point.edge);
  if (point.side === "left") return `${edgeLabel} (left)`;
  if (point.side === "right") return `${edgeLabel} (right)`;
  return edgeLabel;
}

function pointLabelFromEvent(event: ShapingEvent): string {
  const kindLabel = event.kind === "bindOff" ? "Bind off" : "Decrease";
  const edgeLabel = event.edge === "inner" || event.edge === "center" ? "neck" : "outer";
  const sideLabel = event.side === "center" ? "center" : event.side;
  return `${kindLabel} ${event.amount} (${sideLabel} ${edgeLabel})`;
}

export function buildShapingGeometry(rows: RowEntry[]): ShapingGeometry {
  const sortedRows = [...rows].sort((a, b) => a.row - b.row);
  const rowNumbers = sortedRows.map((r) => r.row);
  const minRow = rowNumbers.length > 0 ? rowNumbers[0] : 0;
  const maxRow = rowNumbers.length > 0 ? rowNumbers[rowNumbers.length - 1] : 0;

  const points: ShapingGeometryPoint[] = [];
  for (const row of sortedRows) {
    const shapingEvents = row.events.filter((event) => event.amount > 0);
    const simultaneous = shapingEvents.length > 1;
    for (const event of shapingEvents) {
      points.push({
        row: row.row,
        edge: toGeometryEdgeId(event),
        side: toPointSide(event),
        stitchPosition: stitchPositionFromRow(row, event),
        stitchCount: event.amount,
        label: pointLabelFromEvent(event),
        isSimultaneous: simultaneous,
      });
    }
  }

  const edgeMap = new Map<string, ShapingEdge>();
  for (const point of points) {
    const id = edgeGroupId(point);
    const existing = edgeMap.get(id);
    if (existing) {
      existing.points.push(point);
      continue;
    }
    edgeMap.set(id, {
      id,
      label: edgeGroupLabel(point),
      points: [point],
    });
  }

  return {
    rows: rowNumbers,
    edges: Array.from(edgeMap.values()),
    points,
    minRow,
    maxRow,
  };
}
