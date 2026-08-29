/**
 * Shared Drop Shoulder schematic SVG primitives (Stitches & Rows).
 * Back and Front renderers use these helpers; they do not compute pattern math.
 */

export const DS_VB_W = 430;
export const DS_VB_H = 520;
export const DS_FONT = "Poppins, system-ui, Arial, sans-serif";
export const DS_ARROW = "#52682d";
export const DS_STROKE = "#1a1a1a";
export const DS_FILL = "#f4f6f1";
export const DS_MUTED = "#4b5563";
export const DS_FS_TITLE = 13;
export const DS_FS_MEASURE = 14;
export const DS_FS_SMALL = 12;
export const DS_FW_TITLE = 600;

export const DS_PAD_LEFT = 108;
export const DS_PAD_RIGHT = 118;
export const DS_PAD_TOP = 70;
export const DS_PAD_BOTTOM = 72;
export const DS_BODY_MAX_W = DS_VB_W - DS_PAD_LEFT - DS_PAD_RIGHT;
export const DS_BODY_MAX_H = DS_VB_H - DS_PAD_TOP - DS_PAD_BOTTOM;
export const DS_MIN_SECTION = 22;

export type DropShoulderDiagramFrame = {
  left: number;
  right: number;
  hemLeft: number;
  hemRight: number;
  midX: number;
  top: number;
  neckBottomY: number;
  neckLeftX: number;
  neckRightX: number;
  armholeMarkerY: number;
  hemTopY: number;
  bottom: number;
};

export type DropShoulderDiagramSectionCounts = {
  hemRows: number;
  bodyRowsToArmhole: number;
  armholeRows: number;
  necklineRowsInsideArmhole: number;
  hemStitches: number;
  bodyWidthStitches: number;
  crossShoulderStitches: number;
  necklineStitches: number;
};

export function escapeXml(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const r = Math.round(n * 100) / 100;
  return String(r);
}

export function textFont(size: number, weight?: number): string {
  const w = weight != null ? ` font-weight="${weight}"` : "";
  return `font-family="${DS_FONT}" font-size="${size}"${w}`;
}

export function endCap(x: number, y: number, vertical: boolean): string {
  if (vertical) {
    return `<rect x="${fmtNum(x - 3.5)}" y="${fmtNum(y - 0.7)}" width="7" height="1.4" fill="${DS_ARROW}"/>`;
  }
  return `<rect x="${fmtNum(x - 0.7)}" y="${fmtNum(y - 3.5)}" width="1.4" height="7" fill="${DS_ARROW}"/>`;
}

export function markerTriangle(x: number, y: number, side: "left" | "right"): string {
  const inward = side === "left" ? 7 : -7;
  return `<polygon points="${fmtNum(x)},${fmtNum(y)} ${fmtNum(x + inward)},${fmtNum(y - 5)} ${fmtNum(x + inward)},${fmtNum(y + 5)}" fill="${DS_ARROW}"/>`;
}

export function scaleDiagramSections(
  model: DropShoulderDiagramSectionCounts,
  maxNeckRatio = 0.85,
): {
  hemH: number;
  bodyH: number;
  armholeH: number;
  neckH: number;
} {
  const hem = Math.max(0, model.hemRows);
  const body = Math.max(0, model.bodyRowsToArmhole);
  const armhole = Math.max(1, model.armholeRows);
  const total = hem + body + armhole;
  const raw = (rows: number) => (rows / total) * DS_BODY_MAX_H;
  let hemH = Math.max(hem > 0 ? DS_MIN_SECTION : 0, raw(hem));
  let bodyH = Math.max(body > 0 ? DS_MIN_SECTION : 0, raw(body));
  let armholeH = Math.max(DS_MIN_SECTION * 1.4, raw(armhole));
  const sum = hemH + bodyH + armholeH;
  if (sum > DS_BODY_MAX_H && sum > 0) {
    const k = DS_BODY_MAX_H / sum;
    hemH *= k;
    bodyH *= k;
    armholeH *= k;
  }
  const neckRatio = model.armholeRows > 0 ? model.necklineRowsInsideArmhole / model.armholeRows : 0;
  const neckH = Math.min(
    armholeH * maxNeckRatio,
    Math.max(model.necklineRowsInsideArmhole > 0 ? 14 : 0, armholeH * neckRatio),
  );
  return { hemH, bodyH, armholeH, neckH };
}

