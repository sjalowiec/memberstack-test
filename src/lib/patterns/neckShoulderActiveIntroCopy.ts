/**
 * Shared plain-text wording for neckline / shoulder chart intros (online + print).
 * Kept separate from {@link neckShoulderShapingChartHtml} to avoid importing that module from
 * {@link sleevelessPatternOutput} (cycle: chart HTML already imports pattern output for bind-off formatting).
 */

/** Glossary id for “Scrap off” (lifeline / remove-from-bed technique). */
export const SCRAP_OFF_GLOSSARY_ID = 311;

export const ACTIVE_SHOULDER_CHART_INTRO_SENTENCE =
  "Follow the chart row by row for the active shoulder, then repeat for the second shoulder, reversing the edge landmarks.";

export const ACTIVE_SHOULDER_DIVIDE_SENTENCE =
  "Place the opposite shoulder into hold position and work one shoulder at a time.";

/** True when the chart intro should include center-neckline divide/setup copy (round neck, etc.). */
export function activeShoulderCenterDivideIntroApplies(centerBindOffStitches?: number): boolean {
  const n = Number(centerBindOffStitches);
  return Number.isFinite(n) && n > 0;
}

/**
 * Center bind-off milestone uses Armhole RC (post armhole reset). Pass `RC:078`-style labels from
 * {@link sleevelessPatternOutput} debug locals.
 */
export function formatActiveShoulderCenterNecklinePlainSentence(args: {
  localStartRcLabel?: string | undefined;
  centerBindOffStitches?: number | undefined;
}): string {
  const localStartLabel = String(args.localStartRcLabel ?? "").trim();
  const centerCount = Number(args.centerBindOffStitches);
  const centerCountLabel =
    Number.isFinite(centerCount) && centerCount > 0 ? String(Math.round(centerCount)) : "";
  const scrapOffTail = centerCountLabel
    ? `scrap off the center ${centerCountLabel} neckline stitches to divide the neckline`
    : "scrap off the center neckline stitches to divide the neckline";
  const rcColon = localStartLabel.match(/^RC:(\d{1,4})$/i);
  if (rcColon) {
    const n = String(Math.max(0, parseInt(rcColon[1], 10))).padStart(3, "0");
    return `When Armhole RC reaches ${n}, ${scrapOffTail}.`;
  }
  return localStartLabel
    ? `At ${localStartLabel}, ${scrapOffTail}.`
    : `${scrapOffTail.charAt(0).toUpperCase()}${scrapOffTail.slice(1)}.`;
}

/** Plain paragraphs placed above the checklist / chart (same order as HTML intro). */
export function activeShoulderIntroPlainParagraphs(args: {
  localStartRcLabel?: string | undefined;
  centerBindOffStitches?: number | undefined;
}): readonly string[] {
  const out: string[] = [];
  if (activeShoulderCenterDivideIntroApplies(args.centerBindOffStitches)) {
    out.push(formatActiveShoulderCenterNecklinePlainSentence(args));
    out.push(ACTIVE_SHOULDER_DIVIDE_SENTENCE);
  }
  out.push(ACTIVE_SHOULDER_CHART_INTRO_SENTENCE);
  return out;
}
