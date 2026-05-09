/**
 * Shared plain-text wording for neckline / shoulder chart intros (online + print).
 * Kept separate from {@link neckShoulderShapingChartHtml} to avoid importing that module from
 * {@link sleevelessPatternOutput} (cycle: chart HTML already imports pattern output for bind-off formatting).
 */

export const ACTIVE_SHOULDER_CHART_INTRO_SENTENCE =
  "Work one shoulder at a time. Follow the chart row by row for the active shoulder, then repeat for the second shoulder, reversing the edge landmarks.";

export const ACTIVE_SHOULDER_DIVIDE_SENTENCE =
  "Place the group of stitches opposite the carriage in hold position.";

/** Announced once before the shoulder checklist; the table then uses RC:000, RC:001, … */
export const ACTIVE_SHOULDER_RESET_RC_SENTENCE =
  "Reset Shoulder RC to RC:000 for the shaping table below.";

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
  const bindOffTail = centerCountLabel
    ? `bind off the center ${centerCountLabel} neckline stitches`
    : "bind off the center neckline stitches";
  const rcColon = localStartLabel.match(/^RC:(\d{1,4})$/i);
  if (rcColon) {
    const n = String(Math.max(0, parseInt(rcColon[1], 10))).padStart(3, "0");
    return `When Armhole RC reaches ${n}, ${bindOffTail}.`;
  }
  return localStartLabel
    ? `At ${localStartLabel}, ${bindOffTail}.`
    : `${bindOffTail.charAt(0).toUpperCase()}${bindOffTail.slice(1)}.`;
}

/** Plain paragraphs placed above the checklist / chart (same order as HTML intro). */
export function activeShoulderIntroPlainParagraphs(args: {
  localStartRcLabel?: string | undefined;
  centerBindOffStitches?: number | undefined;
}): readonly string[] {
  return [
    formatActiveShoulderCenterNecklinePlainSentence(args),
    ACTIVE_SHOULDER_RESET_RC_SENTENCE,
    ACTIVE_SHOULDER_DIVIDE_SENTENCE,
    ACTIVE_SHOULDER_CHART_INTRO_SENTENCE,
  ];
}
