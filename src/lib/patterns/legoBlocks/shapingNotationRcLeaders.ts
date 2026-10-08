/**
 * Shared Shaping Notation RC landmark placement.
 *
 * Sleeveless body diagrams already draw cumulative counters beside the piece
 * with a light gray dotted leader (`#bdbec0`, 1px, dash `4 3`). This Lego is
 * that placement rule for new and corrected diagrams: which side, the closest
 * safe label, the leader, row alignment, collisions, and print bounds.
 * Diagrams that already match this look may keep their current geometry.
 */

export const SHAPING_NOTATION_RC_GUIDE = "#bdbec0";
export const SHAPING_NOTATION_RC_GUIDE_WIDTH = 1;
export const SHAPING_NOTATION_RC_DASH = "4 3";
export const SHAPING_NOTATION_RC_MIN_FONT = 12;

export type ShapingNotationRcLeaderLandmark = {
  id: string;
  text: string;
  actionY: number;
  outlineX: number;
  /** Lower numbers keep the action row when two landmarks are close. */
  priority: number;
  rowCounter?: number;
  kind?: string;
};

export type ShapingNotationRcLeaderBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ShapingNotationRcLeaderBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type PlacedShapingNotationRcLeader = {
  id: string;
  text: string;
  actionY: number;
  outlineX: number;
  labelX: number;
  labelY: number;
  anchor: "end" | "start";
  leaderX1: number;
  leaderY: number;
  leaderX2: number;
  fontSize: number;
  stacked: boolean;
  priority: number;
  rowCounter?: number;
  kind?: string;
};