export function buildFullWidthFrame(
  model: DropShoulderDiagramSectionCounts,
  maxNeckRatio = 0.85,
): DropShoulderDiagramFrame {
  const { hemH, bodyH, armholeH, neckH } = scaleDiagramSections(model, maxNeckRatio);
  const maxSts = Math.max(
    model.hemStitches,
    model.bodyWidthStitches,
    model.crossShoulderStitches,
    1,
  );
  const topW = (model.crossShoulderStitches / maxSts) * DS_BODY_MAX_W;
  const hemW = (model.hemStitches / maxSts) * DS_BODY_MAX_W;
  const midX = DS_PAD_LEFT + DS_BODY_MAX_W / 2;
  const left = midX - topW / 2;
  const right = midX + topW / 2;
  const hemLeft = midX - hemW / 2;
  const hemRight = midX + hemW / 2;
  const top = DS_PAD_TOP;
  const armholeMarkerY = top + armholeH;
  const hemTopY = armholeMarkerY + bodyH;
  const bottom = hemTopY + hemH;
  const neckW = Math.min(
    right - left - 24,
    Math.max(18, (model.necklineStitches / maxSts) * DS_BODY_MAX_W),
  );
  const neckLeftX = midX - neckW / 2;
  const neckRightX = midX + neckW / 2;
  const neckBottomY = top + neckH;
  return {
    left,
    right,
    hemLeft,
    hemRight,
    midX,
    top,
    neckBottomY,
    neckLeftX,
    neckRightX,
    armholeMarkerY,
    hemTopY,
    bottom,
  };
}

/**
 * Left-front cardigan panel: side/armhole on the left, center-front on the right.
 * Neck opening sits on the CF edge (not centered).
 */
export function buildCardiganLeftFrame(
  model: DropShoulderDiagramSectionCounts,
  shoulderStitches: number,
  maxNeckRatio = 0.92,
): DropShoulderDiagramFrame {
  const { hemH, bodyH, armholeH, neckH } = scaleDiagramSections(model, maxNeckRatio);
  const maxSts = Math.max(
    model.hemStitches,
    model.bodyWidthStitches,
    model.crossShoulderStitches,
    1,
  );
  const topW = (model.crossShoulderStitches / maxSts) * DS_BODY_MAX_W;
  const hemW = (model.hemStitches / maxSts) * DS_BODY_MAX_W;
  const midX = DS_PAD_LEFT + DS_BODY_MAX_W / 2;
  const left = midX - topW / 2;
  const right = midX + topW / 2;
  const hemLeft = midX - hemW / 2;
  const hemRight = midX + hemW / 2;
  const top = DS_PAD_TOP;
  const armholeMarkerY = top + armholeH;
  const hemTopY = armholeMarkerY + bodyH;
  const bottom = hemTopY + hemH;
  const topSpan = Math.max(1, right - left);
  const shoulderRatio = Math.min(
    0.82,
    Math.max(0.18, shoulderStitches > 0 ? shoulderStitches / Math.max(model.crossShoulderStitches, 1) : 0.45),
  );
  const neckLeftX = left + topSpan * shoulderRatio;
  const neckRightX = right;
  const neckBottomY = top + neckH;
  return {
    left,
    right,
    hemLeft,
    hemRight,
    midX: (left + right) / 2,
    top,
    neckBottomY,
    neckLeftX,
    neckRightX,
    armholeMarkerY,
    hemTopY,
    bottom,
  };
}

export function bodyWidthXAt(
  frame: DropShoulderDiagramFrame,
  y: number,
): { left: number; right: number } {
  const t =
    frame.bottom === frame.top ? 0 : (y - frame.top) / (frame.bottom - frame.top);
  const clamped = Math.max(0, Math.min(1, t));
  return {
    left: frame.left + (frame.hemLeft - frame.left) * clamped,
    right: frame.right + (frame.hemRight - frame.right) * clamped,
  };
}

