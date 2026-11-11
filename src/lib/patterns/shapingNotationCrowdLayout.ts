/**
 * Placement for Shaping Notation labels that would otherwise sit on each other.
 * The garment outline stays put. A line that cannot stay beside its edge
 * moves to the next open row, and a gray dotted leader keeps the association.
 */

export type NotationAnchor = "start" | "middle" | "end";

export type NotationBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const CHAR_WIDTH = 0.56;

/** Highest armhole baseline that still sits below the shoulder line. */
export function armholeTopBaseline(shoulderY: number, fontSize: number): number {
  return shoulderY + fontSize * 0.9;
}

export function rcBaselineGap(fontSize: number): number {
  return fontSize + 6;
}

export function notationTextWidth(text: string, fontSize: number): number {
  return Math.max(fontSize, text.length * fontSize * CHAR_WIDTH);
}

export function notationLabelBox(
  anchorX: number,
  baseline: number,
  text: string,
  fontSize: number,
  anchor: NotationAnchor,
): NotationBox {
  const width = notationTextWidth(text, fontSize);
  const top = baseline - fontSize * 0.82;
  const bottom = baseline + fontSize * 0.28;
  const left =
    anchor === "middle" ? anchorX - width / 2 : anchor === "end" ? anchorX - width : anchorX;
  return { left, top, right: left + width, bottom };
}

export function notationBoxesOverlap(a: NotationBox, b: NotationBox, pad = 3): boolean {
  return a.left < b.right + pad && a.right + pad > b.left && a.top < b.bottom + pad && a.bottom + pad > b.top;
}

/**
 * Index 0 stays on `startY`. Later lines step upward while the baseline is
 * still at or below `topBaseline` (SVG Y grows downward, so `topBaseline` is
 * the highest row that may sit beside the edge). Lines that would climb past
 * that row continue downward from `belowY`, in the same order.
 */
export function placeUpwardStackClearOfCeiling(args: {
  count: number;
  startY: number;
  gap: number;
  topBaseline: number;
  belowY: number;
}): { ys: number[]; firstOverflow: number } {
  const ys: number[] = [];
  let overflow = 0;
  for (let index = 0; index < args.count; index += 1) {
    const upward = args.startY - index * args.gap;
    if (index === 0 || upward >= args.topBaseline) {
      ys.push(upward);
      continue;
    }
    ys.push(args.belowY + overflow * args.gap);
    overflow += 1;
  }
  const firstOverflow = ys.findIndex((y, index) => index > 0 && y > args.startY + 0.5);
  return { ys, firstOverflow };
}

/** Move `y` off any nearby baseline. The nearest obstacle decides the first direction. */
export function separateBaseline(
  y: number,
  obstacles: readonly number[],
  minGap: number,
  bounds?: { min: number; max: number },
): number {
  const min = bounds?.min ?? Number.NEGATIVE_INFINITY;
  const max = bounds?.max ?? Number.POSITIVE_INFINITY;
  const blocked = (candidate: number) =>
    obstacles.some((other) => Math.abs(other - candidate) < minGap);
  if (!blocked(y)) return Math.max(min, Math.min(max, y));
  const nearest = obstacles.reduce((best, other) =>
    Math.abs(other - y) < Math.abs(best - y) ? other : best,
  );
  const firstDirection = nearest > y ? -1 : 1;
  for (const direction of [firstDirection, -firstDirection]) {
    for (let step = 1; step <= 8; step += 1) {
      const candidate = y + direction * minGap * step;
      if (candidate < min || candidate > max) break;
      if (!blocked(candidate)) return candidate;
    }
  }
  return Math.max(min, Math.min(max, y));
}

/** True when a straight segment passes through a label box, including `pad` of clearance. */
export function notationBoxHitsSegment(
  box: NotationBox,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  pad = 2,
): boolean {
  const left = box.left - pad;
  const right = box.right + pad;
  const top = box.top - pad;
  const bottom = box.bottom + pad;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - left, right - x1, y1 - top, bottom - y1];
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i += 1) {
    const pi = p[i] ?? 0;
    const qi = q[i] ?? 0;
    if (pi === 0) {
      if (qi < 0) return false;
      continue;
    }
    const r = qi / pi;
    if (pi < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }
  return t0 <= t1;
}

/**
 * Index 0 is the bottom of an upward stack. A line that does not fit steps
 * downward, and every line below it keeps at least `gap` so the reading
 * order stays top-to-bottom.
 */
export function dropStackKeepingGaps(args: {
  ys: readonly number[];
  gap: number;
  limit: number;
  fits: (index: number, baseline: number) => boolean;
}): number[] {
  const out = args.ys.slice();
  let above = Number.NEGATIVE_INFINITY;
  for (let index = out.length - 1; index >= 0; index -= 1) {
    let y = Math.max(out[index] ?? 0, above + args.gap);
    let steps = 0;
    while (!args.fits(index, y) && y < args.limit && steps < 48) {
      y += 4;
      steps += 1;
    }
    if (y > args.limit) y = Math.max(args.limit, above + args.gap);
    out[index] = y;
    above = y;
  }
  return out;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

/** Dotted elbow from a shaping edge to a label that could not sit on that edge. */
export function notationElbowLeader(args: {
  role: string;
  edgeX: number;
  edgeY: number;
  labelX: number;
  labelY: number;
}): string {
  const edgeX = args.edgeX;
  const edgeY = args.edgeY;
  const labelX = args.labelX - 5;
  const labelY = args.labelY;
  const points =
    Math.abs(edgeY - labelY) < 1.5
      ? `${fmt(edgeX)},${fmt(edgeY)} ${fmt(labelX)},${fmt(labelY)}`
      : `${fmt(edgeX)},${fmt(edgeY)} ${fmt(labelX)},${fmt(edgeY)} ${fmt(labelX)},${fmt(labelY)}`;
  return `<polyline data-role="${args.role}" points="${points}" fill="none" stroke="#bdbec0" stroke-width="1" stroke-dasharray="4 3"/>`;
}
