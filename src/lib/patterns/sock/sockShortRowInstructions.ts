/**
 * Shared short-row instruction primitive for Basic Socks heel and toe.
 *
 * Consumes approved {@link ShortRowShaping} counts. Does not apply the 1/3 rule.
 * Decrease/increase rows are carriage-relative (KIN automatic wrap), not
 * hard-coded left/right needle diaries.
 */

import type { ShortRowShaping, SockConstructionDirection } from "./sockMath";
import type {
  SockHoldOrientation,
  SockInstructionSection,
  SockInstructionStep,
  SockOfPair,
  SockShortRowPart,
} from "./sockInstructionModel";

function isFirstShortRowSection(
  part: SockShortRowPart,
  constructionDirection: SockConstructionDirection,
): boolean {
  return (
    (part === "heel" && constructionDirection === "cuff-to-toe") ||
    (part === "toe" && constructionDirection === "toe-up")
  );
}

export function buildSockShortRowInstructionSection(args: {
  part: SockShortRowPart;
  shaping: ShortRowShaping;
  orientation: SockHoldOrientation;
  tubeStitches: number;
  constructionDirection: SockConstructionDirection;
  sock: SockOfPair;
}): SockInstructionSection {
  const { part, shaping, orientation, tubeStitches, constructionDirection, sock } = args;
  const knittingRows = shaping.shortRowKnittingRows;
  const rcStep: SockInstructionStep = {
    type: part === "heel" ? "stop-rc" : "reset-rc",
  };
  const ensureCarriage: SockInstructionStep = {
    type: "ensure-carriage",
    part,
    side: orientation.carriageStartSide,
  };
  const rest: SockInstructionStep[] = [
    {
      type: "place-hold",
      orientation,
      holdStitches: shaping.heldStitches,
      workStitches: shaping.workingStitches,
    },
    {
      type: "short-row-in",
      rows: shaping.shortRowInSteps,
      startWorkingStitches: shaping.workingStitches,
      remainingStitches: shaping.remainingStitches,
      needleRelative: "carriage-side",
      everyRow: true,
    },
    { type: "short-row-wrap-warning" },
    {
      type: "short-row-out",
      rows: shaping.shortRowOutSteps,
      remainingStitches: shaping.remainingStitches,
      endWorkingStitches: shaping.workingStitches,
      needleRelative: "opposite-carriage",
      everyRow: true,
    },
    {
      type: "cancel-hold-return",
      heldStitches: shaping.heldStitches,
      tubeStitches,
    },
  ];
  const firstShortRow = isFirstShortRowSection(part, constructionDirection);
  const steps: SockInstructionStep[] =
    firstShortRow && part === "heel"
      ? [rcStep, ensureCarriage, ...rest]
      : firstShortRow && part === "toe"
        ? [ensureCarriage, rcStep, ...rest]
        : [rcStep, ...rest];
  return {
    id: part,
    title: part === "heel" ? "Heel" : "Toe",
    constructionDirection,
    sock,
    startStitches: tubeStitches,
    endStitches: tubeStitches,
    rowsToKnit: knittingRows,
    rc: { resetAtStart: true, startRc: 0, endRc: knittingRows },
    physicalDepthRows: shaping.shortRowDepthRows,
    shortRowKnittingRows: knittingRows,
    orientation,
    steps,
    notes: [],
  };
}
