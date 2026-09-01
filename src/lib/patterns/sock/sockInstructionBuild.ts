/**
 * Build structured Basic Socks instructions from an approved {@link BasicSockCalc}.
 * Does not recalculate circumference, heel/toe, foot, ankle, or Magic Formula math.
 */

import type { BasicSockCalc } from "./sockMath";
import {
  SOCK_TOE_FINISHING_DEFAULT,
  sockHoldOrientation,
  type SockInstructionDocument,
  type SockInstructionSection,
  type SockInstructionStep,
  type SockOfPair,
  type SockSectionRc,
  type SockToeFinishingVariation,
} from "./sockInstructionModel";
import { buildSockShortRowInstructionSection } from "./sockShortRowInstructions";

/** Concise Toe-Up opening heading; help links to Scrap and Ravel Cast On. */
export const SOCK_TOE_UP_OPENING_SECTION_TITLE = "Scrap On";

function knittingRc(rows: number): SockSectionRc {
  return { resetAtStart: true, startRc: 0, endRc: rows };
}

function continueRc(rows: number): SockSectionRc {
  return { resetAtStart: false, startRc: 0, endRc: rows };
}

function setupRc(): SockSectionRc {
  return { resetAtStart: false, startRc: 0, endRc: 0 };
}

function buildCastOnSection(
  calc: BasicSockCalc,
  sock: SockOfPair,
): SockInstructionSection {
  const toeUp = calc.constructionDirection === "toe-up";
  const stitches = toeUp ? calc.toe.workingStitches : calc.legStitches;
  return {
    id: "cast-on",
    title: toeUp ? SOCK_TOE_UP_OPENING_SECTION_TITLE : "Cast-On",
    constructionDirection: calc.constructionDirection,
    sock,
    startStitches: 0,
    endStitches: stitches,
    rowsToKnit: 0,
    rc: setupRc(),
    steps: toeUp
      ? [
          {
            type: "cast-on",
            stitches,
            role: "toe",
          },
        ]
      : [
          {
            type: "cast-on",
            stitches,
            role: "top-leg",
          },
        ],
    notes: [],
  };
}

function buildLegSection(
  calc: BasicSockCalc,
  sock: SockOfPair,
  part: { rows: number; startStitches: number; endStitches: number; kind: string },
): SockInstructionSection | null {
  if (part.rows < 1) return null;
  const knit = calc.legShapingSchedule.knitOrder;
  const shaped = part.kind === "leg-shaping" && knit.direction !== "none";
  const steps: SockInstructionStep[] = [];
  if (calc.constructionDirection !== "cuff-to-toe") {
    steps.push({ type: "reset-rc" });
  }
  if (shaped && knit.direction !== "none") {
    steps.push({
      type: "magic-formula",
      direction: knit.direction,
      steps: calc.legShapingSchedule.steps,
      events: knit.events,
      startStitches: part.startStitches,
      endStitches: part.endStitches,
      rows: part.rows,
      shapingMode: "both",
    });
  } else {
    steps.push({
      type: "knit-even",
      rows: part.rows,
      stitches: part.startStitches,
    });
  }
  return {
    id: "leg",
    title: "Leg",
    constructionDirection: calc.constructionDirection,
    sock,
    startStitches: part.startStitches,
    endStitches: part.endStitches,
    rowsToKnit: part.rows,
    rc: knittingRc(part.rows),
    steps,
    notes: [],
  };
}

function buildAnkleSection(
  calc: BasicSockCalc,
  sock: SockOfPair,
  part: { rows: number; startStitches: number; endStitches: number },
): SockInstructionSection | null {
  if (part.rows < 1) return null;
  return {
    id: "ankle",
    title: "Ankle",
    constructionDirection: calc.constructionDirection,
    sock,
    startStitches: part.startStitches,
    endStitches: part.endStitches,
    rowsToKnit: part.rows,
    rc:
      calc.constructionDirection === "cuff-to-toe"
        ? continueRc(part.rows)
        : knittingRc(part.rows),
    steps: [{ type: "knit-even", rows: part.rows, stitches: part.startStitches }],
    notes: [],
  };
}

function buildFootSection(calc: BasicSockCalc, sock: SockOfPair): SockInstructionSection {
  const toeUp = calc.constructionDirection === "toe-up";
  const steps: SockInstructionStep[] = toeUp
    ? [
        {
          type: "cast-on",
          stitches: calc.toe.heldStitches,
          role: "remaining-foot",
          totalStitches: calc.totalSockStitches,
        },
        { type: "reset-rc" },
        {
          type: "knit-even",
          rows: calc.straightFootRows,
          stitches: calc.totalSockStitches,
        },
      ]
    : [
        { type: "restart-rc" },
        {
          type: "knit-even",
          rows: calc.straightFootRows,
          stitches: calc.totalSockStitches,
        },
      ];
  return {
    id: "foot",
    title: "Foot",
    constructionDirection: calc.constructionDirection,
    sock,
    startStitches: toeUp ? calc.toe.workingStitches : calc.totalSockStitches,
    endStitches: calc.totalSockStitches,
    rowsToKnit: calc.straightFootRows,
    rc: knittingRc(calc.straightFootRows),
    steps,
    notes: [],
  };
}

