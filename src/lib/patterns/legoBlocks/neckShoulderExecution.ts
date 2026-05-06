/**
 * Execution-layer instructions for neckline + shoulder shaping on a flat machine-knit piece.
 * Carriage position, needle ranges, side order, and "AT THE SAME TIME" when RC ranges overlap.
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

export type NeckShoulderExecutionInput = {
  startRC: number;
  centerNeck: NeedleRange;
  leftShoulder: NeedleRange;
  rightShoulder: NeedleRange;
  neckActions: ShapingAction[];
  shoulderActions: ShapingAction[];
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

function spanToInstructionLines(span: MergedSpan): string[] {
  const { fromRC, toRC, neckTexts, shoulderTexts } = span;
  const rcStr =
    fromRC === toRC ? formatRC(fromRC) : formatRC(fromRC, toRC);
  const hasNeck = neckTexts.length > 0;
  const hasShoulder = shoulderTexts.length > 0;

  if (hasNeck && hasShoulder) {
    const combined = [...neckTexts, ...shoulderTexts].join(" ");
    return [`${rcStr}. AT THE SAME TIME: ${combined}`];
  }
  if (hasNeck) {
    return neckTexts.map((t) => `${rcStr}. ${t}`);
  }
  if (hasShoulder) {
    return shoulderTexts.map((t) => `${rcStr}. ${t}`);
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

/**
 * Row-accurate neck + shoulder {@link ShapingAction}s from a neckline timeline (same source as the printed chart).
 */
export function shapingActionsFromTimeline(timeline: readonly RowEntry[]): {
  neckActions: ShapingAction[];
  shoulderActions: ShapingAction[];
} {
  const neckActions: ShapingAction[] = [];
  const shoulderActions: ShapingAction[] = [];

  for (const entry of timeline) {
    const rc = entry.row;
    let centerBindOff = 0;
    let neckInnerLeft = 0;
    let neckInnerRight = 0;
    let shoulderOuterLeft = 0;
    let shoulderOuterRight = 0;

    for (const e of entry.events) {
      if (e.kind === "bindOff" && e.side === "center") {
        centerBindOff += e.amount;
      }
      if (
        (e.kind === "decrease" || e.kind === "bindOff") &&
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

    if (centerBindOff > 0) {
      neckActions.push({
        startRC: rc,
        endRC: rc,
        text:
          centerBindOff === 1
            ? "At center neckline, bind off 1 stitch."
            : `At center neckline, bind off ${centerBindOff} stitches.`,
      });
    }
    const neckSym =
      neckInnerLeft > 0 &&
      neckInnerRight > 0 &&
      neckInnerLeft === neckInnerRight &&
      entry.events.some((ev) => ev.kind === "bindOff" && ev.edge === "inner");
    if (neckInnerLeft > 0 || neckInnerRight > 0) {
      if (neckSym) {
        const n = neckInnerLeft;
        neckActions.push({
          startRC: rc,
          endRC: rc,
          text:
            n === 1
              ? "At neck edge, bind off 1 stitch on each side."
              : `At neck edge, bind off ${n} stitches on each side.`,
        });
      } else if (neckInnerLeft === neckInnerRight && neckInnerLeft > 0) {
        const n = neckInnerLeft;
        neckActions.push({
          startRC: rc,
          endRC: rc,
          text:
            n === 1
              ? "At neck edge, decrease 1 stitch toward center on each side."
              : `At neck edge, decrease ${n} stitches toward center on each side.`,
        });
      } else {
        neckActions.push({
          startRC: rc,
          endRC: rc,
          text: `At neck edge: left −${neckInnerLeft}, right −${neckInnerRight} (toward center).`,
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
                ? "At armhole edge, bind off 1 stitch on each shoulder."
                : `At armhole edge, bind off ${n} stitches on each shoulder.`,
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
              ? "At armhole edge, decrease 1 stitch on each shoulder."
              : `At armhole edge, decrease ${n} stitches on each shoulder.`,
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
  const { startRC, centerNeck, leftShoulder, rightShoulder, neckActions, shoulderActions } =
    input;

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
        text: "At armhole edge, short-row or bind off shoulder stitches as specified.",
      },
    ],
  });
}
