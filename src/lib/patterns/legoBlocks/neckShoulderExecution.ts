/**
 * Execution-layer instructions for neckline + shoulder shaping on a flat machine-knit piece.
 * The timeline may list both shoulders at one row-counter reading. Those readings are worked
 * on one shoulder, then repeated on the other shoulder. They are not one carriage pass.
 * Does not compute neckline or shoulder math — callers supply actions and needle labels.
 */

import type { RowEntry } from "../shapingTimeline";

export type NeedleRange = {
  label: string;
  start: string;
  end: string;
  stitchCount: number;
};

export type ShapingAction = {
  startRC: number;
  endRC?: number;
  text: string;
};

/** Optional sleeveless-style wording for center bind-off (built from timeline + chart row 0). */
export type CenterBindOffExecutionText = {
  /** Replaces the default “Bind off the center neckline stitches…” preamble line. */
  preambleLine: string;
  /** Replaces “At center neckline, bind off…” on RC-targeted shaping rows. */
  shapingAtRcLine: string;
};

export type NeckShoulderExecutionInput = {
  startRC: number;
  centerNeck: NeedleRange;
  leftShoulder: NeedleRange;
  rightShoulder: NeedleRange;
  neckActions: ShapingAction[];
  shoulderActions: ShapingAction[];
  /** When set, overrides generated center bind-off prose (see sleeveless pattern output). */
  centerBindOffExecutionText?: CenterBindOffExecutionText;
};

export type NeckShoulderExecutionOutput = {
  warnings: string[];
  lines: string[];
};

/** Formats a needle bed range from caller-supplied needle IDs (e.g. L12 – R24). */
export function formatNeedleRange(start: string, end: string): string {
  return `${start} – ${end}`;
}

/** Formats a row counter target; single row or inclusive span. */
export function formatRC(start: number, end?: number): string {
  if (end === undefined || end === start) {
    return `RC: ${start}`;
  }
  return `RC: ${start}–${end}`;
}

function actionCoversRC(action: ShapingAction, rc: number): boolean {
  const end = action.endRC ?? action.startRC;
  return rc >= action.startRC && rc <= end;
}

function textsForRC(actions: ShapingAction[], rc: number): string[] {
  return actions.filter((a) => actionCoversRC(a, rc)).map((a) => a.text);
}

function signatureForRC(
  neckActions: ShapingAction[],
  shoulderActions: ShapingAction[],
  rc: number
): string {
  const n = textsForRC(neckActions, rc).join("\0");
  const s = textsForRC(shoulderActions, rc).join("\0");
  return `${n}|${s}`;
}

function shapingBounds(
  neckActions: ShapingAction[],
  shoulderActions: ShapingAction[]
): { minRC: number; maxRC: number } | null {
  const all = [...neckActions, ...shoulderActions];
  if (all.length === 0) return null;
  let minRC = Infinity;
  let maxRC = -Infinity;
  for (const a of all) {
    const end = a.endRC ?? a.startRC;
    minRC = Math.min(minRC, a.startRC);
    maxRC = Math.max(maxRC, end);
  }
  return { minRC, maxRC };
}

type MergedSpan = { fromRC: number; toRC: number; neckTexts: string[]; shoulderTexts: string[] };

function mergeShapingSpans(
  neckActions: ShapingAction[],
  shoulderActions: ShapingAction[]
): MergedSpan[] {
  const bounds = shapingBounds(neckActions, shoulderActions);
  if (!bounds) return [];

  const { minRC, maxRC } = bounds;
  const spans: MergedSpan[] = [];

  let spanStart = minRC;
  let prevSig = signatureForRC(neckActions, shoulderActions, minRC);

  for (let rc = minRC + 1; rc <= maxRC; rc++) {
    const sig = signatureForRC(neckActions, shoulderActions, rc);
    if (sig !== prevSig) {
      spans.push({
        fromRC: spanStart,
        toRC: rc - 1,
        neckTexts: textsForRC(neckActions, spanStart),
        shoulderTexts: textsForRC(shoulderActions, spanStart),
      });
      spanStart = rc;
      prevSig = sig;
    }
  }

  spans.push({
    fromRC: spanStart,
    toRC: maxRC,
    neckTexts: textsForRC(neckActions, spanStart),
    shoulderTexts: textsForRC(shoulderActions, spanStart),
  });

  return spans;
}

/**
 * One shoulder is in work. The other shoulder repeats these readings later.
 * A shared reading is the two ends of that one row, not both shoulders at once.
 */
