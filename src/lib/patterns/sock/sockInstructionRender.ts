/**
 * Render structured Basic Socks instructions to HTML.
 * Does not recalculate garment geometry.
 */

import { buildGlossaryTooltipPlaceholderHtml } from "../../glossary/glossaryTooltipPrint";
import { buildPatternQuickTipInnerHtml } from "../patternQuickTip";
import { buildPatternExplainerVideoBodyHtml } from "../patternExplainerVideoTip";
import {
  RESET_ROW_COUNTER_TEXT,
  RESTART_ROW_COUNTER_TEXT,
  STOP_ROW_COUNTER_TEXT,
  formatRowCounterResetGarmentRcLabel,
  rowCounterResetBlockHtml,
  rowCounterRestartBlockHtml,
  rowCounterStopBlockHtml,
} from "../rowCounterReset";
import {
  type SockInstructionDocument,
  type SockInstructionSection,
  type SockInstructionStep,
  type SockNeedleHalf,
  type SockOfPair,
} from "./sockInstructionModel";
import { sockPatternSectionAnchorId } from "./sockPatternInpageNav";

/**
 * Existing KIN glossary entry “Scrap and Ravel Cast On”
 * (`src/data/glossary.json`). Do not invent a replacement “Scrap On” entry.
 */
export const SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_ID = 265;
export const SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_TERM = "Scrap and Ravel Cast On";

/** Cuff-to-Toe Cast-On help video. Toe-Up uses Scrap On instead and must not show this. */
export const SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID = "1222662401";
export const SOCK_CUFF_CAST_ON_VIDEO_TITLE = "Cuff Cast On Options";
export const SOCK_CUFF_CAST_ON_VIDEO_TIP_ID = "socks-cuff-cast-on-video";

/** Toe-Up overview / technique video (Scrap On — start of knitting from the toe). */
export const SOCK_TOE_UP_OVERVIEW_VIDEO_VIMEO_ID = "1222865852";
export const SOCK_TOE_UP_OVERVIEW_VIDEO_TITLE = "Knitting Toe-Up Socks";
export const SOCK_TOE_UP_OVERVIEW_VIDEO_TIP_ID = "socks-toe-up-overview-video";

/**
 * Complete Toe-Up walkthrough. Direct Vimeo embed on the Toe-Up pattern only.
 * Not Learning Library content 2088 — no catalog lookup or extra entitlement gate.
 */
export const SOCK_TOE_UP_COMPLETE_VIDEO_VIMEO_ID = "755126615";
export const SOCK_TOE_UP_COMPLETE_VIDEO_TITLE = "Complete Toe-Up Sock";
export const SOCK_TOE_UP_COMPLETE_VIDEO_TIP_ID = "socks-toe-up-complete-video";
export const SOCK_TOE_UP_COMPLETE_VIDEO_HEADING = "New to toe-up socks?";
export const SOCK_TOE_UP_COMPLETE_VIDEO_COPY =
  "Watch the complete Toe-Up Sock video before you begin. It walks you through the entire process from start to finish.";

/** Ankle section help video (both construction directions). */
export const SOCK_ANKLE_VIDEO_VIMEO_ID = "1222664135";
/**
 * Vimeo privacy hash from the official embed (`h=`). Required for this Hide-from-Vimeo
 * clip; the working cuff video uses the same explainer iframe without needing `h=`.
 */
export const SOCK_ANKLE_VIDEO_PRIVACY_HASH = "f045188fd1";
export const SOCK_ANKLE_VIDEO_TITLE = "Knitting the Ankle";
export const SOCK_ANKLE_VIDEO_TIP_ID = "socks-ankle-video";

/** Cuff-to-Toe Heel only — not repeated on Toe or Toe-Up. */
export const SOCK_WHY_STOP_ROW_COUNTER_TIP_ID = "socks-why-stop-row-counter";
export const SOCK_WHY_STOP_ROW_COUNTER_TITLE = "Why stop the row counter?";
export const SOCK_WHY_STOP_ROW_COUNTER_BODY =
  "During short-row shaping, you’ll follow the shaping steps rather than the row counter. Stop the counter before shaping, then restart it at RC 000 when straight knitting resumes.";

/** Cuff-to-Toe Heel help video. Vimeo title is only “heel”; no catalog title exists. */
export const SOCK_HEEL_VIDEO_VIMEO_ID = "1222667612";
export const SOCK_HEEL_VIDEO_PRIVACY_HASH = "92aac333c8";
export const SOCK_HEEL_VIDEO_TITLE = "Knitting the Heel";
export const SOCK_HEEL_VIDEO_TIP_ID = "socks-heel-video";

/** Cuff-to-Toe Toe help video. Vimeo title is only “toe”; no catalog title exists. */
export const SOCK_TOE_VIDEO_VIMEO_ID = "1222668781";
export const SOCK_TOE_VIDEO_PRIVACY_HASH = "498874f65f";
export const SOCK_TOE_VIDEO_TITLE = "Knitting the Toe";
export const SOCK_TOE_VIDEO_TIP_ID = "socks-toe-video";

/**
 * Visual short-row refresher. Direct Vimeo embed at the first short-row section
 * of each construction only. Not Learning Library content 811.
 */
