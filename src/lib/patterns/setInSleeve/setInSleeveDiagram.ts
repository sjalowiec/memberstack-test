/**
 * Set-in sleeve diagrams from the cuff-up sleeve piece and the calculated cap.
 * Widths and row spans come from those results. This module does not size the sleeve.
 */

import type { DropShoulderSleevePieceNumbers } from "../dropShoulderSleevePieceNumbers";
import { dropShoulderSleeveShapingRcSequence } from "../dropShoulderSleeveShapingChart";
import {
  dropShoulderSleeveShapingPlan,
  formatDropShoulderSleeveShapingNotation,
} from "../dropShoulderSleeveShaping";
import {
  DS_FILL,
  DS_FS_TITLE,
  DS_FW_TITLE,
  DS_MUTED,
  DS_PAD_BOTTOM,
  DS_PAD_TOP,
  DS_STROKE,
  DS_VB_H,
  DS_VB_W,
  fmtNum,
  textFont,
  wrapGeneratedDiagramSvg,
} from "../dropShoulderPatternDiagramSvgShared";
import { DS_FS_NOTATION, DS_FS_RC } from "../dropShoulderShapingNotationDiagramShared";
import { formatShapingSegment } from "../shapingNotationCompress";
import type { SetInSleeveCapSuccess, SleeveCapPhase } from "./sleeveCapMath";

export type SetInSleeveDiagramModel = {
  wristStitches: number;
  upperArmStitches: number;
  topStitches: number;
  cuffRows: number;
  sleeveBodyRows: number;
  capRows: number;
  capHeightInches: number;
  upperArmInches: number;
  bodyShapingNotation: string;
  capNotationLines: string[];
  /** Sleeve-body row counter readings for the cuff-up increases. */
  bodyShapingRcs: number[];
  /** Rows from the start of the cap to each width change, including the start. */
  capMarks: { rowsFromCapStart: number; stitches: number }[];
};

function bindOffToken(stitches: number): string {
  const n = Math.max(0, Math.round(stitches));
  return n > 0 ? `bo${n}` : "";
}

function rowToken(rows: number): string {
  const n = Math.max(0, Math.round(rows));
  return n > 0 ? `${n}r` : "";
}

export function setInSleeveCapNotationLines(cap: SetInSleeveCapSuccess): string[] {
  const lines: string[] = [];
  for (const phase of cap.phases) {
    lines.push(...notationLinesForPhase(phase));
  }
  return lines.filter((line) => line.length > 0);
}

function notationLinesForPhase(phase: SleeveCapPhase): string[] {
  if (phase.kind === "underarm-bind-off" || phase.kind === "stair-step-bind-off") {
    const token = bindOffToken(phase.stitchesEachSide);
    return token ? [token] : [];
  }
  if (phase.kind === "decrease-zone") {
    return phase.steps
      .filter((step) => step.stitchesEachSide > 0 && step.everyRows > 0 && step.times > 0)
      .map((step) => formatShapingSegment(step.stitchesEachSide, step.everyRows, step.times));
  }
  if (phase.kind === "upper-slope") {
    const lines = phase.steps
      .map((step) => bindOffToken(step.stitchesEachSide))
      .filter((line) => line.length > 0);
    const plain = rowToken(phase.plainRows);
    if (plain) lines.push(plain);
    return lines;
  }
  const token = bindOffToken(phase.stitches);
  return token ? [token] : [];
}

/**
 * Cap outline widths. A phase is subdivided only when its stored steps add up
 * to that phase's stored row count and stitch count.
 */
export function setInSleeveCapOutlineMarks(
  cap: SetInSleeveCapSuccess,
): { rowsFromCapStart: number; stitches: number }[] {
  const marks = [{ rowsFromCapStart: 0, stitches: cap.sleeve.upperArmStitches }];
  let rows = 0;
  let stitches = cap.sleeve.upperArmStitches;
  for (const phase of cap.phases) {
    if (phase.kind === "top-bind-off") {
      marks.push({ rowsFromCapStart: rows, stitches: phase.stitches });
      continue;
    }
    const steps = subdividedPhase(phase, stitches);
    const stepRows = steps.reduce((sum, step) => sum + step.rows, 0);
    const endStitches = steps.length > 0 ? steps[steps.length - 1]!.stitches : stitches;
    if (steps.length > 0 && stepRows === phase.rows && endStitches === phase.stitchesAfter) {
      for (const step of steps) {
        rows += step.rows;
        stitches = step.stitches;
        marks.push({ rowsFromCapStart: rows, stitches });
      }
      continue;
    }
    rows += phase.rows;
    stitches = phase.stitchesAfter;
    marks.push({ rowsFromCapStart: rows, stitches });
  }
  return marks;
}