export const ONE_SHOULDER_AT_A_TIME_NOTE =
  "Work the right shoulder and right neck edge first. Leave the left shoulder and left neck edge in hold. Each reading below is one row on the shoulder in work. A reading that names one edge starts with the carriage at that edge. When a reading lists both a neck-edge action and a shoulder bind-off, shape the carriage-side edge first, knit across, and shape the other edge before you turn. On an odd reading that shapes both edges, the carriage starts at the neck edge. On an even reading that shapes both edges, the carriage starts at the armhole edge. If the carriage is not already at the named edge, move it there without knitting a row. After the right shoulder is finished, return the left shoulder and left neck edge to working position and repeat the same readings with the carriage at the matching edge. Do not shape both shoulders on one carriage pass.";

function spanToInstructionLines(span: MergedSpan): string[] {
  const { fromRC, toRC, neckTexts, shoulderTexts } = span;
  const rcStr = fromRC === toRC ? formatRC(fromRC) : formatRC(fromRC, toRC);
  const hasNeck = neckTexts.length > 0;
  const hasShoulder = shoulderTexts.length > 0;
  const neck = neckTexts.join(" ");
  const shoulder = shoulderTexts.join(" ");

  if (hasNeck && !hasShoulder && neckTexts.every(isCenterDivideText)) {
    return [`${rcStr}. ${neck}`];
  }
  if (hasNeck && hasShoulder) {
    if (fromRC !== toRC) {
      return [
        `${rcStr}. On the shoulder in work, shape the carriage-side edge first, knit across, then shape the other edge. ${neck} ${shoulder}`,
      ];
    }
    if (fromRC % 2 === 1) {
      return [`${rcStr}. Carriage at the neck edge. ${neck} Knit across. ${shoulder}`];
    }
    return [`${rcStr}. Carriage at the armhole edge. ${shoulder} Knit across. ${neck}`];
  }
  if (hasNeck) {
    return [`${rcStr}. Carriage at the neck edge. ${neck} Knit across.`];
  }
  if (hasShoulder) {
    return [`${rcStr}. Carriage at the armhole edge. ${shoulder} Knit across.`];
  }
  return [];
}

function emitShapingSchedule(
  neckActions: ShapingAction[],
  shoulderActions: ShapingAction[]
): string[] {
  const spans = mergeShapingSpans(neckActions, shoulderActions);
  const out: string[] = [];
  for (const span of spans) {
    out.push(...spanToInstructionLines(span));
  }
  return out;
}

function isCenterDivideText(text: string): boolean {
  return /^(Place the center|Bind off the center|Knit to center\.)/.test(text.trim());
}

function holdStitchPhrase(n: number): string {
  return n === 1 ? "1 stitch" : `${n} stitches`;
}

/** One neck-edge hold on the shoulder in work. Unequal counts name each shoulder. */
function neckEdgeHoldText(left: number, right: number): string {
  if (left === right) {
    return `Put ${holdStitchPhrase(left)} in hold at the neck edge. Shoulder stitches continue in work.`;
  }
  return `Put ${holdStitchPhrase(right)} in hold at the neck edge of the right shoulder. On the left shoulder, at this same reading, put ${holdStitchPhrase(left)} in hold at the neck edge. Shoulder stitches continue in work.`;
}

/**
 * Row-accurate neck + shoulder {@link ShapingAction}s from a neckline timeline (same source as the printed chart).
 */
