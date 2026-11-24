/**
 * Mitten Shaping Notation diagram.
 * The outline uses the same measurements as the Stitches & Rows sketch.
 * Labels are the shared notation tokens from {@link buildMittenShapingNotation}.
 */

import { DS_FONT, DS_MUTED, DS_STROKE } from "../dropShoulderPatternDiagramSvgShared";
import {
  renderShapingNotationRcLeaders,
  placeShapingNotationRcLandmarks,
  type ShapingNotationRcLeaderLandmark,
} from "../legoBlocks/shapingNotationRcLeaders";
import { formatShapingNotationRcLabel } from "../shapingNotationRcLandmarks";
import type { MittenSlotEdge } from "./mittenInstructions";
import { mittenDiagramMeasurements } from "./mittenDiagramSvg";
import { buildMittenShapingNotation } from "./mittenShapingNotation";
import type { MittenCalc } from "./mittenMath";

const HAND_PX = 150;
const THUMB_GAP = 16;
const THUMB_ANGLE = 22;

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function f(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

function text(
  x: number,
  y: number,
  content: string,
  anchor: "start" | "middle" | "end",
  role: string,
): string {
  if (!content) return "";
  return `<text data-role="${role}" x="${f(x)}" y="${f(y)}" font-family="${DS_FONT}" font-size="15" fill="${DS_MUTED}" text-anchor="${anchor}">${escapeXml(content)}</text>`;
}

function stack(
  x: number,
  startY: number,
  lines: readonly string[],
  anchor: "start" | "middle" | "end",
  role: string,
): string {
  return lines
    .map((line, index) => text(x, startY + index * 18, line, anchor, role))
    .join("");
}

/** Same section heights as the finished-pattern mitten sketch. */
function sketchFrame(calc: MittenCalc, slotEdge: MittenSlotEdge) {
  const m = mittenDiagramMeasurements(calc);
  const scale = HAND_PX / m.handDisplayIn;
  const slotRight = slotEdge === "right";
  const handW = m.handDisplayIn * scale;
  const cuffW = m.cuffDisplayIn * scale;
  const tipH = m.fingertipDepthIn * scale;
  const setupH = m.setupRowIn * scale;
  const straightH = m.straightLengthIn * scale;
  const hand1H = m.hand1LengthIn * scale;
  const cuffH = m.cuffLengthIn * scale;
  const thumbW = m.thumbDisplayIn * scale;
  const thumbLen = m.thumbLengthIn * scale;
  const handLeft = 300;
  const handRight = handLeft + handW;
  const cuffLeft = handLeft + (handW - cuffW) / 2;
  const cuffRight = cuffLeft + cuffW;
  const yTip = 48;
  const yDomeBase = yTip + tipH;
  const ySlot = yDomeBase + straightH + setupH;
  const yCuffTop = ySlot + hand1H;
  const yBottom = yCuffTop + cuffH;
  const sign = slotRight ? 1 : -1;
  const baseX = (slotRight ? handRight : handLeft) + sign * (THUMB_GAP + thumbW / 2);
  const baseY = ySlot + Math.min(18, thumbW * 0.28);
  return {
    m,
    scale,
    slotRight,
    sign,
    handW,
    handLeft,
    handRight,
    cuffLeft,
    cuffRight,
    yTip,
    tipH,
    yDomeBase,
    ySlot,
    yCuffTop,
    yBottom,
    thumbW,
    thumbLen,
    baseX,
    baseY,
    vbW: 860,
    vbH: yBottom + 56,
  };
}

function rcLeaders(
  landmarks: readonly ShapingNotationRcLeaderLandmark[],
  side: "left" | "right",
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): string {
  if (landmarks.length === 0) return "";
  const placed = placeShapingNotationRcLandmarks({
    landmarks,
    side,
    fontSize: 13,
    bounds,
  });
  return renderShapingNotationRcLeaders({
    placed,
    fill: DS_MUTED,
    font: DS_FONT,
    escape: escapeXml,
    formatNumber: f,
  });
}

export function buildMittenShapingNotationSvg(calc: MittenCalc, slotEdge: MittenSlotEdge): string {
  const notation = buildMittenShapingNotation(calc);
  const frame = sketchFrame(calc, slotEdge);
  const shapedX = frame.slotRight ? frame.handRight + 18 : frame.handLeft - 18;
  const shapedAnchor = frame.slotRight ? "start" : "end";
  const handMid = (frame.handLeft + frame.handRight) / 2;
  const cap = Math.min(frame.thumbW / 2, frame.thumbLen * 0.42);
  const straight = Math.max(0, frame.thumbLen - cap);
  const thumbOutline =
    `M ${f(-frame.thumbW / 2)} 0 L ${f(-frame.thumbW / 2)} ${f(-straight)} ` +
    `A ${f(frame.thumbW / 2)} ${f(cap)} 0 0 1 ${f(frame.thumbW / 2)} ${f(-straight)} ` +
    `L ${f(frame.thumbW / 2)} 0`;
  const body =
    `M ${f(frame.cuffLeft)} ${f(frame.yBottom)} L ${f(frame.cuffRight)} ${f(frame.yBottom)} ` +
    `L ${f(frame.cuffRight)} ${f(frame.yCuffTop)} L ${f(frame.handRight)} ${f(frame.yCuffTop)} ` +
    `L ${f(frame.handRight)} ${f(frame.yDomeBase)} ` +
    `A ${f(frame.handW / 2)} ${f(frame.tipH)} 0 0 0 ${f(frame.handLeft)} ${f(frame.yDomeBase)} ` +
    `L ${f(frame.handLeft)} ${f(frame.yCuffTop)} L ${f(frame.cuffLeft)} ${f(frame.yCuffTop)} Z`;

  const handSide: "left" | "right" = frame.slotRight ? "left" : "right";
  const outlineX = frame.slotRight ? frame.handLeft : frame.handRight;
  const handLandmarks: ShapingNotationRcLeaderLandmark[] = [
    { id: "cuff-start", text: formatShapingNotationRcLabel(0), actionY: frame.yBottom, outlineX, priority: 0, rowCounter: 0, kind: "cuff-start" },
    { id: "cuff-end", text: formatShapingNotationRcLabel(calc.cuffRows), actionY: frame.yCuffTop, outlineX, priority: 1, rowCounter: calc.cuffRows, kind: "cuff-end" },
    { id: "hand-start", text: formatShapingNotationRcLabel(0), actionY: frame.yCuffTop + 2, outlineX, priority: 2, rowCounter: 0, kind: "hand-start" },
    { id: "hand-1-end", text: formatShapingNotationRcLabel(calc.hand1Rows), actionY: frame.ySlot, outlineX, priority: 3, rowCounter: calc.hand1Rows, kind: "hand-1-end" },
    { id: "fingertip-stop", text: formatShapingNotationRcLabel(calc.handEndRc), actionY: frame.yDomeBase, outlineX, priority: 4, rowCounter: calc.handEndRc, kind: "fingertip-stop" },
  ];
  const thumbOutlineX = frame.baseX;
  const thumbLandmarks: ShapingNotationRcLeaderLandmark[] = calc.gore
    ? [
        {
          id: "thumb-end",
          text: formatShapingNotationRcLabel(calc.thumbRows),
          actionY: frame.baseY - frame.thumbLen,
          outlineX: thumbOutlineX,
          priority: 1,
          rowCounter: calc.thumbRows,
          kind: "thumb-end",
        },
      ]
    : [
        {
          id: "thumb-start",
          text: formatShapingNotationRcLabel(0),
          actionY: frame.baseY,
          outlineX: thumbOutlineX,
          priority: 0,
          rowCounter: 0,
          kind: "thumb-start",
        },
        {
          id: "thumb-end",
          text: formatShapingNotationRcLabel(calc.thumbRows),
          actionY: frame.baseY - frame.thumbLen,
          outlineX: thumbOutlineX,
          priority: 1,
          rowCounter: calc.thumbRows,
          kind: "thumb-end",
        },
      ];

  const goreLines = [
    notation.goreStartLabel,
    ...notation.goreShortRows,
    notation.thumbRows,
  ].filter(Boolean);
  const thumbLines = calc.gore ? goreLines : [notation.thumbStsLabel, notation.thumbRows];
  const bounds = { minX: 8, minY: 16, maxX: frame.vbW - 8, maxY: frame.vbH - 8 };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(frame.vbW)} ${f(frame.vbH)}" width="100%" role="img" aria-label="Mitten shaping notation" data-diagram="mitten-shaping-notation" data-slot-edge="${slotEdge}" data-thumb-base-x="${f(frame.baseX)}" data-hand-mid-x="${f(handMid)}">
  <title>Mitten shaping notation, ${slotEdge}-edge thumb</title>
  <rect x="0" y="0" width="${f(frame.vbW)}" height="${f(frame.vbH)}" fill="#fff"/>
  <path data-mitten-outline="hand" d="${body}" fill="none" stroke="${DS_STROKE}" stroke-width="2" stroke-linejoin="round"/>
  <g data-mitten-outline="thumb" transform="translate(${f(frame.baseX)} ${f(frame.baseY)}) rotate(${f(frame.sign * THUMB_ANGLE)})">
    <path d="${thumbOutline}" fill="none" stroke="${DS_STROKE}" stroke-width="2" stroke-linejoin="round"/>
  </g>
  ${text(handMid, frame.yBottom + 22, notation.castOn, "middle", "cast-on")}
  ${text(handMid, (frame.yCuffTop + frame.yBottom) / 2, notation.cuffRows, "middle", "cuff-rows")}
  ${text(handMid, frame.yCuffTop - 16, notation.handIncrease, "middle", "hand-increase")}
  ${text(handMid, frame.yCuffTop + 16, notation.handStsLabel, "middle", "hand-sts")}
  ${text(handMid, (frame.ySlot + frame.yCuffTop) / 2, notation.hand1Rows, "middle", "hand-1-rows")}
  ${notation.markerRows ? text(shapedX, frame.ySlot - 8, notation.markerRows, shapedAnchor, "thumb-markers") : ""}
  ${text(handMid, (frame.yDomeBase + frame.ySlot) / 2, notation.straightRows, "middle", "straight-rows")}
  ${stack(shapedX, frame.yTip + 8, notation.fingertip, shapedAnchor, "fingertip-shaping")}
  ${stack(frame.baseX + frame.sign * (frame.thumbW / 2 + 28), frame.baseY - 8, thumbLines, shapedAnchor, "thumb-shaping")}
  ${rcLeaders(handLandmarks, handSide, bounds)}
  ${rcLeaders(thumbLandmarks, frame.slotRight ? "right" : "left", bounds)}
</svg>`;
}
