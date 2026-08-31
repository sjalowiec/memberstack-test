/**
 * Structured Basic Socks instruction model.
 *
 * Consumes approved {@link BasicSockCalc} values. Does not recalculate geometry.
 * Hold/work sides and carriage start are orientation metadata for a mirrored pair.
 */

import type { MagicFormulaPairedEvent } from "../../shaping/magicFormulaPaired";
import type { ShapingStep } from "../../shaping/generateRowByRow";
import type {
  SockConstructionDirection,
  SockLegShapingDirection,
} from "./sockMath";

export type SockNeedleHalf = "left" | "right";
export type SockOfPair = 1 | 2;
export type SockShortRowPart = "heel" | "toe";

/**
 * Default Basic Socks v1 closes the toe by rehanging and binding off
 * (seam on top of the toes). The Kitchener-under-toes path is reserved
 * for a future draft choice and is not selected in this pass.
 */
export type SockToeFinishingVariation = "bind-off-top" | "kitchener-under";
export const SOCK_TOE_FINISHING_DEFAULT: SockToeFinishingVariation = "bind-off-top";

export const SOCK_SHORT_ROW_WRAP_WARNING =
  "Be sure to wrap the last short-row needle to prevent a hole.";

export type SockHoldOrientation = {
  sock: SockOfPair;
  part: SockShortRowPart;
  /** Side of the needle bed where heel and toe are formed. */
  workHalf: SockNeedleHalf;
  /** Opposite half, placed in hold. */
  holdHalf: SockNeedleHalf;
  /** Carriage starts on the working (heel/toe) side. */
  carriageStartSide: SockNeedleHalf;
};

/**
 * Default Basic Socks pair orientation (long seam toward the inside of each foot/leg).
 * Independent of Cuff-to-Toe vs Toe Up knitting order.
 *
 * Sock 1: heel and toe on the RIGHT (carriage RIGHT; LEFT half held).
 * Sock 2: heel and toe on the LEFT (carriage LEFT; RIGHT half held).
 */
export function sockHoldOrientation(
  sock: SockOfPair,
  part: SockShortRowPart,
): SockHoldOrientation {
  if (sock === 1) {
    return {
      sock,
      part,
      workHalf: "right",
      holdHalf: "left",
      carriageStartSide: "right",
    };
  }
  return {
    sock,
    part,
    workHalf: "left",
    holdHalf: "right",
    carriageStartSide: "left",
  };
}

export type SockInstructionSectionId =
  | "cast-on"
  | "leg"
  | "ankle"
  | "heel"
  | "foot"
  | "toe"
  | "finishing";

export type SockSectionRc = {
  /** True when this section begins with a row-counter reset to 000. */
  resetAtStart: boolean;
  /** Local RC at the first knitted row of this section (0 after a reset). */
  startRc: number;
  /** Local RC after the last knitted row of this section. */
  endRc: number;
};

export type SockInstructionStep =
  | { type: "reset-rc" }
  | { type: "stop-rc" }
  | { type: "restart-rc" }
  | { type: "cast-on"; stitches: number; role: "top-leg" | "foot-tube" }
  | { type: "knit-even"; rows: number; stitches: number }
  | {
      type: "magic-formula";
      direction: Exclude<SockLegShapingDirection, "none">;
      /** Approved schedule steps — not recalculated. */
      steps: ShapingStep[];
      events: MagicFormulaPairedEvent[];
      startStitches: number;
      endStitches: number;
      rows: number;
      shapingMode: "both";
    }
  | {
      type: "place-hold";
      orientation: SockHoldOrientation;
      holdStitches: number;
      workStitches: number;
    }
  | {
      type: "ensure-carriage";
      part: SockShortRowPart;
      side: SockNeedleHalf;
    }
  | {
      type: "short-row-in";
      rows: number;
      startWorkingStitches: number;
      remainingStitches: number;
      /** Put 1 needle into hold on the carriage side, then knit across. */
      needleRelative: "carriage-side";
      everyRow: true;
    }
  | {
      type: "short-row-out";
      rows: number;
      remainingStitches: number;
      endWorkingStitches: number;
      /** Return 1 needle to work opposite the carriage, then knit across. */
      needleRelative: "opposite-carriage";
      everyRow: true;
    }
  | { type: "short-row-wrap-warning" }
  | {
      type: "cancel-hold-return";
      heldStitches: number;
      tubeStitches: number;
    }
  | { type: "waste-yarn"; stitches: number; contrasting: true }
  | { type: "drop-from-machine" }
  | { type: "fold-right-sides-together" }
  | { type: "rehang-toe"; stitches: number }
  | { type: "bind-off-toe-seam"; placement: "top-of-toes" }
  | { type: "bind-off"; stitches: number }
  | { type: "kitchener"; placement: "under-toes" }
  | { type: "seam"; suggestBickford: boolean }
  | { type: "block" }
  | { type: "mirror-second-sock" };

export type SockInstructionSection = {
  id: SockInstructionSectionId;
  title: string;
  constructionDirection: SockConstructionDirection;
  sock: SockOfPair;
  startStitches: number;
  endStitches: number;
  rowsToKnit: number;
  rc: SockSectionRc;
  /**
   * One-way short-row depth rows (heel/toe only). Not in+out knitting rows.
   * Undefined on non-short-row sections.
   */
  physicalDepthRows?: number;
  /** In+out knitting rows for short-row sections. Not physical foot length. */
  shortRowKnittingRows?: number;
  orientation?: SockHoldOrientation;
  steps: SockInstructionStep[];
  notes: string[];
};

export type SockInstructionDocument = {
  constructionDirection: SockConstructionDirection;
  sock: SockOfPair;
  /** Reserved for a future cuff/ribbing option. Not selected in SocksDraft. */
  ribbing: null;
  /**
   * Cuff-to-Toe toe closing. v1 is always {@link SOCK_TOE_FINISHING_DEFAULT}.
   * Toe Up ignores this and binds off at the cuff.
   */
  toeFinishingVariation: SockToeFinishingVariation;
  sections: SockInstructionSection[];
};

export function sockInstructionSectionIds(
  doc: SockInstructionDocument,
): SockInstructionSectionId[] {
  return doc.sections.map((section) => section.id);
}