function subdividedPhase(
  phase: Exclude<SleeveCapPhase, { kind: "top-bind-off" }>,
  stitches: number,
): { rows: number; stitches: number }[] {
  if (phase.kind === "underarm-bind-off" || phase.kind === "stair-step-bind-off") {
    return [{ rows: phase.rows, stitches: phase.stitchesAfter }];
  }
  if (phase.kind === "decrease-zone") {
    const steps: { rows: number; stitches: number }[] = [];
    let cursor = stitches;
    for (const step of phase.steps) {
      cursor -= 2 * step.stitchesEachSide * step.times;
      steps.push({ rows: step.everyRows * step.times, stitches: cursor });
    }
    return steps;
  }
  const steps: { rows: number; stitches: number }[] = [];
  let cursor = stitches;
  for (const step of phase.steps) {
    cursor -= 2 * step.stitchesEachSide;
    steps.push({ rows: step.rows, stitches: cursor });
  }
  if (phase.plainRows > 0) steps.push({ rows: phase.plainRows, stitches: cursor });
  return steps;
}

export function buildSetInSleeveDiagramModel(input: {
  sleevePiece: DropShoulderSleevePieceNumbers | null | undefined;
  sleeveCap: SetInSleeveCapSuccess | null | undefined;
}): SetInSleeveDiagramModel | null {
  const piece = input.sleevePiece;
  const cap = input.sleeveCap;
  if (!piece || !cap) return null;
  if (piece.wristSts <= 0 || piece.topSts <= 0 || piece.cuffRows < 0 || piece.sleeveBodyRows <= 0) {
    return null;
  }
  const plan = dropShoulderSleeveShapingPlan({
    topSts: piece.topSts,
    wristSts: piece.wristSts,
    sleeveBodyRows: piece.sleeveBodyRows,
  });
  return {
    wristStitches: piece.wristSts,
    upperArmStitches: piece.topSts,
    topStitches: cap.totals.finalStitches,
    cuffRows: piece.cuffRows,
    sleeveBodyRows: piece.sleeveBodyRows,
    capRows: cap.totals.capRows,
    capHeightInches: cap.totals.capHeightInches,
    upperArmInches: cap.sleeve.finishedUpperArmInches,
    bodyShapingNotation: formatDropShoulderSleeveShapingNotation(plan.steps),
    capNotationLines: setInSleeveCapNotationLines(cap),
    bodyShapingRcs: dropShoulderSleeveShapingRcSequence({
      topSts: piece.topSts,
      wristSts: piece.wristSts,
      cuffRows: piece.cuffRows,
      sleeveBodyRows: piece.sleeveBodyRows,
      sleeveTotalRows: piece.sleeveTotalRows,
      direction: "cuff-up",
    }),
    capMarks: setInSleeveCapOutlineMarks(cap),
  };
}

type Pt = { x: number; y: number };

function scaleBands(cuffRows: number, bodyRows: number, capRows: number): {
  cuffH: number;
  bodyH: number;
  capH: number;
} {
  const maxH = DS_VB_H - DS_PAD_TOP - DS_PAD_BOTTOM;
  const cuff = Math.max(0, cuffRows);
  const body = Math.max(1, bodyRows);
  const cap = Math.max(1, capRows);
  const total = cuff + body + cap;
  let cuffH = cuff > 0 ? Math.max(26, (cuff / total) * maxH) : 0;
  let bodyH = Math.max(70, (body / total) * maxH);
  let capH = Math.max(88, (cap / total) * maxH);
  const sum = cuffH + bodyH + capH;
  if (sum > maxH) {
    const k = maxH / sum;
    cuffH *= k;
    bodyH *= k;
    capH *= k;
  }
  return { cuffH, bodyH, capH };
}