export const SOCK_SHORT_ROW_REFRESHER_VIDEO_VIMEO_ID = "251895484";
export const SOCK_SHORT_ROW_REFRESHER_VIDEO_TITLE = "Short Row Refresher";
export const SOCK_SHORT_ROW_REFRESHER_VIDEO_TIP_ID = "socks-short-row-refresher-video";
export const SOCK_SHORT_ROW_REFRESHER_VIDEO_COPY =
  "Watch the technique in action before you begin your short-row shaping.";

/** Cuff-to-Toe Finishing help video. Vimeo title is “finish toe”; no catalog title exists. */
export const SOCK_TOE_FINISHING_VIDEO_VIMEO_ID = "1222676437";
export const SOCK_TOE_FINISHING_VIDEO_PRIVACY_HASH = "e46438a3c0";
export const SOCK_TOE_FINISHING_VIDEO_TITLE = "Finishing the Toe";
export const SOCK_TOE_FINISHING_VIDEO_TIP_ID = "socks-toe-finishing-video";

/** Existing KIN glossary entries used in Cuff-to-Toe toe finishing. */
export const BICKFORD_SEAM_GLOSSARY_ID = 717;
export const BICKFORD_SEAM_GLOSSARY_TERM = "Bickford Seam";
export const KITCHENER_STITCH_GLOSSARY_ID = 521;
export const KITCHENER_STITCH_GLOSSARY_TERM = "Kitchener Stitch";

/** Existing KIN glossary entry “Automatic Wrap” (`src/data/glossary.json`). */
export const AUTOMATIC_WRAP_GLOSSARY_ID = 346;
export const AUTOMATIC_WRAP_GLOSSARY_TERM = "Automatic Wrap";

export const SOCK_SECOND_SOCK_INTRO =
  "The second sock mirrors the heel and toe placement so the seams fall on the inside of each leg and foot, creating a left and right pair.";

export const SOCK_TOE_UP_KNIT_SETUP_ROW =
  "Knit 1 row. Do not count this row on the row counter.";

export const SOCK_TOE_UP_STRETCHY_BIND_OFF =
  "Bind off loosely using a stretchy bind off so the cuff can comfortably stretch over the heel.";

export const SOCK_TOE_UP_FINISH_CUFF =
  "Finish the cuff using the method of your choice — ribbing, hand-manipulated ribbing, a ribber, hand-knit ribbing, a rolled edge, or another stretchy finish. " +
  SOCK_TOE_UP_STRETCHY_BIND_OFF;

/** Toe-Up finishing only — stretchy cuff bind-off option. Direct Vimeo embed. */
export const SOCK_FIGURE_8_BIND_OFF_VIDEO_VIMEO_ID = "258782290";
export const SOCK_FIGURE_8_BIND_OFF_VIDEO_TITLE = "Figure 8 Bind Off";
export const SOCK_FIGURE_8_BIND_OFF_VIDEO_TIP_ID = "socks-figure-8-bind-off-video";
export const SOCK_FIGURE_8_BIND_OFF_VIDEO_COPY =
  "The Figure 8 Bind Off is a stretchy option that works well for sock cuffs.";

/** Point-of-use Kitchener / grafting help. Direct Vimeo embed — not Learning Library content. */
export const SOCK_KITCHENER_STITCH_VIDEO_VIMEO_ID = "339846501";
export const SOCK_KITCHENER_STITCH_VIDEO_TITLE = "Kitchener Stitch";
export const SOCK_KITCHENER_STITCH_VIDEO_TIP_ID = "socks-kitchener-stitch-video";
export const SOCK_KITCHENER_STITCH_VIDEO_COPY =
  "Watch how to graft the open stitches together for a smooth, nearly invisible join.";

/** Point-of-use Bickford side-seam help. Direct Vimeo embed — not Learning Library content. */
export const SOCK_BICKFORD_SEAM_VIDEO_VIMEO_ID = "151857516";
export const SOCK_BICKFORD_SEAM_VIDEO_TITLE = "Bickford Seam";
export const SOCK_BICKFORD_SEAM_VIDEO_TIP_ID = "socks-bickford-seam-video";
export const SOCK_BICKFORD_SEAM_VIDEO_COPY =
  "Watch how to work a flat Bickford seam for the sock's side seam.";

export function sockScrapOffHeelInstruction(stitches: number): string {
  return `Scrap off ${stitches} stitches.`;
}

/** Orientation after scrap-off, before the first short-row decrease. */
export function sockWorkingOnRemainingInstruction(stitches: number): string {
  return `Working on the remaining ${stitches} stitches:`;
}

export function sockRehangScrappedHeelInstruction(
  stitches: number,
  tubeStitches: number,
): string {
  return `Rehang the scrapped-off ${stitches} stitches. Confirm ${tubeStitches} stitches are in work.`;
}

export function sockEnsureCarriageInstruction(
  part: "heel" | "toe",
  side: "left" | "right",
): string {
  const partLabel = part === "heel" ? "heel" : "toe";
  const sideLabel = side === "right" ? "RIGHT" : "LEFT";
  return `Before beginning the ${partLabel}, make sure the carriage is on the ${sideLabel}. If necessary, knit 1 additional row. Do not count this setup row on the row counter.`;
}

export const SOCK_FINISH_THE_TOE_HEADING = "Finish the Toe";
export const SOCK_CHOOSE_TOE_FINISHING_HEADING = "Choose a finishing method:";
export const SOCK_REHANG_AND_JOIN_LABEL = "Rehang and join";
export const SOCK_GRAFT_OR_SEAM_LABEL = "Graft or seam";
export const SOCK_FOLD_RIGHT_SIDES_INSTRUCTION =
  "Fold the sock in half with right/public sides together.";
