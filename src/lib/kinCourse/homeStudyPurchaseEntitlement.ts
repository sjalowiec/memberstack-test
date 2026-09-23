/**
 * Whether one imported Home Study library row is a permanent course purchase.
 *
 * Subscriber-free rows never qualify, even when a credit id is present.
 * A positive credit id without classified payment evidence does not qualify.
 * DAK / LearnDesignKnit plans are not read here.
 */
import {
  classifyHomeStudyCreditEvidence,
  isVerifiedHomeStudyCreditClassification,
  type HomeStudyCreditEvidenceInput,
} from "./homeStudyCreditEvidence";

export type HomeStudyLibraryPurchaseRow = {
  subscriberfree: number | null;
  credit_id_fk: number | null;
  homestudy_courseid_fk: number;
};

export function isSubscriberFreeHomeStudyRow(
  row: Pick<HomeStudyLibraryPurchaseRow, "subscriberfree">,
): boolean {
  return row.subscriberfree === 1;
}

export function isHomeStudyPurchaseCandidate(
  row: Pick<HomeStudyLibraryPurchaseRow, "subscriberfree" | "credit_id_fk">,
): boolean {
  if (row.subscriberfree !== 0) return false;
  return typeof row.credit_id_fk === "number" && Number.isInteger(row.credit_id_fk) && row.credit_id_fk > 0;
}

/**
 * Permanent access for this library row. Subscriber-free is refused before
 * evidence is considered, so a benefit enrollment cannot be upgraded by a
 * credit row on the same record.
 */
export function isVerifiedHomeStudyLibraryPurchase(
  row: HomeStudyLibraryPurchaseRow,
  evidence: HomeStudyCreditEvidenceInput | null | undefined,
): boolean {
  if (isSubscriberFreeHomeStudyRow(row)) return false;
  if (!isHomeStudyPurchaseCandidate(row)) return false;
  return isVerifiedHomeStudyCreditClassification(classifyHomeStudyCreditEvidence(evidence));
}

export function verifiedHomeStudyCourseIdsFromRows(
  rows: Array<{
    library: HomeStudyLibraryPurchaseRow;
    evidence: HomeStudyCreditEvidenceInput | null;
  }>,
): number[] {
  const ids = new Set<number>();
  for (const row of rows) {
    if (!isVerifiedHomeStudyLibraryPurchase(row.library, row.evidence)) continue;
    if (!Number.isInteger(row.library.homestudy_courseid_fk) || row.library.homestudy_courseid_fk <= 0) {
      continue;
    }
    ids.add(row.library.homestudy_courseid_fk);
  }
  return [...ids].sort((a, b) => a - b);
}
