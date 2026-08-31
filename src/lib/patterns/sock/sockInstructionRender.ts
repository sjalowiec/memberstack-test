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
  SOCK_SHORT_ROW_WRAP_WARNING,
  type SockInstructionDocument,
  type SockInstructionSection,
  type SockInstructionStep,
  type SockNeedleHalf,
} from "./sockInstructionModel";

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

export const SOCK_SECOND_SOCK_INTRO =
  "The second sock mirrors the heel and toe placement so the seams fall on the inside of each leg and foot, creating a left and right pair.";

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
): string {
  const sid = String(sectionId).replace(/[^a-zA-Z0-9_-]/g, "");
  return `<section class="sock-pattern-section" data-section-id="${sid}">
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
  return glossaryPlaceholderHtml(
    SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_ID,
    visibleText,
    SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_TERM,
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
    `</ul>`
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
}): string {
  const inner = buildPatternQuickTipInnerHtml({
    summaryLabel: options.title,
    bodyHtml: buildPatternExplainerVideoBodyHtml({
      video: {
        vimeoId: options.vimeoId,
        title: options.title,
        ...(options.privacyHash ? { privacyHash: options.privacyHash } : {}),
      },
      explainerKey: options.explainerKey,
    }),
  });
  return (
    `<div class="pattern-tip pattern-quick-tip" data-tip data-tip-id="${escapeHtml(options.tipId)}">` +
    inner +
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

function sectionTipsHtml(section: SockInstructionSection): string {
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
  return tips.join("");
}

function renderStep(step: SockInstructionStep): string {
  switch (step.type) {
    case "reset-rc":
      return rowCounterResetBlockHtml(0);
    case "stop-rc":
      return rowCounterStopBlockHtml(0);
    case "restart-rc":
      return rowCounterRestartBlockHtml(0);
    case "cast-on": {
      if (step.role === "foot-tube") {
        const scrapOnHelp = scrapAndRavelCastOnGlossaryHtml("Scrap on");
        return `<p>${scrapOnHelp} <strong>${step.stitches} stitches</strong>.</p>`;
      }
      return `<p>Cast on <strong>${step.stitches} stitches</strong> with the method of your choice.</p>`;
    }
    case "knit-even":
      return `<p>Knit ${knitEvenRowPhrase(step.rows)} even. (${step.stitches} stitches)</p>`;
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
      return `<p>On the carriage side, put 1 needle into hold and knit across. Repeat every row until ${step.remainingStitches} center stitches remain. (${formatSockShortRowPassCount(step.rows)})</p>`;
    case "short-row-wrap-warning":
      return `<p class="sock-pattern-tip">${escapeHtml(SOCK_SHORT_ROW_WRAP_WARNING)}</p>`;
    case "short-row-out":
      return `<p>Opposite the carriage, return 1 needle to work and knit across. Repeat every row until all ${step.endWorkingStitches} working stitches are back in work. (${formatSockShortRowPassCount(step.rows)})</p>`;
    case "cancel-hold-return":
      return `<p>Cancel HOLD. Return the previously held half (${step.heldStitches} stitches) to working position. (${step.tubeStitches} stitches)</p>`;
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
      return `<p>${escapeHtml(SOCK_GRAFT_OR_SEAM_INSTRUCTION_PREFIX)} ${kitchener} (Grafting) or ${bickford}${escapeHtml(SOCK_GRAFT_OR_SEAM_INSTRUCTION_SUFFIX)}</p>`;
    }
    case "bind-off":
      return `<p>Bind off ${step.stitches} stitches at the cuff.</p>`;
    case "kitchener":
      return `<p>Join / graft the toe opening using Kitchener stitch. This places the seam under the toes.</p>`;
    case "seam":
      return step.suggestBickford
        ? `<p>Sew the long seam. A Bickford seam may be used for a flat finish.</p>`
        : `<p>Sew the long seam.</p>`;
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

function renderSection(section: SockInstructionSection): string {
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
    sectionTipsHtml(section) + body + notes,
  );
}

export function renderBasicSockInstructionsHtml(doc: SockInstructionDocument): string {
  const sockLabel = doc.sock === 1 ? "Sock 1" : "Sock 2";
  const direction =
    doc.constructionDirection === "cuff-to-toe" ? "Cuff to Toe" : "Toe Up";
  return `<div class="sock-instructions" data-sock="${doc.sock}" data-construction="${doc.constructionDirection}">
  <p class="sock-instructions__label">${escapeHtml(sockLabel)} — ${escapeHtml(direction)}</p>
  ${doc.sections.map(renderSection).join("\n")}
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
      return step.role === "foot-tube"
        ? `Scrap on ${step.stitches} stitches.`
        : `Cast on ${step.stitches} stitches with the method of your choice.`;
    case "knit-even":
      return `Knit ${knitEvenRowPhrase(step.rows)} even (${step.stitches} stitches).`;
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
      return `On the carriage side, put 1 needle into hold and knit across, every row, until ${step.remainingStitches} center stitches remain. (${formatSockShortRowPassCount(step.rows)})`;
    case "short-row-wrap-warning":
      return SOCK_SHORT_ROW_WRAP_WARNING;
    case "short-row-out":
      return `Opposite the carriage, return 1 needle to work and knit across, every row, until ${step.endWorkingStitches} working stitches are back. (${formatSockShortRowPassCount(step.rows)})`;
    case "cancel-hold-return":
      return `Cancel HOLD; return previously held half (${step.heldStitches} sts; ${step.tubeStitches} tube stitches).`;
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
    case "kitchener":
      return "Graft the toe opening (Kitchener, under the toes).";
    case "seam":
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
