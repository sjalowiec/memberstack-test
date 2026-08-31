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
  SockOfPair,
  SockShortRowPart,
} from "./sockInstructionModel";

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
    steps: [
      { type: part === "heel" ? "stop-rc" : "reset-rc" },
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
    ],
    notes: [],
  };
}