function buildFrame(model: SetInSleeveDiagramModel): {
  points: Pt[];
  capPoints: Pt[];
  midX: number;
  wristY: number;
  cuffJoinY: number;
  capStartY: number;
  capTopY: number;
} {
  const midX = DS_VB_W / 2;
  const maxW = DS_VB_W - 150;
  const minW = maxW * 0.28;
  const maxSts = Math.max(model.wristStitches, model.upperArmStitches, model.topStitches, 1);
  const widthFor = (stitches: number) => {
    const t = Math.max(0, Math.min(1, stitches / maxSts));
    return minW + (maxW - minW) * t;
  };
  const { cuffH, bodyH, capH } = scaleBands(model.cuffRows, model.sleeveBodyRows, model.capRows);
  const wristY = DS_VB_H - DS_PAD_BOTTOM;
  const cuffJoinY = wristY - cuffH;
  const capStartY = cuffJoinY - bodyH;
  const capTopY = capStartY - capH;
  const yInCap = (rowsFromCapStart: number) => {
    const span = Math.max(1, model.capRows);
    const t = Math.max(0, Math.min(1, rowsFromCapStart / span));
    return capStartY - t * capH;
  };
  const edge = (stitches: number, y: number): [Pt, Pt] => {
    const half = widthFor(stitches) / 2;
    return [
      { x: midX - half, y },
      { x: midX + half, y },
    ];
  };
  const [wristL, wristR] = edge(model.wristStitches, wristY);
  const [cuffL, cuffR] = edge(model.wristStitches, cuffJoinY);
  const capSpan = Math.max(1, model.capMarks[model.capMarks.length - 1]?.rowsFromCapStart ?? model.capRows);
  const capPoints = model.capMarks.map((mark) => {
    const y = yInCap(mark.rowsFromCapStart * (model.capRows / capSpan));
    return edge(mark.stitches, y);
  });
  const left = [wristL, cuffL, ...capPoints.map((pair) => pair[0]!)];
  const right = [wristR, cuffR, ...capPoints.map((pair) => pair[1]!)].reverse();
  return {
    points: [...left, ...right],
    capPoints: capPoints.map((pair) => pair[1]!),
    midX,
    wristY,
    cuffJoinY,
    capStartY,
    capTopY,
  };
}