/** Toe/tube stitch counts are always even (KIN even-up + validation). */
export function sockRehangToeInstruction(toeStitches: number): string {
  const needles = toeStitches / 2;
  return `Rehang the ${toeStitches} toe stitches onto ${needles} needles, placing 2 stitches on each needle, and complete the join on the machine.`;
}
export const SOCK_GRAFT_OR_SEAM_INSTRUCTION_PREFIX =
  "Leave the stitches on the waste yarn and finish the toe using";
export const SOCK_GRAFT_OR_SEAM_INSTRUCTION_SUFFIX =
  ", according to the existing technique instructions.";

const DEFAULT_TOE_FINISHING_GROUP_LENGTH = 5;

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function halfLabel(half: SockNeedleHalf): string {
  return half === "left" ? "LEFT" : "RIGHT";
}

function knitEvenRowPhrase(rows: number): string {
  return rows === 1 ? "1 row" : `${rows} rows`;
}

function magicIntervalPhrase(rows: number): string {
  if (rows <= 1) return "every row";
  if (rows === 2) return "every other row";
  return `every ${rows} rows`;
}

function formatSockShortRowPassCount(passes: number): string {
  return `${passes} short-row passes`;
}

function formatSockShortRowShapingSummary(
  decreasePasses: number,
  increasePasses: number,
): string {
  const total = decreasePasses + increasePasses;
  return `Short-row shaping: ${total} passes total — ${decreasePasses} decreasing and ${increasePasses} increasing.`;
}

function shortRowShapingPassCounts(
  section: SockInstructionSection,
): { decrease: number; increase: number } | null {
  let decrease: number | undefined;
  let increase: number | undefined;
  for (const step of section.steps) {
    if (step.type === "short-row-in") decrease = step.rows;
    if (step.type === "short-row-out") increase = step.rows;
  }
  if (decrease == null || increase == null) return null;
  return { decrease, increase };
}

function shortRowShapingSummaryAfterOut(
  step: SockInstructionStep,
  section: SockInstructionSection,
): string {
  if (step.type !== "short-row-out") return "";
  const counts = shortRowShapingPassCounts(section);
  if (!counts) return "";
  return formatSockShortRowShapingSummary(counts.decrease, counts.increase);
}

export function wrapSockPatternSection(
  sectionId: string,
  titleHtml: string,
  contentHtml: string,
  sock: SockOfPair,
): string {
  const sid = String(sectionId).replace(/[^a-zA-Z0-9_-]/g, "");
  const htmlId = sockPatternSectionAnchorId(sock, sid);
  return `<section id="${htmlId}" class="sock-pattern-section" data-section-id="${sid}">
  <div class="sock-pattern-section__header">
    <div class="sock-pattern-section__heading">${titleHtml}</div>
  </div>
  <div class="sock-pattern-section__content">${contentHtml}</div>
</section>`;
}

function glossaryPlaceholderHtml(
  glossaryId: number,
  visibleText: string,
  ariaLabel: string,
): string {
  return buildGlossaryTooltipPlaceholderHtml(
    glossaryId,
    visibleText,
    escapeHtml,
    escapeHtml,
    { ariaLabel },
  );
}

function scrapAndRavelCastOnGlossaryHtml(visibleText: string): string {
  return buildGlossaryTooltipPlaceholderHtml(
    SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_ID,
    visibleText,
    escapeHtml,
    escapeHtml,
    { ariaLabel: SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_TERM },
  );
}

function bickfordSeamGlossaryHtml(): string {
  return glossaryPlaceholderHtml(
    BICKFORD_SEAM_GLOSSARY_ID,
    BICKFORD_SEAM_GLOSSARY_TERM,
    BICKFORD_SEAM_GLOSSARY_TERM,
  );
}

function kitchenerStitchGlossaryHtml(): string {
  return glossaryPlaceholderHtml(
    KITCHENER_STITCH_GLOSSARY_ID,
    KITCHENER_STITCH_GLOSSARY_TERM,
    KITCHENER_STITCH_GLOSSARY_TERM,
  );
}

function automaticWrapGlossaryHtml(): string {
  return glossaryPlaceholderHtml(
    AUTOMATIC_WRAP_GLOSSARY_ID,
    AUTOMATIC_WRAP_GLOSSARY_TERM,
    AUTOMATIC_WRAP_GLOSSARY_TERM,
  );
}

function contrastingWasteYarnScrapHtml(stitches: number): string {
  return `Scrap all ${stitches} stitches off the machine with contrasting waste yarn and remove the work from the machine.`;
}

/**
 * Default Cuff-to-Toe toe close is one shared scrap-off step, then two
 * finishing choices. Bickford Seam is an off-machine seaming technique
 * (glossary + long-seam copy), not a machine-rehung join.
 */
function defaultToeFinishingGroup(
  steps: SockInstructionStep[],
  index: number,
): { stitches: number } | null {
  const waste = steps[index];
  const drop = steps[index + 1];
  const fold = steps[index + 2];
  const rehang = steps[index + 3];
  const bindOff = steps[index + 4];
  if (
    waste?.type === "waste-yarn" &&
    waste.contrasting &&
    drop?.type === "drop-from-machine" &&
    fold?.type === "fold-right-sides-together" &&
    rehang?.type === "rehang-toe" &&
    bindOff?.type === "bind-off-toe-seam"
  ) {
    return { stitches: waste.stitches };
  }
  return null;
}

