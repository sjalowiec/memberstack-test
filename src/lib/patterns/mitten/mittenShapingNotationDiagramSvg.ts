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
import { mittenPatternSketchFrame } from "./mittenDiagramSvg";
import { buildMittenShapingNotation } from "./mittenShapingNotation";
import type { MittenCalc } from "./mittenMath";

const THUMB_ANGLE = 22;
const NOTATION_FS = 15;

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
  return `<text data-role="${role}" x="${f(x)}" y="${f(y)}" font-family="${DS_FONT}" font-size="${NOTATION_FS}" fill="${DS_MUTED}" text-anchor="${anchor}">${escapeXml(content)}</text>`;
}

function textWidth(content: string): number {
  return Math.max(NOTATION_FS, content.length * NOTATION_FS * 0.56);
}

function stack(
  x: number,
  startY: number,
  lines: readonly string[],
  anchor: "start" | "middle" | "end",
  role: string,
): string {
  return lines
    .map((line, index) => text(x, startY + index * 24, line, anchor, role))
    .join("");
}

/**
 * The two fingertip phases differ only by the leading sign.
 * The phase name sits on the line above its existing token so the type stays readable.
 * The center working-stitch count stays between them.
 */
function fingertipPhaseLines(tokens: readonly string[], gap: number): { text: string; dy: number }[] {
  const intoHold = tokens[0] ?? "";
  const working = tokens[1] ?? "";
  const returnToWork = tokens[2] ?? "";
  if (!intoHold || !returnToWork) {
    return tokens.map((text, index) => ({ text, dy: index * 24 }));
  }
  const pair = Math.min(gap, 20);
  const between = gap;
  const tokenIn = pair;
  const workingY = tokenIn + between;
  const returnLabel = workingY + between;
  const tokenOut = returnLabel + pair;
  return [
    { text: "Into hold:", dy: 0 },
    { text: intoHold, dy: tokenIn },
    { text: working, dy: workingY },
    { text: "Return to work:", dy: returnLabel },
    { text: returnToWork, dy: tokenOut },
  ];
}

