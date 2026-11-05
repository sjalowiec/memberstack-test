import { readFileSync } from "node:fs";
import { parseReviewsCsv, type ParsedLegacyReview } from "./parseReviewsCsv";
import { legacyImportUpsertSql } from "./testimonialRules";

export type LegacyImportSummary = {
  rows: number;
  uniqueRatingIds: number;
  duplicateRatingIds: number[];
  showPublished: number;
  showUnpublished: number;
  withMemberId: number;
  missingMemberId: number;
  duplicateQuoteGroups: number;
  inactiveOnInsert: true;
};

export function summarizeLegacyReviews(rows: ParsedLegacyReview[]): LegacyImportSummary {
  const ids = new Map<number, number>();
  let showPublished = 0;
  let showUnpublished = 0;
  let withMemberId = 0;
  const quotes = new Map<string, number>();
  for (const row of rows) {
    ids.set(row.legacyRatingId, (ids.get(row.legacyRatingId) ?? 0) + 1);
    if (row.legacyShow === true) showPublished += 1;
    else showUnpublished += 1;
    if (row.legacyMemberId) withMemberId += 1;
    quotes.set(row.quote, (quotes.get(row.quote) ?? 0) + 1);
  }
  return {
    rows: rows.length,
    uniqueRatingIds: ids.size,
    duplicateRatingIds: [...ids.entries()].filter(([, count]) => count > 1).map(([id]) => id),
    showPublished,
    showUnpublished,
    withMemberId,
    missingMemberId: rows.length - withMemberId,
    duplicateQuoteGroups: [...quotes.values()].filter((count) => count > 1).length,
    inactiveOnInsert: true,
  };
}

export function readLegacyReviewExport(csvPath: string): ParsedLegacyReview[] {
  return parseReviewsCsv(readFileSync(csvPath, "utf8"));
}

export function legacyImportStatement(): string {
  return legacyImportUpsertSql();
}