function renderDefaultToeFinishingChoiceHtml(stitches: number): string {
  const kitchener = kitchenerStitchGlossaryHtml();
  const bickford = bickfordSeamGlossaryHtml();
  return (
    `<p><strong>${escapeHtml(SOCK_FINISH_THE_TOE_HEADING)}</strong></p>` +
    `<p>${escapeHtml(contrastingWasteYarnScrapHtml(stitches))}</p>` +
    `<p><strong>${escapeHtml(SOCK_CHOOSE_TOE_FINISHING_HEADING)}</strong></p>` +
    `<ul>` +
    `<li><strong>${escapeHtml(SOCK_REHANG_AND_JOIN_LABEL)}:</strong> ${escapeHtml(SOCK_FOLD_RIGHT_SIDES_INSTRUCTION)} ${escapeHtml(sockRehangToeInstruction(stitches))}</li>` +
    `<li><strong>${escapeHtml(SOCK_GRAFT_OR_SEAM_LABEL)}:</strong> ${escapeHtml(SOCK_GRAFT_OR_SEAM_INSTRUCTION_PREFIX)} ${kitchener} (Grafting) or ${bickford}${escapeHtml(SOCK_GRAFT_OR_SEAM_INSTRUCTION_SUFFIX)}</li>` +
    `</ul>` +
    kitchenerStitchTipHtml()
  );
}

function outlineDefaultToeFinishingChoice(stitches: number): string[] {
  return [
    SOCK_FINISH_THE_TOE_HEADING,
    contrastingWasteYarnScrapHtml(stitches),
    SOCK_CHOOSE_TOE_FINISHING_HEADING,
    `${SOCK_REHANG_AND_JOIN_LABEL}: ${SOCK_FOLD_RIGHT_SIDES_INSTRUCTION} ${sockRehangToeInstruction(stitches)}`,
    `${SOCK_GRAFT_OR_SEAM_LABEL}: ${SOCK_GRAFT_OR_SEAM_INSTRUCTION_PREFIX} ${KITCHENER_STITCH_GLOSSARY_TERM} (Grafting) or ${BICKFORD_SEAM_GLOSSARY_TERM}${SOCK_GRAFT_OR_SEAM_INSTRUCTION_SUFFIX}`,
  ];
}

function buildSockPatternVideoTipHtml(options: {
  tipId: string;
  title: string;
  vimeoId: string;
  explainerKey: string;
  privacyHash?: string;
  videoTitle?: string;
  introHtml?: string;
}): string {
  const inner = buildPatternQuickTipInnerHtml({
    summaryLabel: options.title,
    bodyHtml: buildPatternExplainerVideoBodyHtml({
      video: {
        vimeoId: options.vimeoId,
        title: options.videoTitle ?? options.title,
        ...(options.privacyHash ? { privacyHash: options.privacyHash } : {}),
      },
      explainerKey: options.explainerKey,
      ...(options.introHtml ? { introHtml: options.introHtml } : {}),
    }),
  });
  return (
    `<div class="pattern-tip pattern-quick-tip" data-tip data-tip-id="${escapeHtml(options.tipId)}">` +
    inner +
    `</div>`
  );
}

function figure8BindOffTipHtml(): string {
  return buildSockPatternVideoTipHtml({
    tipId: SOCK_FIGURE_8_BIND_OFF_VIDEO_TIP_ID,
    title: SOCK_FIGURE_8_BIND_OFF_VIDEO_TITLE,
    vimeoId: SOCK_FIGURE_8_BIND_OFF_VIDEO_VIMEO_ID,
    explainerKey: SOCK_FIGURE_8_BIND_OFF_VIDEO_TIP_ID,
    introHtml: `<p>${escapeHtml(SOCK_FIGURE_8_BIND_OFF_VIDEO_COPY)}</p>`,
  });
}

function kitchenerStitchTipHtml(): string {
  return buildSockPatternVideoTipHtml({
    tipId: SOCK_KITCHENER_STITCH_VIDEO_TIP_ID,
    title: SOCK_KITCHENER_STITCH_VIDEO_TITLE,
    vimeoId: SOCK_KITCHENER_STITCH_VIDEO_VIMEO_ID,
    explainerKey: SOCK_KITCHENER_STITCH_VIDEO_TIP_ID,
    introHtml: `<p>${escapeHtml(SOCK_KITCHENER_STITCH_VIDEO_COPY)}</p>`,
  });
}

function bickfordSeamTipHtml(): string {
  return buildSockPatternVideoTipHtml({
    tipId: SOCK_BICKFORD_SEAM_VIDEO_TIP_ID,
    title: SOCK_BICKFORD_SEAM_VIDEO_TITLE,
    vimeoId: SOCK_BICKFORD_SEAM_VIDEO_VIMEO_ID,
    explainerKey: SOCK_BICKFORD_SEAM_VIDEO_TIP_ID,
    introHtml: `<p>${escapeHtml(SOCK_BICKFORD_SEAM_VIDEO_COPY)}</p>`,
  });
}