function buildHeelSection(calc: BasicSockCalc, sock: SockOfPair): SockInstructionSection {
  return buildSockShortRowInstructionSection({
    part: "heel",
    shaping: calc.heel,
    orientation: sockHoldOrientation(sock, "heel"),
    tubeStitches: calc.totalSockStitches,
    constructionDirection: calc.constructionDirection,
    sock,
    arriveRc:
      calc.constructionDirection === "toe-up" ? calc.straightFootRows : undefined,
  });
}

function buildToeSection(calc: BasicSockCalc, sock: SockOfPair): SockInstructionSection {
  return buildSockShortRowInstructionSection({
    part: "toe",
    shaping: calc.toe,
    orientation: sockHoldOrientation(sock, "toe"),
    tubeStitches: calc.totalSockStitches,
    constructionDirection: calc.constructionDirection,
    sock,
    arriveRc:
      calc.constructionDirection === "cuff-to-toe" ? calc.straightFootRows : undefined,
  });
}

/**
 * Cuff-to-Toe live-stitch closing. Two distinct methods; v1 always uses
 * bind-off-top. Kitchener-under is kept as a separate path for a future
 * draft choice and is not selected here.
 */
function cuffToToeClosingSteps(
  variation: SockToeFinishingVariation,
  tubeStitches: number,
): SockInstructionStep[] {
  const scrap: SockInstructionStep[] = [
    { type: "waste-yarn", stitches: tubeStitches, contrasting: true },
    { type: "drop-from-machine" },
  ];
  if (variation === "kitchener-under") {
    return [
      ...scrap,
      { type: "kitchener", placement: "under-toes" },
      { type: "seam", suggestBickford: true },
      { type: "block" },
    ];
  }
  return [
    ...scrap,
    { type: "fold-right-sides-together" },
    { type: "rehang-toe", stitches: tubeStitches },
    { type: "bind-off-toe-seam", placement: "top-of-toes" },
    { type: "seam", suggestBickford: true },
    { type: "block" },
  ];
}

export type BuildBasicSockInstructionsOptions = {
  /**
   * Reserved for a future SocksDraft finishing choice.
   * Omitted / default is bind-off at the top of the toes.
   */
  toeFinishingVariation?: SockToeFinishingVariation;
};

function buildFinishingSection(
  calc: BasicSockCalc,
  sock: SockOfPair,
  toeFinishingVariation: SockToeFinishingVariation,
): SockInstructionSection {
  const toeUp = calc.constructionDirection === "toe-up";
  const steps: SockInstructionStep[] = toeUp
    ? [
        { type: "finish-cuff", stitches: calc.legStitches },
        { type: "kitchener", placement: "top-of-toes" },
        { type: "seam", suggestBickford: true, insideLeg: true },
        { type: "block" },
      ]
    : cuffToToeClosingSteps(toeFinishingVariation, calc.totalSockStitches);
  if (sock === 1) {
    steps.push({ type: "mirror-second-sock" });
  }
  return {
    id: "finishing",
    title: "Finishing",
    constructionDirection: calc.constructionDirection,
    sock,
    startStitches: toeUp ? calc.legStitches : calc.totalSockStitches,
    endStitches: 0,
    rowsToKnit: 0,
    rc: setupRc(),
    steps,
    notes: [],
  };
}

function appendLegAndAnkle(
  calc: BasicSockCalc,
  sock: SockOfPair,
  sections: SockInstructionSection[],
): void {
  for (const part of calc.legShapingSchedule.knitOrder.sections) {
    if (part.kind === "straight-ankle") {
      const ankle = buildAnkleSection(calc, sock, part);
      if (ankle) sections.push(ankle);
      continue;
    }
    const leg = buildLegSection(calc, sock, part);
    if (leg) sections.push(leg);
  }
}

export function buildBasicSockInstructions(
  calc: BasicSockCalc,
  sock: SockOfPair = 1,
  options?: BuildBasicSockInstructionsOptions,
): SockInstructionDocument {
  const toeFinishingVariation = options?.toeFinishingVariation ?? SOCK_TOE_FINISHING_DEFAULT;
  const sections: SockInstructionSection[] = [buildCastOnSection(calc, sock)];
  if (calc.constructionDirection === "cuff-to-toe") {
    appendLegAndAnkle(calc, sock, sections);
    sections.push(buildHeelSection(calc, sock));
    sections.push(buildFootSection(calc, sock));
    sections.push(buildToeSection(calc, sock));
  } else {
    sections.push(buildToeSection(calc, sock));
    sections.push(buildFootSection(calc, sock));
    sections.push(buildHeelSection(calc, sock));
    appendLegAndAnkle(calc, sock, sections);
  }
  sections.push(buildFinishingSection(calc, sock, toeFinishingVariation));
  return {
    constructionDirection: calc.constructionDirection,
    sock,
    ribbing: null,
    toeFinishingVariation,
    sections,
  };
}

export function buildBasicSockInstructionPair(
  calc: BasicSockCalc,
  options?: BuildBasicSockInstructionsOptions,
): {
  sock1: SockInstructionDocument;
  sock2: SockInstructionDocument;
} {
  return {
    sock1: buildBasicSockInstructions(calc, 1, options),
    sock2: buildBasicSockInstructions(calc, 2, options),
  };
}
