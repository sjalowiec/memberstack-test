/**
 * Annotation-layer helpers for generated Drop Shoulder Shaping Notation.
 *
 * Silhouette and frame come from Drop Shoulder Stitches & Rows geometry.
 * Labels come from existing Drop Shoulder Japanese notation replacements.
 * This module does not compute pattern math and does not use Sleeveless garment geometry.
 */

import {
  DS_FONT,
  DS_MUTED,
  DS_VB_H,
  bodyWidthXAt,
  escapeXml,
  fmtNum,
  textFont,
  type DropShoulderDiagramFrame,
} from "./dropShoulderPatternDiagramSvgShared";

export const DS_FS_NOTATION = 17;
export const DS_FS_RC = 14;
export const DS_NOTATION_GAP = 18;
export const DS_NECK_NOTATION_GAP = 18;
export const DS_BODY_NOTATION_GAP = 18;
export const DS_BODY_LABEL_OUTLINE_CLEARANCE = 18;
export const DS_RC_GUTTER_X = 70;
export const DS_RC_RESET_GAP = Math.round(DS_FS_RC * 1.75);

const GUIDE = "#bdbec0";

export type DropShoulderNotationLabels = {
  castOn: string;
  bodyRows: string;
  bodyShaping: string;
  armholeBo: string;
  armholeShaping: string;
  neckBo: string;
  neckShaping: string;
  shoulderShaping: string;
  rcCastOn: string;
  rcHem: string;
  rcArmholeMarker: string;
  rcReset: string;
  rcNeckStart: string;
};