function toeUpCompleteVideoCalloutHtml(): string {
  return (
    `<div data-socks-toe-up-complete-video>` +
    buildSockPatternVideoTipHtml({
      tipId: SOCK_TOE_UP_COMPLETE_VIDEO_TIP_ID,
      title: SOCK_TOE_UP_COMPLETE_VIDEO_HEADING,
      videoTitle: SOCK_TOE_UP_COMPLETE_VIDEO_TITLE,
      vimeoId: SOCK_TOE_UP_COMPLETE_VIDEO_VIMEO_ID,
      explainerKey: SOCK_TOE_UP_COMPLETE_VIDEO_TIP_ID,
      introHtml: `<p>${escapeHtml(SOCK_TOE_UP_COMPLETE_VIDEO_COPY)}</p>`,
    }) +
    `</div>`
  );
}

function buildSockPatternTextTipHtml(options: {
  tipId: string;
  title: string;
  bodyText: string;
}): string {
  const inner = buildPatternQuickTipInnerHtml({
    summaryLabel: options.title,
    bodyHtml: `<p>${escapeHtml(options.bodyText)}</p>`,
  });
  return (
    `<div class="pattern-tip pattern-quick-tip" data-tip data-tip-id="${escapeHtml(options.tipId)}">` +
    inner +
    `</div>`
  );
}

function shortRowRefresherTipHtml(): string {
  return buildSockPatternVideoTipHtml({
    tipId: SOCK_SHORT_ROW_REFRESHER_VIDEO_TIP_ID,
    title: SOCK_SHORT_ROW_REFRESHER_VIDEO_TITLE,
    vimeoId: SOCK_SHORT_ROW_REFRESHER_VIDEO_VIMEO_ID,
    explainerKey: SOCK_SHORT_ROW_REFRESHER_VIDEO_TIP_ID,
    introHtml: `<p>${escapeHtml(SOCK_SHORT_ROW_REFRESHER_VIDEO_COPY)}</p>`,
  });
}

function firstShortRowSectionId(
  doc: SockInstructionDocument,
): SockInstructionSection["id"] | null {
  return (
    doc.sections.find((section) =>
      section.steps.some((step) => step.type === "short-row-in"),
    )?.id ?? null
  );
}

function sectionTipsHtml(
  section: SockInstructionSection,
  firstShortRowId: SockInstructionSection["id"] | null,
): string {
  const cuffToToe = section.constructionDirection === "cuff-to-toe";
  const tips: string[] = [];
  if (section.id === "cast-on" && cuffToToe) {
    tips.push(
      buildSockPatternVideoTipHtml({
        tipId: SOCK_CUFF_CAST_ON_VIDEO_TIP_ID,
        title: SOCK_CUFF_CAST_ON_VIDEO_TITLE,
        vimeoId: SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID,
        explainerKey: SOCK_CUFF_CAST_ON_VIDEO_TIP_ID,
      }),
    );
  }
  if (section.id === "cast-on" && !cuffToToe) {
    tips.push(
      buildSockPatternVideoTipHtml({
        tipId: SOCK_TOE_UP_OVERVIEW_VIDEO_TIP_ID,
        title: SOCK_TOE_UP_OVERVIEW_VIDEO_TITLE,
        vimeoId: SOCK_TOE_UP_OVERVIEW_VIDEO_VIMEO_ID,
        explainerKey: SOCK_TOE_UP_OVERVIEW_VIDEO_TIP_ID,
      }),
    );
  }
  if (section.id === "ankle") {
    tips.push(
      buildSockPatternVideoTipHtml({
        tipId: SOCK_ANKLE_VIDEO_TIP_ID,
        title: SOCK_ANKLE_VIDEO_TITLE,
        vimeoId: SOCK_ANKLE_VIDEO_VIMEO_ID,
        explainerKey: SOCK_ANKLE_VIDEO_TIP_ID,
        privacyHash: SOCK_ANKLE_VIDEO_PRIVACY_HASH,
      }),
    );
  }
  if (section.id === "heel" && cuffToToe) {
    tips.push(
      buildSockPatternTextTipHtml({
        tipId: SOCK_WHY_STOP_ROW_COUNTER_TIP_ID,
        title: SOCK_WHY_STOP_ROW_COUNTER_TITLE,
        bodyText: SOCK_WHY_STOP_ROW_COUNTER_BODY,
      }),
    );
    tips.push(
      buildSockPatternVideoTipHtml({
        tipId: SOCK_HEEL_VIDEO_TIP_ID,
        title: SOCK_HEEL_VIDEO_TITLE,
        vimeoId: SOCK_HEEL_VIDEO_VIMEO_ID,
        explainerKey: SOCK_HEEL_VIDEO_TIP_ID,
        privacyHash: SOCK_HEEL_VIDEO_PRIVACY_HASH,
      }),
    );
  }
  if (section.id === "toe" && cuffToToe) {
    tips.push(
      buildSockPatternVideoTipHtml({
        tipId: SOCK_TOE_VIDEO_TIP_ID,
        title: SOCK_TOE_VIDEO_TITLE,
        vimeoId: SOCK_TOE_VIDEO_VIMEO_ID,
        explainerKey: SOCK_TOE_VIDEO_TIP_ID,
        privacyHash: SOCK_TOE_VIDEO_PRIVACY_HASH,
      }),
    );
  }
  if (section.id === "finishing" && cuffToToe) {
    tips.push(
      buildSockPatternVideoTipHtml({
        tipId: SOCK_TOE_FINISHING_VIDEO_TIP_ID,
        title: SOCK_TOE_FINISHING_VIDEO_TITLE,
        vimeoId: SOCK_TOE_FINISHING_VIDEO_VIMEO_ID,
        explainerKey: SOCK_TOE_FINISHING_VIDEO_TIP_ID,
        privacyHash: SOCK_TOE_FINISHING_VIDEO_PRIVACY_HASH,
      }),
    );
  }
  if (section.id === firstShortRowId) {
    tips.push(shortRowRefresherTipHtml());
  }
  return tips.join("");
}