export function drawArmholeDepth(
  frame: DropShoulderDiagramFrame,
  armholeDepthLabel: string,
  side: "left" | "right" = "right",
): string {
  const x = side === "right" ? frame.right + 20 : frame.left - 20;
  const y1 = frame.top;
  const y2 = frame.armholeMarkerY;
  const midY = (y1 + y2) / 2;
  const title = escapeXml("Armhole depth");
  const value = escapeXml(armholeDepthLabel);
  const garmentX = side === "right" ? frame.right : frame.left;
  const labelDir = side === "right" ? 1 : -1;
  return [
    `<g class="ds-diagram__armhole-depth" data-armhole-depth="true">`,
    `<line x1="${fmtNum(garmentX)}" y1="${fmtNum(y1)}" x2="${fmtNum(x)}" y2="${fmtNum(y1)}" stroke="${DS_ARROW}" stroke-width="1" opacity="0.7" fill="none"/>`,
    `<line x1="${fmtNum(garmentX)}" y1="${fmtNum(y2)}" x2="${fmtNum(x)}" y2="${fmtNum(y2)}" stroke="${DS_ARROW}" stroke-width="1" opacity="0.7" fill="none"/>`,
    `<line x1="${fmtNum(x)}" y1="${fmtNum(y1)}" x2="${fmtNum(x)}" y2="${fmtNum(y2)}" stroke="${DS_ARROW}" stroke-width="1.6" fill="none"/>`,
    endCap(x, y1, true),
    endCap(x, y2, true),
    `<text transform="translate(${fmtNum(x + 12 * labelDir)} ${fmtNum(midY)}) rotate(-90)" text-anchor="middle" fill="${DS_STROKE}" ${textFont(DS_FS_TITLE, DS_FW_TITLE)}>${title}</text>`,
    `<text transform="translate(${fmtNum(x + 28 * labelDir)} ${fmtNum(midY)}) rotate(-90)" text-anchor="middle" fill="${DS_MUTED}" ${textFont(DS_FS_MEASURE)}>${value}</text>`,
    `</g>`,
  ].join("");
}

export function drawBodyLength(
  frame: DropShoulderDiagramFrame,
  bodyLengthLabel: string,
  side: "left" | "right" = "left",
): string {
  if (!bodyLengthLabel) return "";
  const x = side === "left" ? frame.left - 18 : frame.right + 18;
  const y1 = frame.armholeMarkerY;
  const y2 = frame.hemTopY;
  const midY = (y1 + y2) / 2;
  const labelX = side === "left" ? x - 12 : x + 12;
  return [
    `<g class="ds-diagram__body-length">`,
    `<line x1="${fmtNum(x)}" y1="${fmtNum(y1)}" x2="${fmtNum(x)}" y2="${fmtNum(y2)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(x, y1, true),
    endCap(x, y2, true),
    `<text transform="translate(${fmtNum(labelX)} ${fmtNum(midY)}) rotate(-90)" text-anchor="middle" fill="${DS_MUTED}" ${textFont(DS_FS_SMALL)}>${escapeXml(bodyLengthLabel)}</text>`,
    `</g>`,
  ].join("");
}

export function drawHemDepth(frame: DropShoulderDiagramFrame, hemDepthLabel: string): string {
  if (!hemDepthLabel) return "";
  const x = frame.hemRight + 18;
  const y1 = frame.hemTopY;
  const y2 = frame.bottom;
  const midY = (y1 + y2) / 2;
  return [
    `<g class="ds-diagram__hem-depth">`,
    `<line x1="${fmtNum(x)}" y1="${fmtNum(y1)}" x2="${fmtNum(x)}" y2="${fmtNum(y2)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(x, y1, true),
    endCap(x, y2, true),
    `<text x="${fmtNum(x + 8)}" y="${fmtNum(midY + 4)}" fill="${DS_MUTED}" ${textFont(DS_FS_SMALL)}>${escapeXml(hemDepthLabel)}</text>`,
    `</g>`,
  ].join("");
}

export function drawBodyWidth(
  frame: DropShoulderDiagramFrame,
  bodyWidthLabel: string,
): string {
  if (!bodyWidthLabel) return "";
  const y = frame.armholeMarkerY + (frame.hemTopY - frame.armholeMarkerY) * 0.32;
  const { left, right } = bodyWidthXAt(frame, y);
  const labelX = (left + right) / 2;
  return [
    `<g class="ds-diagram__body-width" data-body-width="true">`,
    `<line x1="${fmtNum(left)}" y1="${fmtNum(y)}" x2="${fmtNum(right)}" y2="${fmtNum(y)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(left, y, false),
    endCap(right, y, false),
    `<text x="${fmtNum(labelX)}" y="${fmtNum(y - 6)}" text-anchor="middle" fill="${DS_MUTED}" ${textFont(DS_FS_SMALL)}>${escapeXml(bodyWidthLabel)}</text>`,
    `</g>`,
  ].join("");
}

export function drawHemWidth(
  frame: DropShoulderDiagramFrame,
  hemStitchesLabel: string,
  hemStitches: number,
  bodyWidthStitches: number,
): string {
  if (!hemStitchesLabel) return "";
  if (hemStitches === bodyWidthStitches) return "";
  const y = frame.bottom + 22;
  return [
    `<g class="ds-diagram__hem-width">`,
    `<line x1="${fmtNum(frame.hemLeft)}" y1="${fmtNum(y)}" x2="${fmtNum(frame.hemRight)}" y2="${fmtNum(y)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(frame.hemLeft, y, false),
    endCap(frame.hemRight, y, false),
    `<text x="${fmtNum((frame.hemLeft + frame.hemRight) / 2)}" y="${fmtNum(y + 16)}" text-anchor="middle" fill="${DS_MUTED}" ${textFont(DS_FS_SMALL)}>${escapeXml(hemStitchesLabel)}</text>`,
    `</g>`,
  ].join("");
}

