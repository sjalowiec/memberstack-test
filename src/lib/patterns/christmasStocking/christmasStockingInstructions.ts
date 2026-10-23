/**
 * One Christmas stocking, using the Basic Socks short-row construction.
 * Sock pair, mirrored-sock, and extra cuff-length wording stay in the sock renderer.
 */

import { buildBasicSockInstructions } from "../sock/sockInstructionBuild";
import type { SockInstructionDocument, SockInstructionStep } from "../sock/sockInstructionModel";
import {
  renderBasicSockInstructionsHtml,
  SOCK_BICKFORD_SEAM_VIDEO_COPY,
  SOCK_FIGURE_8_BIND_OFF_VIDEO_COPY,
  SOCK_FOLD_RIGHT_SIDES_INSTRUCTION,
  SOCK_TOE_UP_COMPLETE_VIDEO_COPY,
  SOCK_TOE_UP_COMPLETE_VIDEO_HEADING,
  SOCK_TOE_UP_COMPLETE_VIDEO_TITLE,
  SOCK_TOE_UP_FINISH_CUFF,
  SOCK_TOE_UP_OVERVIEW_VIDEO_TITLE,
} from "../sock/sockInstructionRender";
import type { BasicSockCalc } from "../sock/sockMath";

export const STOCKING_LEG_LENGTH_NOTE =
  "The leg length is the finished distance from the top edge to the start of the heel. Work the top edging — ribbing, a rolled edge, or another finish — inside this length. Do not add extra rows for the edging.";

export const STOCKING_ANKLE_INCLUDED_NOTE =
  "These ankle rows are part of the leg length above. They are not added after it.";

export const STOCKING_TOP_EDGE_WITHIN_LEG =
  "The rows already knit include the top edging. Work ribbing, a rolled edge, or another finish within that leg length. Do not knit extra rows for the edging. Bind off loosely.";

export const STOCKING_HANGING_LOOP_NOTE =
  "Optional hanging loop: make an i-cord or twisted cord in a length of your choice and attach it at the top edge.";

export const STOCKING_TOE_JOIN =
  "Place this join along the top of the toe.";

function withoutPairStep(step: SockInstructionStep): SockInstructionStep | null {
  if (step.type === "mirror-second-sock") return null;
  if (step.type === "seam") {
    const { insideLeg: _insideLeg, ...rest } = step;
    return rest;
  }
  return step;
}

export function buildChristmasStockingInstructions(calc: BasicSockCalc): SockInstructionDocument {
  const doc = buildBasicSockInstructions(calc, 1);
  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      steps: section.steps
        .map(withoutPairStep)
        .filter((step): step is SockInstructionStep => step != null),
      notes: [
        ...(section.id === "leg" ? [STOCKING_LEG_LENGTH_NOTE] : []),
        ...(section.id === "ankle" ? [STOCKING_ANKLE_INCLUDED_NOTE] : []),
        ...(section.id === "finishing" ? [STOCKING_HANGING_LOOP_NOTE] : []),
        ...section.notes,
      ],
    })),
  };
}

export function renderChristmasStockingInstructionsHtml(calc: BasicSockCalc): string {
  const html = renderBasicSockInstructionsHtml(buildChristmasStockingInstructions(calc));
  return html
    .replace("Sock 1 — Cuff to Toe", "Christmas Stocking — Cuff down")
    .replace("Sock 1 — Toe Up", "Christmas Stocking — Toe up")
    .replaceAll(SOCK_TOE_UP_FINISH_CUFF, STOCKING_TOP_EDGE_WITHIN_LEG)
    .replaceAll("Place this join on top of the toes for comfort.", STOCKING_TOE_JOIN)
    .replaceAll(SOCK_FIGURE_8_BIND_OFF_VIDEO_COPY, "The Figure 8 Bind Off is a stretchy option for the top edge.")
    .replaceAll(SOCK_TOE_UP_COMPLETE_VIDEO_HEADING, "New to toe-up knitting?")
    .replaceAll(SOCK_TOE_UP_COMPLETE_VIDEO_TITLE, "Complete toe-up construction")
    .replaceAll(SOCK_TOE_UP_OVERVIEW_VIDEO_TITLE, "Knitting toe up")
    .replaceAll(
      SOCK_TOE_UP_COMPLETE_VIDEO_COPY,
      "Watch the complete toe-up video before you begin. It walks through this construction from start to finish.",
    )
    .replaceAll(SOCK_FOLD_RIGHT_SIDES_INSTRUCTION, "Fold the stocking in half with right/public sides together.")
    .replaceAll(SOCK_BICKFORD_SEAM_VIDEO_COPY, "Watch how to work a flat Bickford seam for the side seam.");
}