export function dropShoulderNotationLabelsFromReplacements(
  repl: Record<string, string>,
): DropShoulderNotationLabels {
  return {
    castOn: repl["jp-caston"] ?? "",
    bodyRows: repl["jp-body-rows"] ?? "",
    bodyShaping: repl["jp-body-shaping"] ?? "",
    armholeBo: repl["jp-armhole-bo"] ?? "",
    armholeShaping: repl["jp-armhole-shaping"] ?? "",
    neckBo: repl["jp-neckline-bo"] ?? "",
    neckShaping: repl["jp-neckline-shaping"] ?? "",
    shoulderShaping: repl["jp-shoulder-shaping"] ?? "",
    rcCastOn: repl["rc-caston"] ?? "",
    rcHem: repl["rc-hem"] ?? "",
    rcArmholeMarker: repl["rc-armhole-bo"] ?? "",
    rcReset: repl.rc_reset ?? "",
    rcNeckStart: repl["rc-neckline-start"] ?? "",
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function dashedLine(x1: number, y: number, x2: number, role: string, extra = ""): string {
  return `<line data-role="${role}-guide"${extra} x1="${fmtNum(x1)}" y1="${fmtNum(y)}" x2="${fmtNum(x2)}" y2="${fmtNum(y)}" stroke="${GUIDE}" stroke-width="1" stroke-dasharray="4 3" fill="none"/>`;
}

function rcText(x: number, y: number, label: string, role: string, extra = ""): string {
  if (!label) return "";
  return `<text data-role="${role}" data-rc="${escapeXml(label)}"${extra} x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="end" fill="${DS_MUTED}" ${textFont(DS_FS_RC)}>${escapeXml(label)}</text>`;
}

function notationStack(
  lines: readonly string[],
  x: number,
  lastBaselineY: number,
  attrs: string,
  textAnchor: "middle" | "start" | "end" = "middle",
  gap: number = DS_NOTATION_GAP,
): string {
  const cleaned = lines.filter((line) => line.length > 0);
  if (cleaned.length === 0) return "";
  return cleaned
    .map((line, i) => {
      const y = lastBaselineY - i * gap;
      return `<text ${attrs} data-stack-order="${i}" x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="${textAnchor}" fill="${DS_MUTED}" ${textFont(DS_FS_NOTATION)}>${escapeXml(line)}</text>`;
    })
    .join("");
}

export function drawDropShoulderNotationRcGutter(
  frame: DropShoulderDiagramFrame,
  labels: DropShoulderNotationLabels,
  hemRows: number,
): string {
  const gutterX = DS_RC_GUTTER_X;
  const { left } = bodyWidthXAt(frame, frame.armholeMarkerY);
  const parts: string[] = [
    dashedLine(gutterX + 6, frame.bottom, left, "cast-on"),
    dashedLine(gutterX + 6, frame.armholeMarkerY, frame.left, "armhole-marker"),
    dashedLine(gutterX + 6, frame.neckBottomY, frame.neckLeftX, "neck-start"),
  ];
  if (hemRows > 0) {
    parts.push(dashedLine(gutterX + 6, frame.hemTopY, left, "hem"));
  }
  parts.push(rcText(gutterX, frame.bottom, labels.rcCastOn, "rc-caston"));
  if (hemRows > 0) {
    parts.push(rcText(gutterX, frame.hemTopY, labels.rcHem, "rc-hem"));
  }
  parts.push(
    rcText(
      gutterX,
      frame.armholeMarkerY,
      labels.rcArmholeMarker,
      "armhole-marker-rc",
      ` data-notation="${escapeXml(labels.rcArmholeMarker)}"`,
    ),
  );

  const resetY = labels.rcReset ? frame.neckBottomY - DS_RC_RESET_GAP : frame.neckBottomY;
  if (labels.rcReset) {
    // Reset action sits just above the neckline-start garment RC (knit to NNN → ↺ rc000).
    parts.push(rcText(gutterX, resetY, labels.rcReset, "rc-reset"));
  }
  const neckRcY =
    labels.rcReset && Math.abs(frame.neckBottomY - resetY) < 1.5
      ? resetY + DS_RC_RESET_GAP
      : frame.neckBottomY;
  parts.push(rcText(gutterX, neckRcY, labels.rcNeckStart, "neck-start-rc"));
  return parts.join("");
}

export function drawDropShoulderNeckNotation(
  frame: DropShoulderDiagramFrame,
  labels: DropShoulderNotationLabels,
  anchor: "center" | "cf",
  options?: {
    /** When set, stack labels inside the neck opening instead of below the scoop. */
    insideOpening?: boolean;
    deepestY?: number;
    labelX?: number;
    labelY?: number;
  },
): string {
  const neckShapingLines = labels.neckShaping.split("\n").filter(Boolean);
  const deepestY = options?.deepestY ?? frame.neckBottomY;
  const neckHoldOffset = labels.neckBo ? 1 : 0;
  const stackCount = neckShapingLines.length + neckHoldOffset;
  const stackH = Math.max(0, (stackCount - 1) * DS_NECK_NOTATION_GAP);

  let neckLabelX: number;
  let neckBoY: number;
  let neckHighestY: number;
  let placement: "legacy-below-scoop" | "inside-opening";

  if (options?.insideOpening) {
    placement = "inside-opening";
    neckLabelX = options.labelX ?? (anchor === "cf"
      ? (frame.neckLeftX + frame.neckRightX) / 2
      : frame.midX);
    const span = Math.max(12, deepestY - frame.top);
    const clusterY = options.labelY ?? frame.top + span * 0.42;
    const maxLast = deepestY - 8;
    const minLast = frame.top + 16 + stackH;
    neckBoY = clamp(clusterY + stackH / 2, Math.min(minLast, maxLast), maxLast);
    neckHighestY = neckBoY - stackH;
  } else {
    placement = "legacy-below-scoop";
    neckLabelX =
      anchor === "cf"
        ? (frame.neckLeftX + frame.neckRightX) / 2
        : frame.midX;
    neckHighestY = Math.min(DS_VB_H - 24, frame.top + 20);
    neckBoY = Math.min(
      DS_VB_H - 16,
      Math.max(
        frame.neckBottomY + 8,
        neckHighestY + Math.max(0, stackCount - 1) * DS_NECK_NOTATION_GAP,
      ),
    );
  }

  const parts: string[] = [
    `<g data-role="neck-label-zone" data-x="${fmtNum(neckLabelX)}" data-y="${fmtNum(neckHighestY)}" data-bo-y="${fmtNum(neckBoY)}" data-neck-working-order="bottom-up" data-neck-anchor="${anchor}" data-neck-notation-placement="${placement}" data-neck-notation-deepest-y="${fmtNum(deepestY)}"></g>`,
  ];
  for (const [i, line] of neckShapingLines.entries()) {
    const y = neckBoY - (i + neckHoldOffset) * DS_NECK_NOTATION_GAP;
    parts.push(
      `<text data-role="neck-shaping" data-label-zone="neck" data-notation="${escapeXml(labels.neckShaping)}" data-stack-order="${i}" x="${fmtNum(neckLabelX)}" y="${fmtNum(y)}" text-anchor="middle" fill="${DS_MUTED}" ${textFont(DS_FS_NOTATION)}>${escapeXml(line)}</text>`,
    );
  }
  if (labels.neckBo) {
    parts.push(
      `<text data-role="neck-bo" data-label-zone="neck" data-notation="${escapeXml(labels.neckBo)}" data-stack-order="${neckShapingLines.length}" x="${fmtNum(neckLabelX)}" y="${fmtNum(neckBoY)}" text-anchor="middle" fill="${DS_MUTED}" ${textFont(DS_FS_NOTATION)}>${escapeXml(labels.neckBo)}</text>`,
    );
  }
  return parts.join("");
}

export function drawDropShoulderBodyShapingNotation(
  frame: DropShoulderDiagramFrame,
  labels: DropShoulderNotationLabels,
  side: "left" | "right",
): string {
  const bodyLines = labels.bodyShaping.split("\n").filter(Boolean);
  if (bodyLines.length === 0) return "";
  const bodyMidY = (frame.armholeMarkerY + frame.hemTopY) / 2;
  const bodyStackH = Math.max(0, (bodyLines.length - 1) * DS_BODY_NOTATION_GAP);
  const bodyLastBaseline = clamp(
    bodyMidY + bodyStackH / 2,
    frame.armholeMarkerY + 24,
    frame.bottom - 28,
  );
  const outline = bodyWidthXAt(frame, bodyLastBaseline);
  const bodyOutlineX = side === "right" ? outline.right : outline.left;
  const bodyLabelX =
    side === "right"
      ? bodyOutlineX - DS_BODY_LABEL_OUTLINE_CLEARANCE
      : bodyOutlineX + DS_BODY_LABEL_OUTLINE_CLEARANCE;
  const anchor = side === "right" ? "end" : "start";
  return [
    `<g data-role="body-shaping-label-zone" data-body-label-x="${fmtNum(bodyLabelX)}" data-body-outline-x-at-label="${fmtNum(bodyOutlineX)}" data-body-label-y="${fmtNum(bodyLastBaseline)}"></g>`,
    notationStack(
      bodyLines,
      bodyLabelX,
      bodyLastBaseline,
      `data-role="body-shaping" data-label-zone="body" data-notation="${escapeXml(labels.bodyShaping)}"`,
      anchor,
      DS_BODY_NOTATION_GAP,
    ),
  ].join("");
}

export function drawDropShoulderBodyRowsNotation(
  frame: DropShoulderDiagramFrame,
  labels: DropShoulderNotationLabels,
): string {
  if (!labels.bodyRows) return "";
  const y = frame.armholeMarkerY + (frame.hemTopY - frame.armholeMarkerY) * 0.38;
  return `<text data-role="body-rows" data-notation="${escapeXml(labels.bodyRows)}" x="${fmtNum(frame.midX)}" y="${fmtNum(y)}" text-anchor="middle" fill="${DS_MUTED}" ${textFont(DS_FS_NOTATION)}>${escapeXml(labels.bodyRows)}</text>`;
}

export function drawDropShoulderCastOnNotation(
  frame: DropShoulderDiagramFrame,
  labels: DropShoulderNotationLabels,
): string {
  if (!labels.castOn) return "";
  return `<text data-role="cast-on" data-notation="${escapeXml(labels.castOn)}" x="${fmtNum(frame.midX)}" y="${fmtNum(Math.min(DS_VB_H - 8, frame.bottom + 16))}" text-anchor="middle" fill="${DS_MUTED}" ${textFont(DS_FS_NOTATION)}>${escapeXml(labels.castOn)}</text>`;
}

export function dropShoulderNotationFontFace(): string {
  return `<style type="text/css"><![CDATA[text{font-family:${DS_FONT}}]]></style>`;
}
