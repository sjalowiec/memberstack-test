/**
 * One Christmas stocking, using the Basic Socks short-row construction.
 * Sock pair, mirrored-sock, and extra cuff-length wording stay in the sock renderer.
 */

import { buildPatternExplainerVideoBodyHtml } from "../patternExplainerVideoTip";
import { buildPatternQuickTipInnerHtml } from "../patternQuickTip";
import { formatRowCounterResetGarmentRcLabel } from "../rowCounterReset";
import { buildBasicSockInstructions } from "../sock/sockInstructionBuild";
import type {
  SockInstructionDocument,
  SockInstructionSection,
  SockInstructionStep,
} from "../sock/sockInstructionModel";
import {
  renderBasicSockInstructionsHtml,
  SOCK_BICKFORD_SEAM_VIDEO_COPY,
  SOCK_CUFF_CAST_ON_VIDEO_TIP_ID,
  SOCK_CUFF_CAST_ON_VIDEO_TITLE,
  SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID,
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

/** Cuff-down only. Edging rows already on the counter count toward this reading. */
export function stockingCuffDownLegTargetNote(legRows: number): string {
  const target = formatRowCounterResetGarmentRcLabel(legRows);
  return `Work the selected top edging — ribbing, a rolled edge, or another finish. Knit even to ${target}, counting the edging rows already knitted.`;
}

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

function cuffCastOnVideoHtml(): string {
  const inner = buildPatternQuickTipInnerHtml({
    summaryLabel: SOCK_CUFF_CAST_ON_VIDEO_TITLE,
    bodyHtml: buildPatternExplainerVideoBodyHtml({
      video: {
        vimeoId: SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID,
        title: SOCK_CUFF_CAST_ON_VIDEO_TITLE,
      },
      explainerKey: SOCK_CUFF_CAST_ON_VIDEO_TIP_ID,
    }),
  });
  return (
    `<div class="pattern-tip pattern-quick-tip" data-tip data-tip-id="${SOCK_CUFF_CAST_ON_VIDEO_TIP_ID}">` +
    inner +
    `</div>`
  );
}

/**
 * Finished cuff-down leg rows. `calc.legRows` is already length × row gauge,
 * even-upped. The sock upper-leg / ankle split is not added or removed here.
 */
function finishedLegRows(calc: BasicSockCalc): number {
  return calc.legRows;
}

function continuousCuffDownLeg(
  doc: SockInstructionDocument,
  calc: BasicSockCalc,
): SockInstructionSection {
  const rows = finishedLegRows(calc);
  const castOn = doc.sections.find((section) => section.id === "cast-on");
  const stitches = castOn?.endStitches ?? calc.legStitches;
  return {
    id: "leg",
    title: "Leg",
    constructionDirection: "cuff-to-toe",
    sock: doc.sock,
    startStitches: stitches,
    endStitches: stitches,
    rowsToKnit: rows,
    rc: { resetAtStart: false, startRc: 0, endRc: rows },
    steps: [{ type: "cast-on", stitches, role: "top-leg" }],
    notes: [stockingCuffDownLegTargetNote(rows)],
  };
}

function stopHeelAtLegRows(
  section: SockInstructionSection,
  legRows: number,
): SockInstructionSection {
  return {
    ...section,
    rc: { ...section.rc, resetAtStart: false, startRc: legRows },
    steps: section.steps.map((step) =>
      step.type === "stop-rc" ? { ...step, garmentRc: legRows } : step,
    ),
  };
}

/** Cuff-down: cast on, edging, and the full leg are one section, then Heel. */
function withContinuousCuffDownLeg(
  doc: SockInstructionDocument,
  calc: BasicSockCalc,
): SockInstructionDocument {
  const rows = finishedLegRows(calc);
  const leg = continuousCuffDownLeg(doc, calc);
  const rest = doc.sections.filter(
    (section) => section.id !== "cast-on" && section.id !== "leg" && section.id !== "ankle",
  );
  const heelAt = rest.findIndex((section) => section.id === "heel");
  const sections =
    heelAt >= 0
      ? [...rest.slice(0, heelAt), leg, ...rest.slice(heelAt)]
      : [leg, ...rest];
  return {
    ...doc,
    sections: sections.map((section) =>
      section.id === "heel" ? stopHeelAtLegRows(section, rows) : section,
    ),
  };
}

function insertCuffCastOnVideo(html: string): string {
  const marker = 'data-section-id="leg"';
  const content = '<div class="sock-pattern-section__content">';
  const sectionStart = html.indexOf(marker);
  if (sectionStart < 0) return html;
  const contentAt = html.indexOf(content, sectionStart);
  if (contentAt < 0) return html;
  const insertAt = contentAt + content.length;
  return html.slice(0, insertAt) + cuffCastOnVideoHtml() + html.slice(insertAt);
}

export function buildChristmasStockingInstructions(calc: BasicSockCalc): SockInstructionDocument {
  const cuffDown = calc.constructionDirection === "cuff-to-toe";
  const doc = buildBasicSockInstructions(calc, 1);
  const withNotes: SockInstructionDocument = {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      steps: section.steps
        .map(withoutPairStep)
        .filter((step): step is SockInstructionStep => step != null),
      notes: [
        ...(section.id === "leg" && !cuffDown ? [STOCKING_LEG_LENGTH_NOTE] : []),
        ...(section.id === "ankle" && !cuffDown ? [STOCKING_ANKLE_INCLUDED_NOTE] : []),
        ...(section.id === "finishing" ? [STOCKING_HANGING_LOOP_NOTE] : []),
        ...section.notes,
      ],
    })),
  };
  return cuffDown ? withContinuousCuffDownLeg(withNotes, calc) : withNotes;
}

export function renderChristmasStockingInstructionsHtml(calc: BasicSockCalc): string {
  const html = renderBasicSockInstructionsHtml(buildChristmasStockingInstructions(calc));
  const withVideo =
    calc.constructionDirection === "cuff-to-toe" ? insertCuffCastOnVideo(html) : html;
  return withVideo
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
