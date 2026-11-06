import { classifySavedPatternForErrata } from "./classifySavedPatternErrata";
import {
  SWEATER_FINISHED_MEASUREMENTS_ERRATA_SLUG,
  SWEATER_FINISHED_MEASUREMENTS_KNITTER_ACTION,
  sweaterFinishedMeasurementErrataRecord,
} from "./sweaterFinishedMeasurementErrata";
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
 * Published corrections a knitter can see.
 * The saved-measurement correction is included with this calculation fix.
 * A database row with the same slug replaces the built-in copy.
 */
export function publishedErrataForMembers(rows: readonly PatternErrataRecord[]): PatternErrataRecord[] {
  const published = publishedPatternErrata(rows);
  const builtin = sweaterFinishedMeasurementErrataRecord();
  if (published.some((row) => row.slug === builtin.slug)) return published;
  return [...published, builtin];
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

/** Member-facing notice copy. Length corrections stay on the shared sentence. This correction names the measurements. */
export function savedPatternNoticeText(notice: SavedPatternErrataNotice): string {
  if (notice.slug === SWEATER_FINISHED_MEASUREMENTS_ERRATA_SLUG) {
    return SWEATER_FINISHED_MEASUREMENTS_KNITTER_ACTION;
  }
  return SAVED_PATTERN_ERRATA_NOTICE_TEXT;
}