export function buildMittenShapingNotationSvg(calc: MittenCalc, slotEdge: MittenSlotEdge): string {
  const notation = buildMittenShapingNotation(calc);
  const frame = mittenPatternSketchFrame(calc, slotEdge);
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
  const thumbAnchor: "start" | "end" = frame.sign > 0 ? "start" : "end";
  const angleRad = (THUMB_ANGLE * Math.PI) / 180;
  const thumbOuter =
    frame.baseX + frame.sign * (Math.sin(angleRad) * frame.thumbLen + (frame.thumbW / 2) * Math.cos(angleRad));
  const sideMin = Math.min(frame.handLeft, frame.cuffLeft, thumbOuter) - 96;
  const sideMax = Math.max(frame.handRight, frame.cuffRight, thumbOuter) + 120;
  const bounds = {
    minX: sideMin,
    minY: frame.yTip - 28,
    maxX: sideMax,
    maxY: frame.yBottom + 40,
  };
  const handPlaced = placeShapingNotationRcLandmarks({
    landmarks: handLandmarks,
    side: handSide,
    fontSize: NOTATION_FS,
    bounds,
  });
  const thumbPlaced = placeShapingNotationRcLandmarks({
    landmarks: thumbLandmarks,
    side: frame.slotRight ? "right" : "left",
    fontSize: NOTATION_FS,
    bounds,
  });
  const thumbRcSorted = [...thumbPlaced].sort((a, b) => a.labelY - b.labelY);
  const thumbNoteX = frame.sign > 0
    ? Math.max(...thumbPlaced.map((mark) => mark.labelX))
    : Math.min(...thumbPlaced.map((mark) => mark.labelX));
  const stackSpan = Math.max(0, thumbLines.length - 1) * 24;
  const upperRc = thumbRcSorted[0];
  const lowerRc = thumbRcSorted[thumbRcSorted.length - 1];
  const gapTop = upperRc ? upperRc.labelY + 32 : frame.baseY;
  const gapBottom = lowerRc && lowerRc !== upperRc ? lowerRc.labelY - 32 : gapTop + stackSpan;
  const thumbNoteY = gapBottom - gapTop >= stackSpan
    ? gapTop + (gapBottom - gapTop - stackSpan) / 2
    : (lowerRc?.labelY ?? frame.baseY) + NOTATION_FS + 10;
  const phaseStart = frame.yTip + 2;
  const thumbRcLimit = thumbPlaced.length
    ? Math.min(...thumbPlaced.map((mark) => mark.labelY - NOTATION_FS * 0.9))
    : phaseStart + 120;
  const phaseGap = Math.min(24, Math.max(18, (thumbRcLimit - 8 - phaseStart) / 4));
  const fingertipLines = fingertipPhaseLines(notation.fingertip, phaseGap);
  const labelBoxes = [
    ...[notation.castOn, notation.cuffRows, notation.handIncrease, notation.handStsLabel, notation.hand1Rows, notation.straightRows, notation.markerRows, ...fingertipLines.map((line) => line.text), ...thumbLines].filter(Boolean),
  ];
  const widest = Math.max(...labelBoxes.map((line) => textWidth(line)));
  const thumbWidest = Math.max(...thumbLines.map((line) => textWidth(line)), 0);
  const thumbNoteEdge = thumbAnchor === "start" ? thumbNoteX + thumbWidest : thumbNoteX - thumbWidest;
  const minX = Math.min(
    frame.handLeft,
    frame.cuffLeft,
    thumbOuter,
    thumbNoteEdge,
    ...handPlaced.map((mark) => (mark.anchor === "end" ? mark.labelX - textWidth(mark.text) : mark.labelX)),
    ...thumbPlaced.map((mark) => (mark.anchor === "end" ? mark.labelX - textWidth(mark.text) : mark.labelX)),
    shapedAnchor === "end" ? shapedX - widest : shapedX,
  );
  const maxX = Math.max(
    frame.handRight,
    frame.cuffRight,
    thumbOuter,
    thumbNoteEdge,
    ...handPlaced.map((mark) => (mark.anchor === "start" ? mark.labelX + textWidth(mark.text) : mark.labelX)),
    ...thumbPlaced.map((mark) => (mark.anchor === "start" ? mark.labelX + textWidth(mark.text) : mark.labelX)),
    shapedAnchor === "start" ? shapedX + widest : shapedX,
    handMid + textWidth(notation.castOn) / 2,
  );
  const minY = Math.min(frame.yTip - NOTATION_FS, frame.baseY - frame.thumbLen, ...handPlaced.map((mark) => mark.labelY - NOTATION_FS), ...thumbPlaced.map((mark) => mark.labelY - NOTATION_FS)) - 8;
  const maxY = Math.max(frame.yBottom + 28, thumbNoteY + stackSpan + NOTATION_FS, ...handPlaced.map((mark) => mark.labelY + NOTATION_FS), ...thumbPlaced.map((mark) => mark.labelY + 8)) + 12;
  const boxX = minX - 10;
  const boxW = maxX - minX + 20;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(boxX)} ${f(minY)} ${f(boxW)} ${f(maxY - minY)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mitten shaping notation" data-diagram="mitten-shaping-notation" data-slot-edge="${slotEdge}" data-thumb-base-x="${f(frame.baseX)}" data-hand-mid-x="${f(handMid)}">
  <title>Mitten shaping notation, ${slotEdge}-edge thumb</title>
  <rect x="${f(boxX)}" y="${f(minY)}" width="${f(boxW)}" height="${f(maxY - minY)}" fill="#fff"/>
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
  ${fingertipLines.map((line) => text(shapedX, phaseStart + line.dy, line.text, shapedAnchor, "fingertip-shaping")).join("")}
  ${stack(thumbNoteX, thumbNoteY, thumbLines, thumbAnchor, "thumb-shaping")}
  ${renderShapingNotationRcLeaders({ placed: handPlaced, fill: DS_MUTED, font: DS_FONT, escape: escapeXml, formatNumber: f })}
  ${renderShapingNotationRcLeaders({ placed: thumbPlaced, fill: DS_MUTED, font: DS_FONT, escape: escapeXml, formatNumber: f })}
</svg>`;
}
