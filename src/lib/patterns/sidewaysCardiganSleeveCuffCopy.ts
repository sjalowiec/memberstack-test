/**
 * Sideways cardigan sleeve cuff copy.
 * The body has no side seams, so the sleeve is sewn in by hand.
 * Cuff methods are choices: one cast-on or finish, never a default plus a second method.
 */

import { buildGlossaryTooltipPlaceholderHtml } from "../glossary/glossaryTooltipPrint";
import { SCRAP_OFF_GLOSSARY_ID } from "./neckShoulderActiveIntroCopy";
import { sleevelessHelpVideoFromCatalog } from "./sleevelessCatalogHelpVideo";

export const SIDEWAYS_SLEEVE_HAND_SEW_LINE =
  "Sew the finished sleeve into the armhole by hand. This cardigan has no side seams.";

/** Glossary “Hung Hem”. */
export const SIDEWAYS_HUNG_HEM_GLOSSARY_ID = 284;

/** Glossary “Mock Rib”. */
export const SIDEWAYS_MOCK_RIB_GLOSSARY_ID = 291;

/** Learning Library “Reverse Hung Hem”. */
export const SIDEWAYS_REVERSE_HUNG_HEM_VIDEO_ID = 337;

export const SIDEWAYS_CUFF_UP_CHART_FINISH = "Bind off loosely";

/** Top-down chart end. Bind-off and scrap-off stay inside the cuff choices. */
export const SIDEWAYS_TOP_DOWN_CHART_FINISH = "Finish the cuff";

export const SIDEWAYS_CUFF_UP_BIND_OFF_LINE =
  "Bind off loosely at the upper-arm/top edge.";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function glossary(id: number, label: string, ariaLabel: string): string {
  return buildGlossaryTooltipPlaceholderHtml(id, label, escapeHtml, escapeHtml, {
    ariaLabel,
  });
}

function reverseHungHemVideoHtml(): string {
  const label = "reverse hung hem";
  const video = sleevelessHelpVideoFromCatalog(SIDEWAYS_REVERSE_HUNG_HEM_VIDEO_ID);
  if (!video) return escapeHtml(label);
  return (
    `<button type="button"` +
    ` class="kbm-kin-catalog-video glossary-tooltip-trigger print-visible"` +
    ` data-vimeo-id="${escapeHtml(video.id)}"` +
    ` data-video-title="${escapeHtml(video.title)}"` +
    ` data-content-id="${SIDEWAYS_REVERSE_HUNG_HEM_VIDEO_ID}"` +
    ` aria-label="Watch Reverse Hung Hem"` +
    `>` +
    `<span class="glossary-tooltip-label">${escapeHtml(label)}</span>` +
    `</button>`
  );
}

function cuffRowPhrase(cuffRows: number): string {
  return cuffRows === 1 ? "1 row" : `${cuffRows} rows`;
}

/** Rows to knit so a folded hem finishes at the calculated cuff depth. */
function foldedHemRowPhrase(cuffRows: number): string {
  return cuffRowPhrase(Math.max(0, cuffRows) * 2);
}

const HAND_KNIT_CUFF_DEPTH = "to the desired finished cuff depth";

export function sidewaysTopDownCuffChoiceLines(wristSts: number, cuffRows: number): string[] {
  const scrap = glossary(SCRAP_OFF_GLOSSARY_ID, "Scrap off", "Learn about scrap off");
  const mockRib = glossary(
    SIDEWAYS_MOCK_RIB_GLOSSARY_ID,
    "mock ribbing",
    "Learn about mock ribbing",
  );
  const rows = cuffRowPhrase(cuffRows);
  const foldedRows = foldedHemRowPhrase(cuffRows);
  return [
    `The finished cuff is ${wristSts} stitches and ${rows} deep. Choose one way to finish:`,
    `1. Transfer the live stitches to the ribber and knit ${rows} of ribbing in the needle arrangement of your choice, then bind off.`,
    `2. ${scrap} the stitches, then pick them up to hand knit ribbing ${HAND_KNIT_CUFF_DEPTH}.`,
    `3. Work a ${mockRib} hem for ${foldedRows} so the hem can be folded.`,
    `4. Work a ${reverseHungHemVideoHtml()} for ${foldedRows} so the hem can be folded.`,
    "5. Bind off and work a crochet edging.",
  ];
}

export function sidewaysCuffUpCuffChoiceLines(wristSts: number, cuffRows: number): string[] {
  const hungHem = glossary(SIDEWAYS_HUNG_HEM_GLOSSARY_ID, "hung hem", "Learn about hung hems");
  const mockRib = glossary(
    SIDEWAYS_MOCK_RIB_GLOSSARY_ID,
    "mock ribbing",
    "Learn about mock ribbing",
  );
  const rows = cuffRowPhrase(cuffRows);
  const foldedRows = foldedHemRowPhrase(cuffRows);
  return [
    `The finished cuff is ${wristSts} stitches and ${rows} deep. Choose one way to begin:`,
    `1. Cast on ${wristSts} stitches in the ribbing needle arrangement of your choice and knit ${rows} of ribbing, then transfer the stitches to the main bed to continue the sleeve.`,
    `2. Knit a ${hungHem} for ${foldedRows} so the hem can be folded.`,
    `3. Knit ${mockRib} for ${foldedRows} so the hem can be folded.`,
    `4. Hand knit ribbing ${HAND_KNIT_CUFF_DEPTH}, then hang its stitches on the machine to continue the sleeve.`,
  ];
}