function renderStep(step: SockInstructionStep): string {
  switch (step.type) {
    case "reset-rc":
      return rowCounterResetBlockHtml(0);
    case "stop-rc":
      return rowCounterStopBlockHtml(step.garmentRc ?? 0);
    case "restart-rc":
      return rowCounterRestartBlockHtml(0);
    case "cast-on": {
      if (step.role === "toe") {
        const scrapOnHelp = scrapAndRavelCastOnGlossaryHtml("Scrap on");
        return `<p>${scrapOnHelp} <strong>${step.stitches} toe stitches</strong>, leaving open stitches for grafting.</p>`;
      }
      if (step.role === "remaining-foot") {
        const scrapOnHelp = scrapAndRavelCastOnGlossaryHtml("Scrap on");
        return `<p>${scrapOnHelp} the remaining <strong>${step.stitches} stitches</strong> for the full foot width (${step.totalStitches} stitches).</p>`;
      }
      return `<p>Cast on <strong>${step.stitches} stitches</strong> with the method of your choice.</p>`;
    }
    case "knit-even":
      return `<p>Knit ${knitEvenRowPhrase(step.rows)} even. (${step.stitches} stitches)</p>`;
    case "knit-setup-row":
      return `<p>${escapeHtml(SOCK_TOE_UP_KNIT_SETUP_ROW)}</p>`;
    case "magic-formula": {
      const verb = step.direction === "decrease" ? "Decrease" : "Increase";
      const lines = step.steps.map((block) => {
        const times = block.times === 1 ? "time" : "times";
        return `${verb} 1 stitch at each side ${magicIntervalPhrase(block.rows)}, ${block.times} ${times}.`;
      });
      const events = step.events
        .map(
          (event) =>
            `<p class="pattern-row-instruction__line"><strong>RC ${String(event.rowNumber).padStart(3, "0")}:</strong> ${event.stitchesAfter} stitches</p>`,
        )
        .join("");
      return `<p>${escapeHtml(lines.join(" "))}</p>${events}<p>Finish this section with ${step.endStitches} stitches.</p>`;
    }
    case "place-hold":
      return `<p>Begin with the carriage on the ${halfLabel(step.orientation.carriageStartSide)}. Put the ${halfLabel(step.orientation.holdHalf)} half of the needles (${step.holdStitches} stitches), opposite the carriage, into hold. The ${halfLabel(step.orientation.workHalf)} half (${step.workStitches} stitches) remains in work. Set the carriage to HOLD.</p>`;
    case "ensure-carriage":
      return `<p>${escapeHtml(sockEnsureCarriageInstruction(step.part, step.side))}</p>`;
    case "short-row-in":
      return `<p>On the carriage side, put 1 needle into hold, ${automaticWrapGlossaryHtml()}, and knit across. Repeat every row until ${step.remainingStitches} center stitches remain. (${formatSockShortRowPassCount(step.rows)})</p>`;
    case "short-row-out":
      return `<p>Opposite the carriage, return 1 needle to work and knit across. Repeat every row until all ${step.endWorkingStitches} working stitches are back in work. (${formatSockShortRowPassCount(step.rows)})</p>`;
    case "cancel-hold-return":
      return `<p>Cancel HOLD. Return the previously held half (${step.heldStitches} stitches) to working position. (${step.tubeStitches} stitches)</p>`;
    case "scrap-off-heel":
      return `<p>${escapeHtml(sockScrapOffHeelInstruction(step.stitches))}</p>`;
    case "working-on-remaining":
      return `<p>${escapeHtml(sockWorkingOnRemainingInstruction(step.stitches))}</p>`;
    case "rehang-scrapped-heel":
      return `<p>${escapeHtml(sockRehangScrappedHeelInstruction(step.stitches, step.tubeStitches))}</p>`;
    case "waste-yarn":
      return step.contrasting
        ? `<p>Scrap all ${step.stitches} stitches off the machine with contrasting waste yarn.</p>`
        : `<p>Scrap all ${step.stitches} stitches off the machine with waste yarn.</p>`;
    case "drop-from-machine":
      return `<p>Drop the work from the machine.</p>`;
    case "fold-right-sides-together":
      return `<p>${escapeHtml(SOCK_FOLD_RIGHT_SIDES_INSTRUCTION)}</p>`;
    case "rehang-toe":
      return `<p>${escapeHtml(sockRehangToeInstruction(step.stitches))}</p>`;
    case "bind-off-toe-seam": {
      const kitchener = kitchenerStitchGlossaryHtml();
      const bickford = bickfordSeamGlossaryHtml();
      return (
        `<p>${escapeHtml(SOCK_GRAFT_OR_SEAM_INSTRUCTION_PREFIX)} ${kitchener} (Grafting) or ${bickford}${escapeHtml(SOCK_GRAFT_OR_SEAM_INSTRUCTION_SUFFIX)}</p>` +
        kitchenerStitchTipHtml()
      );
    }
    case "bind-off":
      return `<p>Bind off ${step.stitches} stitches at the cuff.</p>`;
    case "finish-cuff":
      return (
        `<p>${escapeHtml(SOCK_TOE_UP_FINISH_CUFF)} (${step.stitches} stitches)</p>` +
        figure8BindOffTipHtml()
      );
    case "kitchener": {
      const tip = kitchenerStitchTipHtml();
      if (step.placement === "top-of-toes") {
        const kitchener = kitchenerStitchGlossaryHtml();
        return `<p>Graft or join the open toe stitches using ${kitchener} to complete the toe. Place this join on top of the toes for comfort.</p>${tip}`;
      }
      return `<p>Join / graft the toe opening using Kitchener stitch. This places the seam under the toes.</p>${tip}`;
    }
    case "seam": {
      const tip = step.suggestBickford ? bickfordSeamTipHtml() : "";
      if (step.insideLeg) {
        return step.suggestBickford
          ? `<p>Join the side seams, keeping the long seam toward the inside of the leg. A Bickford seam may be used for a flat finish.</p>${tip}`
          : `<p>Join the side seams, keeping the long seam toward the inside of the leg.</p>`;
      }
      return step.suggestBickford
        ? `<p>Sew the long seam. A Bickford seam may be used for a flat finish.</p>${tip}`
        : `<p>Sew the long seam.</p>`;
    }
    case "block":
      return `<p>Block if desired.</p>`;
    case "mirror-second-sock":
      return `<p>${SOCK_SECOND_SOCK_INTRO}</p>`;
    default:
      return "";
  }
}