export function shapingActionsFromTimeline(
  timeline: readonly RowEntry[],
  options?: {
    /** When set, used instead of “At center neckline, bind off…” for rows with a center bind-off. */
    centerBindOffShapingLine?: string;
  }
): {
  neckActions: ShapingAction[];
  shoulderActions: ShapingAction[];
} {
  const neckActions: ShapingAction[] = [];
  const shoulderActions: ShapingAction[] = [];

  for (const entry of timeline) {
    const rc = entry.row;
    let centerBindOff = 0;
    let centerHold = 0;
    let neckInnerLeft = 0;
    let neckInnerRight = 0;
    let shoulderOuterLeft = 0;
    let shoulderOuterRight = 0;

    for (const e of entry.events) {
      if (e.kind === "bindOff" && e.side === "center") {
        centerBindOff += e.amount;
      }
      if (e.kind === "hold" && e.side === "center") {
        centerHold += e.amount;
      }
      if (
        (e.kind === "decrease" || e.kind === "bindOff" || e.kind === "hold") &&
        e.edge === "inner" &&
        e.amount > 0
      ) {
        if (e.side === "left") neckInnerLeft += e.amount;
        if (e.side === "right") neckInnerRight += e.amount;
      }
      if (
        (e.kind === "decrease" || e.kind === "bindOff") &&
        e.edge === "outer" &&
        e.amount > 0
      ) {
        if (e.side === "left") shoulderOuterLeft += e.amount;
        if (e.side === "right") shoulderOuterRight += e.amount;
      }
    }

    if (centerHold > 0) {
      const centerText =
        options?.centerBindOffShapingLine?.trim() ||
        (centerHold === 1
          ? "At center neckline, place 1 stitch in hold."
          : `At center neckline, place ${centerHold} stitches in hold.`);
      neckActions.push({
        startRC: rc,
        endRC: rc,
        text: centerText,
      });
    }
    if (centerBindOff > 0) {
      const centerText =
        options?.centerBindOffShapingLine?.trim() ||
        (centerBindOff === 1
          ? "At center neckline, bind off 1 stitch."
          : `At center neckline, bind off ${centerBindOff} stitches.`);
      neckActions.push({
        startRC: rc,
        endRC: rc,
        text: centerText,
      });
    }
    const hasInnerHold = entry.events.some((ev) => ev.kind === "hold" && ev.edge === "inner");
    const neckSym =
      neckInnerLeft > 0 &&
      neckInnerRight > 0 &&
      neckInnerLeft === neckInnerRight &&
      entry.events.some((ev) => ev.kind === "bindOff" && ev.edge === "inner");
    if (neckInnerLeft > 0 || neckInnerRight > 0) {
      if (hasInnerHold) {
        neckActions.push({
          startRC: rc,
          endRC: rc,
          text: neckEdgeHoldText(neckInnerLeft, neckInnerRight),
        });
      } else if (neckSym) {
        const n = neckInnerLeft;
        neckActions.push({
          startRC: rc,
          endRC: rc,
          text:
            n === 1
              ? "Bind off 1 stitch at the neck edge."
              : `Bind off ${n} stitches at the neck edge.`,
        });
      } else if (neckInnerLeft === neckInnerRight && neckInnerLeft > 0) {
        const n = neckInnerLeft;
        neckActions.push({
          startRC: rc,
          endRC: rc,
          text:
            n === 1
              ? "Decrease 1 stitch at the neck edge, toward the center."
              : `Decrease ${n} stitches at the neck edge, toward the center.`,
        });
      } else {
        neckActions.push({
          startRC: rc,
          endRC: rc,
          text: `Neck edge on the right shoulder: remove ${neckInnerRight}. On the left shoulder, at this same reading, remove ${neckInnerLeft}.`,
        });
      }
    }
    if (shoulderOuterLeft > 0 || shoulderOuterRight > 0) {
      const outerShoulderEvents = entry.events.filter(
        (ev) =>
          ev.edge === "outer" &&
          ev.amount > 0 &&
          (ev.kind === "bindOff" || ev.kind === "decrease")
      );
      const shoulderBindOffOnly =
        outerShoulderEvents.length > 0 && outerShoulderEvents.every((ev) => ev.kind === "bindOff");

      if (shoulderBindOffOnly) {
        if (shoulderOuterLeft === shoulderOuterRight && shoulderOuterLeft > 0) {
          const n = shoulderOuterLeft;
          shoulderActions.push({
            startRC: rc,
            endRC: rc,
            text:
              n === 1
                ? "Bind off 1 stitch at the armhole edge."
                : `Bind off ${n} stitches at the armhole edge.`,
          });
        } else {
          shoulderActions.push({
            startRC: rc,
            endRC: rc,
            text: `At armhole edge: bind off left −${shoulderOuterLeft}, right −${shoulderOuterRight}.`,
          });
        }
      } else if (shoulderOuterLeft === shoulderOuterRight && shoulderOuterLeft > 0) {
        const n = shoulderOuterLeft;
        shoulderActions.push({
          startRC: rc,
          endRC: rc,
          text:
            n === 1
              ? "Decrease 1 stitch at the armhole edge."
              : `Decrease ${n} stitches at the armhole edge.`,
        });
      } else {
        shoulderActions.push({
          startRC: rc,
          endRC: rc,
          text: `At armhole edge: left shoulder −${shoulderOuterLeft}, right shoulder −${shoulderOuterRight}.`,
        });
      }
    }
  }

  return { neckActions, shoulderActions };
}

/** Row-merged RC instruction lines only (same merge as inside {@link generateNeckShoulderExecution}). */
export function mergedShapingInstructionLines(
  neckActions: readonly ShapingAction[],
  shoulderActions: readonly ShapingAction[]
): string[] {
  return emitShapingSchedule(
    neckActions as ShapingAction[],
    shoulderActions as ShapingAction[]
  );
}

