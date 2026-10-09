/**
 * Diagram adapter for an already-calculated set-in armhole plan.
 * Does not divide shaping stitches or change the armhole formula.
 * Sleeveless diagrams keep their own half bind-off / half decrease split.
 */

import {
  pulloverArmholeEvents,
  pulloverArmholeEventsFromSteps,
  type FrontArmholeEvent,
} from "../frontArmholeNecklineComposition";
import { formatShapingSegment } from "../shapingNotationCompress";
import type { SetInArmholePlan } from "./setInArmhole";

export type SetInArmholeDiagramShaping = {
  /** Sum of bind-off steps. Shared body silhouettes have one bind-off ledge. */
  bindOffSts: number;
  decreaseSts: number;
  straightRows: number;
  /** Working order: initial bind-off, then stair steps. */
  bindOffSteps: number[];
  events: FrontArmholeEvent[];
  /** First bind-off token, then later bind-offs, the decrease segment, and straight rows. */
  notationLines: string[];
};

function bindOffToken(stitches: number): string {
  const n = Math.max(0, Math.round(stitches));
  return n > 0 ? `bo${n}` : "";
}

function rowToken(rows: number): string {
  const n = Math.max(0, Math.round(rows));
  return n > 0 ? `${n}r` : "";
}

/**
 * Set-in plans keep every bind-off step. Other constructions keep the sleeveless
 * half bind-off / half decrease split the caller already computed.
 */
export function resolveArmholeDiagramShaping(args: {
  plan?: SetInArmholePlan | null;
  armholeStart: number;
  sleevelessBindOffSts: number;
  sleevelessDecreaseSts: number;
}): {
  bindOffSts: number;
  decreaseSts: number;
  events: FrontArmholeEvent[];
  /** Set when the plan supplies the written tokens. Otherwise the caller keeps its own text. */
  notationLines: string[] | null;
} {
  if (args.plan) {
    const shaping = setInArmholeDiagramShaping(args.plan, args.armholeStart);
    return {
      bindOffSts: shaping.bindOffSts,
      decreaseSts: shaping.decreaseSts,
      events: shaping.events,
      notationLines: shaping.notationLines,
    };
  }
  return {
    bindOffSts: args.sleevelessBindOffSts,
    decreaseSts: args.sleevelessDecreaseSts,
    events: pulloverArmholeEvents({
      firstArmholeGarmentRc: Math.floor(args.armholeStart),
      bindOffSts: args.sleevelessBindOffSts,
      decreaseSts: args.sleevelessDecreaseSts,
    }),
    notationLines: null,
  };
}

export function setInArmholeDiagramShaping(
  plan: SetInArmholePlan,
  armholeStart: number,
): SetInArmholeDiagramShaping {
  const bindOffSteps = [
    plan.initialBindOffStitchesEachSide,
    ...plan.stairStepBindOffsEachSide,
  ].filter((stitches) => stitches > 0);
  const notationLines = [
    ...bindOffSteps.map(bindOffToken),
    plan.decreaseStitchesEachSide > 0
      ? formatShapingSegment(1, 2, plan.decreaseStitchesEachSide)
      : "",
    plan.straightRows > 0 ? rowToken(plan.straightRows) : "",
  ].filter((line) => line.length > 0);

  return {
    bindOffSts: plan.matchedBindOffStitchesEachSide,
    decreaseSts: plan.decreaseStitchesEachSide,
    straightRows: plan.straightRows,
    bindOffSteps,
    events: pulloverArmholeEventsFromSteps({
      firstArmholeGarmentRc: Math.floor(armholeStart),
      bindOffStepsEachSide: bindOffSteps,
      decreaseStitchesEachSide: plan.decreaseStitchesEachSide,
    }),
    notationLines,
  };
}