function shouldShowRcLabelWithoutResetControl(section: SockInstructionSection): boolean {
  if (
    section.steps.some(
      (step) => step.type === "reset-rc" || step.type === "stop-rc" || step.type === "restart-rc",
    )
  ) {
    return false;
  }
  if (section.id === "ankle") {
    return section.constructionDirection !== "cuff-to-toe";
  }
  return section.id === "leg" && section.constructionDirection === "cuff-to-toe";
}

function renderSection(
  section: SockInstructionSection,
  firstShortRowId: SockInstructionSection["id"] | null,
): string {
  let body = "";
  const steps = section.steps;
  for (let i = 0; i < steps.length; ) {
    const grouped = defaultToeFinishingGroup(steps, i);
    if (grouped) {
      body += renderDefaultToeFinishingChoiceHtml(grouped.stitches);
      i += DEFAULT_TOE_FINISHING_GROUP_LENGTH;
      continue;
    }
    const step = steps[i]!;
    const summary = shortRowShapingSummaryAfterOut(step, section);
    body += renderStep(step) + (summary ? `<p>${escapeHtml(summary)}</p>` : "");
    i += 1;
  }
  if (shouldShowRcLabelWithoutResetControl(section)) {
    body =
      `<p class="row-counter-reset__garment-rc">${formatRowCounterResetGarmentRcLabel(section.rc.startRc)}</p>` +
      body;
  }
  const notes = section.notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("");
  return wrapSockPatternSection(
    section.id,
    `<h4>${escapeHtml(section.title)}</h4>`,
    sectionTipsHtml(section, firstShortRowId) + body + notes,
    section.sock,
  );
}

export function renderBasicSockInstructionsHtml(doc: SockInstructionDocument): string {
  const sockLabel = doc.sock === 1 ? "Sock 1" : "Sock 2";
  const direction =
    doc.constructionDirection === "cuff-to-toe" ? "Cuff to Toe" : "Toe Up";
  const intro =
    doc.constructionDirection === "toe-up" ? toeUpCompleteVideoCalloutHtml() : "";
  const firstShortRowId = firstShortRowSectionId(doc);
  return `<div class="sock-instructions" data-sock="${doc.sock}" data-construction="${doc.constructionDirection}">
  <p class="sock-instructions__label">${escapeHtml(sockLabel)} — ${escapeHtml(direction)}</p>
  ${intro}
  ${doc.sections.map((section) => renderSection(section, firstShortRowId)).join("\n")}
</div>`;
}