function formatRangeLine(nr: NeedleRange): string {
  const range = formatNeedleRange(nr.start, nr.end);
  return `${nr.label} (${range}): ${nr.stitchCount} sts`;
}

/**
 * Generates plain-text machine-knitting execution steps for neckline + shoulder work:
 * RC targets, needle ranges (caller-supplied), default scrap/bind/work order, and merged shaping lines.
 */
export function generateNeckShoulderExecution(
  input: NeckShoulderExecutionInput
): NeckShoulderExecutionOutput {
  const warnings: string[] = [];
  if (!Number.isFinite(input.startRC) || Math.floor(input.startRC) !== input.startRC) {
    warnings.push("startRC should be a whole row count.");
  } else if (input.startRC % 2 !== 0) {
    warnings.push(
      "This section should begin on an even-numbered row (RC) with the carriage on the right."
    );
  }

  const lines: string[] = [];
  const {
    startRC,
    centerNeck,
    leftShoulder,
    rightShoulder,
    neckActions,
    shoulderActions,
    centerBindOffExecutionText,
  } = input;

  lines.push(`${formatRC(startRC)}. Carriage on the right.`);
  lines.push("Knit in pattern until neckline / shoulder execution.");
  lines.push("");
  lines.push("Needle ranges and stitch counts:");
  lines.push(formatRangeLine(rightShoulder));
  lines.push(formatRangeLine(centerNeck));
  lines.push(formatRangeLine(leftShoulder));
  lines.push("");
  lines.push("At the start of neckline shaping:");
  lines.push("Remove yarn from carriage.");
  lines.push(
    `Scrap off the right shoulder first — ${rightShoulder.stitchCount} sts, needles ${formatNeedleRange(rightShoulder.start, rightShoulder.end)}.`
  );
  lines.push(
    centerBindOffExecutionText?.preambleLine ??
      `Bind off the center neckline stitches — ${centerNeck.stitchCount} sts, needles ${formatNeedleRange(centerNeck.start, centerNeck.end)}.`
  );
  lines.push("");
  lines.push(
    `Work the left shoulder first — ${leftShoulder.stitchCount} sts, needles ${formatNeedleRange(leftShoulder.start, leftShoulder.end)}.`
  );

  const shapingLines = emitShapingSchedule(neckActions, shoulderActions);
  if (shapingLines.length > 0) {
    lines.push("While working the left shoulder (neck edge / armhole edge as noted):");
    for (const sl of shapingLines) {
      lines.push(sl);
    }
    lines.push("Knit in pattern at all other rows in this section.");
  } else {
    lines.push("Knit in pattern for the left shoulder; no RC-targeted neck or shoulder shaping supplied.");
  }

  lines.push("");
  lines.push(
    `Rehang the scrapped-off right shoulder — ${formatNeedleRange(rightShoulder.start, rightShoulder.end)}.`
  );
  lines.push(
    "Begin the second shoulder with carriage on the right at the correct RC for your piece."
  );
  lines.push(
    `Work the right shoulder — ${rightShoulder.stitchCount} sts, needles ${formatNeedleRange(rightShoulder.start, rightShoulder.end)}.`
  );

  if (shapingLines.length > 0) {
    lines.push("While working the right shoulder (same RC targets as left unless your pattern differs):");
    for (const sl of shapingLines) {
      lines.push(sl);
    }
    lines.push("Knit in pattern at all other rows in this section.");
  }

  return { warnings, lines };
}

/** Sample data + generated lines for console inspection. */
export function demoNeckShoulderExecution(): NeckShoulderExecutionOutput {
  return generateNeckShoulderExecution({
    startRC: 170,
    centerNeck: {
      label: "center neckline stitches",
      start: "L11",
      end: "R11",
      stitchCount: 22,
    },
    leftShoulder: {
      label: "left shoulder stitches",
      start: "L24",
      end: "L12",
      stitchCount: 13,
    },
    rightShoulder: {
      label: "right shoulder stitches",
      start: "R12",
      end: "R24",
      stitchCount: 13,
    },
    neckActions: [
      {
        startRC: 171,
        endRC: 174,
        text: "At neck edge, decrease 1 st every row, 4 times.",
      },
    ],
    shoulderActions: [
      {
        startRC: 171,
        endRC: 174,
        text: "At the shoulder (outer) edge, short-row or bind off shoulder stitches as specified.",
      },
    ],
  });
}