export function drawNecklineWidthDim(
  frame: DropShoulderDiagramFrame,
  necklineWidthLabel: string,
): string {
  if (!necklineWidthLabel) return "";
  const y = frame.top - 14;
  const x1 = frame.neckLeftX;
  const x2 = frame.neckRightX;
  return [
    `<g data-neckline-width-dim="true">`,
    `<line x1="${fmtNum(x1)}" y1="${fmtNum(y)}" x2="${fmtNum(x2)}" y2="${fmtNum(y)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(x1, y, false),
    endCap(x2, y, false),
    `<text x="${fmtNum((x1 + x2) / 2)}" y="${fmtNum(y - 6)}" text-anchor="middle" fill="${DS_MUTED}" ${textFont(DS_FS_SMALL)}>${escapeXml(necklineWidthLabel)}</text>`,
    `</g>`,
  ].join("");
}

export function drawNecklineDepthDim(
  frame: DropShoulderDiagramFrame,
  necklineDepthLabel: string,
  x = frame.neckLeftX + 10,
): string {
  if (!necklineDepthLabel) return "";
  const y1 = frame.top;
  const y2 = frame.neckBottomY;
  return [
    `<g data-neckline-depth-dim="true">`,
    `<line x1="${fmtNum(x)}" y1="${fmtNum(y1)}" x2="${fmtNum(x)}" y2="${fmtNum(y2)}" stroke="${DS_ARROW}" stroke-width="1.3" fill="none"/>`,
    endCap(x, y1, true),
    endCap(x, y2, true),
    `<text x="${fmtNum((frame.neckLeftX + frame.neckRightX) / 2)}" y="${fmtNum(y2 + 14)}" text-anchor="middle" fill="${DS_MUTED}" ${textFont(DS_FS_SMALL)}>${escapeXml(necklineDepthLabel)}</text>`,
    `</g>`,
  ].join("");
}

export function drawArmholeMarker(
  frame: DropShoulderDiagramFrame,
  sides: "both" | "left" | "right" = "both",
): string {
  const y = frame.armholeMarkerY;
  const ticks: string[] = [];
  if (sides === "both" || sides === "left") ticks.push(markerTriangle(frame.left, y, "left"));
  if (sides === "both" || sides === "right") ticks.push(markerTriangle(frame.right, y, "right"));
  return [
    `<g class="ds-diagram__armhole-marker" data-armhole-marker="true">`,
    `<line x1="${fmtNum(frame.left)}" y1="${fmtNum(y)}" x2="${fmtNum(frame.right)}" y2="${fmtNum(y)}" stroke="${DS_ARROW}" stroke-width="1.15" stroke-dasharray="5 4" opacity="0.55" fill="none"/>`,
    ...ticks,
    `</g>`,
    `<line x1="${fmtNum(frame.hemLeft)}" y1="${fmtNum(frame.hemTopY)}" x2="${fmtNum(frame.hemRight)}" y2="${fmtNum(frame.hemTopY)}" stroke="${DS_STROKE}" stroke-width="1.1" fill="none"/>`,
  ].join("");
}

export function wrapGeneratedDiagramSvg(attrs: {
  ariaLabel: string;
  className: string;
  dataAttrs: Record<string, string | number>;
  title: string;
  body: string;
}): string {
  const data = Object.entries(attrs.dataAttrs)
    .map(([k, v]) => ` ${k}="${escapeXml(String(v))}"`)
    .join("");
  const safeBody = attrs.body.replace(/\bNaN\b/g, "0").replace(/\bInfinity\b/g, "0");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DS_VB_W} ${DS_VB_H}"` +
    ` width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img"` +
    ` aria-label="${escapeXml(attrs.ariaLabel)}"` +
    ` class="${escapeXml(attrs.className)}"` +
    data +
    `>` +
    `<title>${escapeXml(attrs.title)}</title>` +
    `<rect x="0" y="0" width="${DS_VB_W}" height="${DS_VB_H}" fill="#fff"/>` +
    safeBody +
    `</svg>`
  );
}