function overlaps(a: ShapingNotationRcLeaderBox, b: ShapingNotationRcLeaderBox): boolean {
  const padX = 2;
  const padY = 8;
  return a.x < b.x + b.w + padX && a.x + a.w + padX > b.x && a.y < b.y + b.h + padY && a.y + a.h + padY > b.y;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Place RC labels on one side of a piece. Leaders stay horizontal on the
 * action row and stop at the outline. Close landmarks keep the higher-priority
 * label on that row; the other shifts to the next free line, or to a second
 * column when the viewBox has no free line.
 */
export function placeShapingNotationRcLandmarks(args: {
  landmarks: readonly ShapingNotationRcLeaderLandmark[];
  side: "left" | "right";
  fontSize: number;
  bounds: ShapingNotationRcLeaderBounds;
  obstacles?: readonly ShapingNotationRcLeaderBox[];
  labelGap?: number;
  charWidthRatio?: number;
}): PlacedShapingNotationRcLeader[] {
  const fontSize = Math.max(SHAPING_NOTATION_RC_MIN_FONT, args.fontSize);
  const gap = Math.max(28, args.labelGap ?? 36);
  const charW = fontSize * (args.charWidthRatio ?? 0.56);
  const anchor: "end" | "start" = args.side === "left" ? "end" : "start";
  const half = fontSize / 2;

  type Item = ShapingNotationRcLeaderLandmark & {
    width: number;
    labelX: number;
    labelY: number;
    stacked: boolean;
    anchor: "end" | "start";
  };

  const items: Item[] = args.landmarks.map((mark) => {
    const width = Math.max(fontSize, mark.text.length * charW);
    let labelX = args.side === "left" ? mark.outlineX - gap : mark.outlineX + gap;
    if (anchor === "end") {
      if (labelX - width < args.bounds.minX) labelX = args.bounds.minX + width;
      if (labelX > mark.outlineX - 4) labelX = Math.max(args.bounds.minX + width, mark.outlineX - 4);
    } else if (labelX + width > args.bounds.maxX) {
      labelX = args.bounds.maxX - width;
    }
    const labelY = clamp(mark.actionY, args.bounds.minY + half, args.bounds.maxY - half);
    return { ...mark, width, labelX, labelY, stacked: false, anchor };
  });

  const boxOf = (item: Item): ShapingNotationRcLeaderBox => ({
    x: item.anchor === "end" ? item.labelX - item.width : item.labelX,
    y: item.labelY - half,
    w: item.width,
    h: fontSize,
  });

  const hits = (item: Item, placed: readonly Item[]): boolean => {
    const box = boxOf(item);
    if (placed.some((other) => overlaps(box, boxOf(other)))) return true;
    return (args.obstacles ?? []).some((obstacle) => overlaps(box, obstacle));
  };

  const placed: Item[] = [];
  const order = [...items].sort((a, b) => a.priority - b.priority || a.actionY - b.actionY);
  for (const item of order) {
    if (hits(item, placed)) {
      const homeX = item.labelX;
      const homeY = item.labelY;
      const shift = item.width + 8;
      item.labelX += args.side === "left" ? -shift : shift;
      item.labelY = clamp(item.actionY, args.bounds.minY + half, args.bounds.maxY - half);
      if (args.side === "left" && item.labelX - item.width < args.bounds.minX) {
        item.labelX = args.bounds.minX + item.width;
      }
      if (args.side === "right" && item.labelX + item.width > args.bounds.maxX) {
        item.labelX = args.bounds.maxX - item.width;
      }
      item.stacked = true;
      if (hits(item, placed) || Math.abs(item.labelX - homeX) < 4) {
        item.labelX = homeX;
        const step = fontSize + 4;
        let found = false;
        for (const dir of [-1, 1] as const) {
          const y = homeY + dir * step;
          if (y - half < args.bounds.minY || y + half > args.bounds.maxY) continue;
          item.labelY = y;
          if (!hits(item, placed)) {
            found = true;
            break;
          }
        }
        if (!found) item.labelY = homeY;
      }
    }
    placed.push(item);
  }

  return placed.map((item) => {
    let leaderX1 = item.anchor === "end" ? item.labelX + 3 : item.labelX - 3;
    const lineY = item.actionY;
    if (item.anchor === "end") {
      for (const other of placed) {
        const box = boxOf(other);
        const crosses =
          lineY >= box.y &&
          lineY <= box.y + box.h &&
          box.x < item.outlineX &&
          box.x + box.w > leaderX1;
        if (crosses) leaderX1 = Math.max(leaderX1, box.x + box.w + 2);
      }
      if (leaderX1 > item.outlineX - 1) leaderX1 = Math.min(item.labelX + 3, item.outlineX - 1);
    }
    return {
      id: item.id,
      text: item.text,
      actionY: item.actionY,
      outlineX: item.outlineX,
      labelX: item.labelX,
      labelY: item.labelY,
      anchor: item.anchor,
      leaderX1,
      leaderY: lineY,
      leaderX2: item.outlineX,
      fontSize,
      stacked: item.stacked || Math.abs(item.labelY - item.actionY) > 0.5,
      priority: item.priority,
      rowCounter: item.rowCounter,
      kind: item.kind,
    };
  });
}

export function renderShapingNotationRcLeaders(args: {
  placed: readonly PlacedShapingNotationRcLeader[];
  fill: string;
  font: string;
  escape: (text: string) => string;
  formatNumber: (n: number) => string;
}): string {
  const ordered = [...args.placed].sort(
    (a, b) => (a.rowCounter ?? a.actionY) - (b.rowCounter ?? b.actionY) || a.priority - b.priority,
  );
  return ordered
    .map((mark) => {
      const kind = mark.kind ?? mark.id;
      const rc = mark.rowCounter ?? "";
      const label = args.escape(mark.text);
      const line =
        `<line data-role="rc-leader" data-rc-label="${args.escape(kind)}" ` +
        `data-row-counter="${rc}" data-action-y="${args.formatNumber(mark.actionY)}" ` +
        `data-outline-x="${args.formatNumber(mark.outlineX)}" ` +
        `x1="${args.formatNumber(mark.leaderX1)}" y1="${args.formatNumber(mark.leaderY)}" ` +
        `x2="${args.formatNumber(mark.leaderX2)}" y2="${args.formatNumber(mark.leaderY)}" ` +
        `stroke="${SHAPING_NOTATION_RC_GUIDE}" stroke-width="${SHAPING_NOTATION_RC_GUIDE_WIDTH}" ` +
        `stroke-dasharray="${SHAPING_NOTATION_RC_DASH}" fill="none"/>`;
      const text =
        `<text data-role="rc-landmark" data-rc-label="${args.escape(kind)}" ` +
        `data-rc="${label}" data-row-counter="${rc}" ` +
        `data-stacked="${mark.stacked ? "true" : "false"}" ` +
        `x="${args.formatNumber(mark.labelX)}" y="${args.formatNumber(mark.labelY)}" ` +
        `text-anchor="${mark.anchor}" dominant-baseline="middle" fill="${args.fill}" ` +
        `font-family="${args.font}" font-size="${mark.fontSize}">${label}</text>`;
      return line + text;
    })
    .join("");
}
