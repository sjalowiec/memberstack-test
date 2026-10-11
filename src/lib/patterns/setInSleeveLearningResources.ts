/**
 * Set-in sleeve learning resources.
 *
 * These helpers are used only by the set-in pattern. Sleeveless and drop-shoulder
 * pages keep their own neckline card and finishing links.
 */

import { buildGlossaryTooltipPlaceholderHtml } from "../glossary/glossaryTooltipPrint";
import { buildPatternHelpCardInnerHtml } from "./patternHelpCard";
import { buildPatternQuickTipInnerHtml } from "./patternQuickTip";
import {
  ARMHOLE_BIND_OFF_TRICK_CONTENT_ID,
  ARMHOLE_BIND_OFF_TRICK_VIDEO_KEY,
  necklineShoulderOrientationHelpCardInnerHtml,
  patternTipWrapperHtml,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";

/** Active glossary entry "Short Row | Partial Knitting". Inactive id 250 must not be used. */
export const SET_IN_NECKLINE_SHORT_ROW_GLOSSARY_ID = 811;

/** Glossary entry "Stair steps". */
export const SET_IN_NECKLINE_STAIR_STEPS_GLOSSARY_ID = 902;

/** Catalog content_id for "Set In Sleeve Perfection". */
export const SET_IN_SLEEVE_PERFECTION_CONTENT_ID = 580;

export const SET_IN_SLEEVE_PERFECTION_VIDEO_HREF = `/videos/${SET_IN_SLEEVE_PERFECTION_CONTENT_ID}`;

export const SET_IN_SLEEVE_PERFECTION_VIDEO_LABEL = "Set In Sleeve Perfection";

/** Dismissible tip on the first back armhole bind-off only. */
export const SET_IN_BACK_ARMHOLE_BIND_OFF_TIP_ID = "set-in-back-armhole-bind-off-trick";

export const SET_IN_NECKLINE_ORIENTATION_TIP_ID = "sleeveless-neckline-orientation";

function escapeAttr(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function glossary(id: number, label: string): string {
  return buildGlossaryTooltipPlaceholderHtml(id, label, escapeAttr, escapeAttr);
}

function necklineVideoButton(videoKey: string, label: string): string {
  return (
    `<button type="button" class="pattern-help-link__button" data-sleeveless-help-video="${escapeAttr(videoKey)}" aria-haspopup="dialog">` +
    `<i class="fa-solid fa-play"></i> ${escapeAttr(label)}</button>`
  );
}

/**
 * Neckline chart help for set-in sleeves.
 * Back omits catalog 813 because Pattern Tip 2213 already covers that shallow-neck lesson.
 * Round-neck fronts keep both videos. V-neck fronts do not use this card.
 */
export function setInNecklineChartMachineHelpCardHtml(options?: {
  includeShallowBackNeckVideo?: boolean;
}): string {
  const includeShallow = options?.includeShallowBackNeckVideo !== false;
  const buttons = [
    necklineVideoButton("roundNeckShaping", "Round neck shaping"),
    ...(includeShallow ? [necklineVideoButton("shallowBackNeck", "Short row shoulder shaping")] : []),
  ].join("\n  ");
  const shortRows = glossary(SET_IN_NECKLINE_SHORT_ROW_GLOSSARY_ID, "Short Rows");
  const stairSteps = glossary(SET_IN_NECKLINE_STAIR_STEPS_GLOSSARY_ID, "stair steps");
  const body =
    `<p>Many knitters prefer to use ${shortRows} to shape shoulders because they create a smoother edge and help prevent ${stairSteps} caused by bind-offs.</p>` +
    `<p class="sleeveless-neckline-tip__short-rows-prompt">New to ${shortRows}?</p>` +
    `<div class="pattern-finishing-video-help__links sleeveless-neckline-tip__video-links">\n  ${buttons}\n</div>`;
  return patternTipWrapperHtml({
    tipHtml: buildPatternHelpCardInnerHtml({
      title: "New to shaping necklines on the machine?",
      bodyHtml: body,
      icon: false,
    }),
    tipHtmlIsFull: true,
    tipPresentation: "help-card",
    tipId: "sleeveless-neckline-machine-help",
    tipWrapperClass: "no-print",
  });
}

export function setInBackNecklineMachineHelpCardHtml(): string {
  return setInNecklineChartMachineHelpCardHtml({ includeShallowBackNeckVideo: false });
}

/** Empty for V-neck fronts so the round-neck chart card is not shown. */
export function setInFrontNecklineMachineHelpCardHtml(isVNeck: boolean): string {
  if (isVNeck) return "";
  return setInNecklineChartMachineHelpCardHtml({ includeShallowBackNeckVideo: true });
}

/** Screen-only catalog link for setting a separate sleeve into the armhole. */
export function setInSleevePerfectionVideoHelpHtml(): string {
  return (
    `<p class="pattern-finishing-video-help pattern-help-link no-print">` +
    `<span class="pattern-finishing-video-help__lead"><i class="fa-solid fa-play"></i> Helpful video for setting in sleeves:</span> ` +
    `<span class="pattern-finishing-video-help__links">` +
    `<a class="pattern-help-link__anchor" href="${SET_IN_SLEEVE_PERFECTION_VIDEO_HREF}" target="_blank" rel="noopener noreferrer" data-content-id="${SET_IN_SLEEVE_PERFECTION_CONTENT_ID}">` +
    `<i class="fa-solid fa-play"></i> ${escapeAttr(SET_IN_SLEEVE_PERFECTION_VIDEO_LABEL)}</a>` +
    `</span></p>`
  );
}

type TipBlock = Extract<SleevelessPatternDisplayRow, { kind: "block" }>;

/** Pattern Tip for catalog video 5002. Attach to the first back armhole bind-off only. */
export function setInBackArmholeBindOffTrickTip(): Pick<
  TipBlock,
  "tipHtml" | "tipHtmlIsFull" | "tipPresentation" | "tipId"
> {
  const body =
    "<p>Binding off just a few stitches at the armhole edge? This optional transfer trick can create a smoother-looking shaping line.</p>" +
    `<p class="pattern-finishing-video-help pattern-help-link no-print">` +
    `<span class="pattern-help-link"><button type="button" class="pattern-help-link__button" data-sleeveless-help-video="${ARMHOLE_BIND_OFF_TRICK_VIDEO_KEY}" data-content-id="${ARMHOLE_BIND_OFF_TRICK_CONTENT_ID}" aria-haspopup="dialog">` +
    `<i class="fa-solid fa-play" aria-hidden="true"></i> Bind Off Trick</button></span>` +
    `</p>`;
  return {
    tipHtml: buildPatternQuickTipInnerHtml({
      summaryLabel: "Bind Off Trick",
      bodyHtml: body,
    }),
    tipHtmlIsFull: true,
    tipPresentation: "quick-tip",
    tipId: SET_IN_BACK_ARMHOLE_BIND_OFF_TIP_ID,
  };
}

/** Existing orientation card, reused as a display row. */
export function setInNecklineOrientationTipBlock(): TipBlock {
  return {
    kind: "block",
    paragraphs: [],
    tipHtml: necklineShoulderOrientationHelpCardInnerHtml(),
    tipHtmlIsFull: true,
    tipPresentation: "help-card",
    tipId: SET_IN_NECKLINE_ORIENTATION_TIP_ID,
  };
}