function pathD(points: readonly Pt[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${fmtNum(point.x)} ${fmtNum(point.y)}`)
    .join(" ");
}

function label(role: string, text: string, x: number, y: number, anchor: "start" | "middle" | "end", size: number): string {
  if (!text) return "";
  return `<text data-role="${role}" x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="${anchor}" fill="${DS_MUTED}" ${textFont(size)}>${escapeXml(text)}</text>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function drawSleeveSvg(model: SetInSleeveDiagramModel, mode: "sts-rows" | "shaping-notation"): string {
  const frame = buildFrame(model);
  const parts = [
    `<path data-role="sleeve-outline" d="${pathD(frame.points)} Z" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.75" stroke-linejoin="round"/>`,
    `<line data-role="cuff-join" x1="${fmtNum(frame.points[1]?.x ?? 0)}" y1="${fmtNum(frame.cuffJoinY)}" x2="${fmtNum(frame.points[frame.points.length - 2]?.x ?? 0)}" y2="${fmtNum(frame.cuffJoinY)}" stroke="${DS_STROKE}" stroke-width="1" stroke-dasharray="4 3"/>`,
    `<line data-role="cap-start" x1="${fmtNum(frame.midX - 20)}" y1="${fmtNum(frame.capStartY)}" x2="${fmtNum(frame.midX + 20)}" y2="${fmtNum(frame.capStartY)}" stroke="${DS_STROKE}" stroke-width="1" stroke-dasharray="4 3"/>`,
    `<text data-role="sleeve-piece-label" x="${fmtNum(frame.midX)}" y="${fmtNum((frame.cuffJoinY + frame.capStartY) / 2)}" text-anchor="middle" fill="${DS_STROKE}" ${textFont(DS_FS_TITLE, DS_FW_TITLE)}>SLEEVE</text>`,
  ];
  const leftX = 18;
  parts.push(label("rc-caston", "rc000", leftX, frame.wristY, "start", DS_FS_RC));
  if (model.cuffRows > 0) {
    parts.push(label("rc-cuff", `rc${String(model.cuffRows).padStart(3, "0")}`, leftX, frame.cuffJoinY, "start", DS_FS_RC));
    parts.push(label("rc-reset", "↺ rc000", leftX, frame.cuffJoinY - 16, "start", DS_FS_RC));
  }
  const firstRc = model.bodyShapingRcs[0];
  const lastRc = model.bodyShapingRcs[model.bodyShapingRcs.length - 1];
  if (firstRc !== undefined) {
    parts.push(label("rc-shaping-start", `rc${String(firstRc).padStart(3, "0")}`, leftX, frame.capStartY + 28, "start", DS_FS_RC));
  }
  if (lastRc !== undefined && lastRc !== firstRc) {
    parts.push(label("rc-shaping-end", `rc${String(lastRc).padStart(3, "0")}`, leftX, frame.capStartY + 14, "start", DS_FS_RC));
  }
  parts.push(
    label(
      "rc-cap-start",
      `rc${String(model.sleeveBodyRows).padStart(3, "0")}`,
      leftX,
      frame.capStartY,
      "start",
      DS_FS_RC,
    ),
  );
  parts.push(label("rc-cap-end", `rc${String(model.sleeveBodyRows + model.capRows).padStart(3, "0")}`, leftX, frame.capTopY + 12, "start", DS_FS_RC));

  if (mode === "sts-rows") {
    parts.push(label("wrist-sts", `${model.wristStitches} sts`, frame.midX, frame.wristY + 18, "middle", DS_FS_NOTATION));
    parts.push(label("cuff-rows", `${model.cuffRows} rows`, frame.midX, frame.cuffJoinY + 16, "middle", DS_FS_NOTATION));
    parts.push(label("body-rows", `${model.sleeveBodyRows} rows`, frame.midX, (frame.cuffJoinY + frame.capStartY) / 2 + 22, "middle", DS_FS_NOTATION));
    parts.push(label("upper-arm-sts", `${model.upperArmStitches} sts`, frame.midX, frame.capStartY - 14, "middle", DS_FS_NOTATION));
    parts.push(
      label(
        "cap-rows",
        `${model.capRows} rows · ${model.capHeightInches.toFixed(2)} in`,
        frame.midX,
        (frame.capStartY + frame.capTopY) / 2,
        "middle",
        DS_FS_NOTATION,
      ),
    );
    parts.push(label("top-sts", `${model.topStitches} sts`, frame.midX, frame.capTopY - 8, "middle", DS_FS_NOTATION));
    parts.push(
      label(
        "upper-arm-inches",
        `${model.upperArmInches.toFixed(2)} in`,
        frame.midX,
        frame.capStartY + 16,
        "middle",
        DS_FS_RC,
      ),
    );
  } else {
    const tokens = [
      `co${model.wristStitches}`,
      model.cuffRows > 0 ? `${model.cuffRows}r` : "",
      model.bodyShapingNotation,
      ...model.capNotationLines,
    ].filter((token) => token.length > 0);
    const rightX = DS_VB_W - 16;
    tokens.forEach((token, index) => {
      const y = frame.capTopY + 12 + index * 15;
      parts.push(label("shaping-token", token, rightX, y, "end", DS_FS_NOTATION));
    });
  }

  const title =
    mode === "sts-rows"
      ? "Set-In Sleeve - Stitches & Rows"
      : "Set-In Sleeve - Shaping Notation";
  return wrapGeneratedDiagramSvg({
    ariaLabel: title,
    className: "sleeveless-piece-split__diagram-inline set-in-sleeve-diagram",
    dataAttrs: {
      "data-set-in-sleeve-diagram": mode,
      "data-supported": "true",
      "data-wrist-stitches": model.wristStitches,
      "data-upper-arm-stitches": model.upperArmStitches,
      "data-top-stitches": model.topStitches,
      "data-cuff-rows": model.cuffRows,
      "data-sleeve-body-rows": model.sleeveBodyRows,
      "data-cap-rows": model.capRows,
      "data-body-shaping": model.bodyShapingNotation,
      "data-cap-notation": model.capNotationLines.join(" "),
      "data-body-shaping-rcs": model.bodyShapingRcs.join(","),
      "data-cap-mark-stitches": model.capMarks.map((mark) => mark.stitches).join(","),
    },
    title,
    body: parts.join(""),
  });
}

export function buildSetInSleeveStitchesRowsSvg(model: SetInSleeveDiagramModel): string {
  return drawSleeveSvg(model, "sts-rows");
}

export function buildSetInSleeveShapingNotationSvg(model: SetInSleeveDiagramModel): string {
  return drawSleeveSvg(model, "shaping-notation");
}

export function tryBuildSetInSleeveStitchesRowsSvg(input: {
  sleevePiece: DropShoulderSleevePieceNumbers | null | undefined;
  sleeveCap: SetInSleeveCapSuccess | null | undefined;
}): string | null {
  const model = buildSetInSleeveDiagramModel(input);
  if (!model) return null;
  const svg = buildSetInSleeveStitchesRowsSvg(model);
  return svg.includes('data-supported="true"') ? svg : null;
}

export function tryBuildSetInSleeveShapingNotationSvg(input: {
  sleevePiece: DropShoulderSleevePieceNumbers | null | undefined;
  sleeveCap: SetInSleeveCapSuccess | null | undefined;
}): string | null {
  const model = buildSetInSleeveDiagramModel(input);
  if (!model) return null;
  const svg = buildSetInSleeveShapingNotationSvg(model);
  return svg.includes('data-supported="true"') ? svg : null;
}
