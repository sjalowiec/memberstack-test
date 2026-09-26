import { classifySavedPatternForErrata } from "./classifySavedPatternErrata";
import type { ErrataMatchedMeasurement, PatternErrataRecord } from "./types";

export type SavedPatternErrataNotice = {
  id: string;
  slug: string;
  title: string;
  builderLabel: string;
  audienceLabel: string;
  size: string;
  lengthInches: number | null;
  upperArmInches: number | null;
  matchedMeasurements: ErrataMatchedMeasurement[];
  knitterAction: string;
  href: string;
};

const BUILDER_LABELS: Record<string, string> = {
  "drop-shoulder": "Drop Shoulder",
  sleeveless: "Sleeveless",
};

const AUDIENCE_LABELS: Record<string, string> = {
  baby: "Baby",
  kids: "Kids",
};

/** Public pages and the member notice only receive published corrections. */
export function publishedPatternErrata(rows: readonly PatternErrataRecord[]): PatternErrataRecord[] {
  return rows.filter((row) => row.status === "published");
}

/**
 * Notices for one opened saved pattern.
 * Only a published correction and a confident old default produce a notice.
 * Customized and uncertain patterns stay quiet so the page does not claim they are affected.
 */
export function noticesForSavedPattern(
  errata: readonly PatternErrataRecord[],
  project: unknown,
  savedProjectId: string | null | undefined,
): SavedPatternErrataNotice[] {
  const id = typeof savedProjectId === "string" ? savedProjectId.trim() : "";
  if (!id) return [];

  const notices: SavedPatternErrataNotice[] = [];
  for (const row of publishedPatternErrata(errata)) {
    const match = classifySavedPatternForErrata(project, row);
    if (match.classification !== "old_default") continue;
    if (match.matchedMeasurements.length === 0 || !match.size || !match.builder) continue;
    notices.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      builderLabel: BUILDER_LABELS[match.builder] ?? match.builder,
      audienceLabel: match.audience ? (AUDIENCE_LABELS[match.audience] ?? match.audience) : "",
      size: match.size,
      lengthInches: match.lengthInches,
      upperArmInches: match.upperArmInches,
      matchedMeasurements: match.matchedMeasurements,
      knitterAction: row.knitterAction,
      href: `/patterns/errata#${row.slug}`,
    });
  }
  return notices;
}

/** Member-facing notice copy. The size table stays on the erratum page. */
export const SAVED_PATTERN_ERRATA_NOTICE_TEXT =
  "This saved pattern may contain an older measurement. Saved measurements do not update automatically.";

/** Member-facing notice copy. It does not repeat the size table or a specific measurement. */
export function savedPatternNoticeText(_notice: SavedPatternErrataNotice): string {
  return SAVED_PATTERN_ERRATA_NOTICE_TEXT;
}
