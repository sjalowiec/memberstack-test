/**
 * Shared short-row instruction primitive for Basic Socks heel and toe.
 *
 * Consumes approved {@link ShortRowShaping} counts. Does not apply the 1/3 rule.
 * Decrease/increase rows are carriage-relative (KIN automatic wrap), not
 * hard-coded left/right needle diaries.
 *
 * Cuff-to-Toe puts the idle half in HOLD. Toe-Up starts the toe with only the
 * working stitches on the bed, and scraps the idle heel stitches off then
 * rehangs them — same stitch counts, different stitch management.
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

type HeldHalfHandling = "hold" | "scrap-off-rehang" | "none";

function heldHalfHandling(
  part: SockShortRowPart,
  constructionDirection: SockConstructionDirection,
): HeldHalfHandling {
  if (constructionDirection !== "toe-up") return "hold";
  return part === "toe" ? "none" : "scrap-off-rehang";
}

export function buildSockShortRowInstructionSection(args: {
  part: SockShortRowPart;
  shaping: ShortRowShaping;
  orientation: SockHoldOrientation;
  tubeStitches: number;
  constructionDirection: SockConstructionDirection;
  sock: SockOfPair;
  /**
   * Prior-section RC shown when the counter is stopped without resetting.
   * Cuff-to-Toe toe and Toe-Up heel inherit the Foot ending RC.
   */
  arriveRc?: number;
}): SockInstructionSection {
  const { part, shaping, orientation, tubeStitches, constructionDirection, sock } = args;
  const knittingRows = shaping.shortRowKnittingRows;
  const handling = heldHalfHandling(part, constructionDirection);
  const onBedStitches = handling === "none" ? shaping.workingStitches : tubeStitches;
  const inheritPriorRc = args.arriveRc != null;
  const arriveRc = args.arriveRc ?? 0;
  const rcStep: SockInstructionStep = inheritPriorRc
    ? { type: "stop-rc", garmentRc: arriveRc }
    : part === "heel"
      ? { type: "stop-rc" }
      : { type: "reset-rc" };
  const ensureCarriage: SockInstructionStep = {
    type: "ensure-carriage",
    part,
    side: orientation.carriageStartSide,
  };
  const setupHeld: SockInstructionStep[] =
    handling === "hold"
      ? [
          {
            type: "place-hold",
            orientation,
            holdStitches: shaping.heldStitches,
            workStitches: shaping.workingStitches,
          },
        ]
      : handling === "scrap-off-rehang"
        ? [
            {
              type: "scrap-off-heel",
              orientation,
              stitches: shaping.heldStitches,
            },
            {
              type: "working-on-remaining",
              stitches: shaping.workingStitches,
            },
          ]
        : [];
  const restoreHeld: SockInstructionStep[] =
    handling === "hold"
      ? [
          {
            type: "cancel-hold-return",
            heldStitches: shaping.heldStitches,
            tubeStitches,
          },
        ]
      : handling === "scrap-off-rehang"
        ? [
            {
              type: "rehang-scrapped-heel",
              stitches: shaping.heldStitches,
              tubeStitches,
            },
          ]
        : [];
  const rest: SockInstructionStep[] = [
    ...setupHeld,
    {
      type: "short-row-in",
      rows: shaping.shortRowInSteps,
      startWorkingStitches: shaping.workingStitches,
      remainingStitches: shaping.remainingStitches,
      needleRelative: "carriage-side",
      everyRow: true,
    },
    {
      type: "short-row-out",
      rows: shaping.shortRowOutSteps,
      remainingStitches: shaping.remainingStitches,
      endWorkingStitches: shaping.workingStitches,
      needleRelative: "opposite-carriage",
      everyRow: true,
    },
    ...restoreHeld,
  ];
  const firstShortRow = isFirstShortRowSection(part, constructionDirection);
  const knitSetup: SockInstructionStep[] =
    firstShortRow && part === "toe" ? [{ type: "knit-setup-row" }] : [];
  const steps: SockInstructionStep[] =
    firstShortRow && part === "heel"
      ? [rcStep, ensureCarriage, ...rest]
      : firstShortRow && part === "toe"
        ? [ensureCarriage, ...knitSetup, rcStep, ...rest]
        : [rcStep, ...rest];
  return {
    id: part,
    title: part === "heel" ? "Heel" : "Toe",
    constructionDirection,
    sock,
    startStitches: onBedStitches,
    endStitches: onBedStitches,
    rowsToKnit: knittingRows,
    rc: inheritPriorRc
      ? { resetAtStart: false, startRc: arriveRc, endRc: knittingRows }
      : { resetAtStart: true, startRc: 0, endRc: knittingRows },
    physicalDepthRows: shaping.shortRowDepthRows,
    shortRowKnittingRows: knittingRows,
    orientation,
    steps,
    notes: [],
  };
}
