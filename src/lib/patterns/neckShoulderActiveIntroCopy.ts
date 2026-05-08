/**
 * Shared plain-text wording for neckline / shoulder chart intros (online + print).
 * Kept separate from {@link neckShoulderShapingChartHtml} to avoid importing that module from
 * {@link sleevelessPatternOutput} (cycle: chart HTML already imports pattern output for bind-off formatting).
 */

export const ACTIVE_SHOULDER_CHART_INTRO_SENTENCE =
  "Work one shoulder at a time. Follow the chart row by row for the active shoulder, then repeat for the second shoulder, reversing the edge landmarks.";

export const ACTIVE_SHOULDER_DIVIDE_SENTENCE =
  "Place the group of stitches opposite the carriage in hold position.";

/**
 * Armhole-local RC label (e.g. `RC:078`) plus center bind-off count from chart row 0.
 */
export function formatActiveShoulderCenterNecklinePlainSentence(args: {
  localStartRcLabel?: string | undefined;
  centerBindOffStitches?: number | undefined;
}): string {
  const localStartLabel = String(args.localStartRcLabel ?? "").trim();
  const centerCount = Number(args.centerBindOffStitches);
  const centerCountLabel =
    Number.isFinite(centerCount) && centerCount > 0 ? String(Math.round(centerCount)) : "";
  const bindOffTail = centerCountLabel
    ? `bind off the center ${centerCountLabel} neckline stitches`
    : "bind off the center neckline stitches";
  return localStartLabel
    ? `At local ${localStartLabel}, ${bindOffTail}.`
    : `${bindOffTail.charAt(0).toUpperCase()}${bindOffTail.slice(1)}.`;
}

/** Plain paragraphs placed above the checklist / chart (same order as HTML intro). */
export function activeShoulderIntroPlainParagraphs(args: {
  localStartRcLabel?: string | undefined;
  centerBindOffStitches?: number | undefined;
}): readonly string[] {
  return [
    formatActiveShoulderCenterNecklinePlainSentence(args),
    ACTIVE_SHOULDER_DIVIDE_SENTENCE,
    ACTIVE_SHOULDER_CHART_INTRO_SENTENCE,
  ];
}