function outlineStep(step: SockInstructionStep): string {
  switch (step.type) {
    case "reset-rc":
      return RESET_ROW_COUNTER_TEXT;
    case "stop-rc":
      return STOP_ROW_COUNTER_TEXT;
    case "restart-rc":
      return RESTART_ROW_COUNTER_TEXT;
    case "cast-on":
      if (step.role === "toe") {
        return `Scrap on ${step.stitches} toe stitches, leaving open stitches for grafting.`;
      }
      if (step.role === "remaining-foot") {
        return `Scrap on the remaining ${step.stitches} stitches for the full foot width (${step.totalStitches} stitches).`;
      }
      return `Cast on ${step.stitches} stitches with the method of your choice.`;
    case "knit-even":
      return `Knit ${knitEvenRowPhrase(step.rows)} even (${step.stitches} stitches).`;
    case "knit-setup-row":
      return SOCK_TOE_UP_KNIT_SETUP_ROW;
    case "magic-formula": {
      const verb = step.direction === "decrease" ? "Decrease" : "Increase";
      const schedule = step.steps
        .map((block) => {
          const times = block.times === 1 ? "time" : "times";
          return `${verb} 1 stitch at each side ${magicIntervalPhrase(block.rows)}, ${block.times} ${times}`;
        })
        .join("; ");
      const last = step.events.at(-1);
      const lastRc = last ? ` Last event RC ${String(last.rowNumber).padStart(3, "0")} → ${last.stitchesAfter} stitches.` : "";
      return `${schedule}. ${step.startStitches} → ${step.endStitches} stitches over ${step.rows} rows.${lastRc}`;
    }
    case "place-hold":
      return `Carriage ${halfLabel(step.orientation.carriageStartSide)}; hold ${halfLabel(step.orientation.holdHalf)} (${step.holdStitches} sts), opposite the carriage; work ${halfLabel(step.orientation.workHalf)} (${step.workStitches} sts). Set carriage to HOLD.`;
    case "ensure-carriage":
      return sockEnsureCarriageInstruction(step.part, step.side);
    case "short-row-in":
      return `On the carriage side, put 1 needle into hold, ${AUTOMATIC_WRAP_GLOSSARY_TERM}, and knit across, every row, until ${step.remainingStitches} center stitches remain. (${formatSockShortRowPassCount(step.rows)})`;
    case "short-row-out":
      return `Opposite the carriage, return 1 needle to work and knit across, every row, until ${step.endWorkingStitches} working stitches are back. (${formatSockShortRowPassCount(step.rows)})`;
    case "cancel-hold-return":
      return `Cancel HOLD; return previously held half (${step.heldStitches} sts; ${step.tubeStitches} tube stitches).`;
    case "scrap-off-heel":
      return sockScrapOffHeelInstruction(step.stitches);
    case "working-on-remaining":
      return sockWorkingOnRemainingInstruction(step.stitches);
    case "rehang-scrapped-heel":
      return sockRehangScrappedHeelInstruction(step.stitches, step.tubeStitches);
    case "waste-yarn":
      return step.contrasting
        ? `Scrap all ${step.stitches} stitches with contrasting waste yarn.`
        : `Scrap all ${step.stitches} stitches with waste yarn.`;
    case "drop-from-machine":
      return "Drop the work from the machine.";
    case "fold-right-sides-together":
      return SOCK_FOLD_RIGHT_SIDES_INSTRUCTION;
    case "rehang-toe":
      return sockRehangToeInstruction(step.stitches);
    case "bind-off-toe-seam":
      return `${SOCK_GRAFT_OR_SEAM_INSTRUCTION_PREFIX} ${KITCHENER_STITCH_GLOSSARY_TERM} (Grafting) or ${BICKFORD_SEAM_GLOSSARY_TERM}${SOCK_GRAFT_OR_SEAM_INSTRUCTION_SUFFIX}`;
    case "bind-off":
      return `Bind off ${step.stitches} stitches at the cuff.`;
    case "finish-cuff":
      return `${SOCK_TOE_UP_FINISH_CUFF} (${step.stitches} stitches)`;
    case "kitchener":
      return step.placement === "top-of-toes"
        ? `Graft or join the open toe stitches using ${KITCHENER_STITCH_GLOSSARY_TERM} to complete the toe. Place this join on top of the toes for comfort.`
        : "Graft the toe opening (Kitchener, under the toes).";
    case "seam":
      if (step.insideLeg) {
        return step.suggestBickford
          ? "Join the side seams, keeping the long seam toward the inside of the leg (Bickford suggested)."
          : "Join the side seams, keeping the long seam toward the inside of the leg.";
      }
      return step.suggestBickford
        ? "Sew the long seam (Bickford suggested)."
        : "Sew the long seam.";
    case "block":
      return "Block if desired.";
    case "mirror-second-sock":
      return SOCK_SECOND_SOCK_INTRO;
    default:
      return "";
  }
}

/** Compact text outline for tests and review. Not a Pattern page. */
export function formatSockInstructionOutline(doc: SockInstructionDocument): string {
  const sockLabel = doc.sock === 1 ? "Sock 1" : "Sock 2";
  const direction =
    doc.constructionDirection === "cuff-to-toe" ? "Cuff to Toe" : "Toe Up";
  const lines = [`${sockLabel} — ${direction}`];
  for (const section of doc.sections) {
    const hold = section.orientation
      ? `; hold ${halfLabel(section.orientation.holdHalf)}, work ${halfLabel(section.orientation.workHalf)}, carriage ${halfLabel(section.orientation.carriageStartSide)}`
      : "";
    const depth =
      section.physicalDepthRows != null
        ? `; physical depth ${section.physicalDepthRows} rows`
        : "";
    lines.push(
      `${section.title}: ${section.startStitches}→${section.endStitches} sts, ${section.rowsToKnit} knit rows, RC ${String(section.rc.startRc).padStart(3, "0")}–${String(section.rc.endRc).padStart(3, "0")}${hold}${depth}`,
    );
    const steps = section.steps;
    for (let i = 0; i < steps.length; ) {
      const grouped = defaultToeFinishingGroup(steps, i);
      if (grouped) {
        for (const line of outlineDefaultToeFinishingChoice(grouped.stitches)) {
          lines.push(`  ${line}`);
        }
        i += DEFAULT_TOE_FINISHING_GROUP_LENGTH;
        continue;
      }
      const step = steps[i]!;
      lines.push(`  ${outlineStep(step)}`);
      const summary = shortRowShapingSummaryAfterOut(step, section);
      if (summary) lines.push(`  ${summary}`);
      i += 1;
    }
  }
  return lines.join("\n");
}

export { RESET_ROW_COUNTER_TEXT, RESTART_ROW_COUNTER_TEXT, STOP_ROW_COUNTER_TEXT };
