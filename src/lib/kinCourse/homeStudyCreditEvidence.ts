/**
 * Payment evidence for a Knit It Now Home Study library row.
 *
 * `legacy_course_member_library` does not store dollar amount, transaction
 * type, or payment ids. Those fields live in legacy `credt_history`, which is
 * not part of the Watson snapshot. A positive `credit_id_fk` is only a
 * candidate. It becomes a verified purchase only after this classification.
 *
 * NULL-dollar decision (701 records from the SQL Server audit): a row whose
 * TransactionType is "Home Study Courses", whose dollaramount is NULL, and
 * which has both AthorizeID and transactionguid is a verified purchase. The
 * amount was not stored; both payment identifiers were. This is not applied
 * to library rows by themselves.
 *
 * Not purchases: Subscriberfree = 1, missing credit rows (the 10 unmatched
 * credits), dollaramount = 0 (the one zero-dollar credit), a different
 * transaction type, or a NULL amount that lacks either payment id.
 */

export const HOME_STUDY_CREDIT_TRANSACTION_TYPE = "Home Study Courses";

export const NULL_DOLLAR_HOME_STUDY_PURCHASE_DECISION =
  "TransactionType 'Home Study Courses', NULL dollaramount, and both AthorizeID and transactionguid count as a verified Home Study purchase. No credit row, a zero amount, a different transaction type, or a NULL amount missing either payment id does not.";

export const HOME_STUDY_CREDIT_CLASSIFICATIONS = [
  "verified_positive_amount",
  "verified_null_amount_with_payment_ids",
  "excluded_zero_amount",
  "excluded_unmatched",
  "excluded_wrong_transaction_type",
  "excluded_null_amount_without_payment_ids",
  "excluded_invalid_amount",
] as const;

export type HomeStudyCreditClassification = (typeof HOME_STUDY_CREDIT_CLASSIFICATIONS)[number];

export type HomeStudyCreditEvidenceInput = {
  transactionType?: string | null;
  dollarAmount?: unknown;
  authorizeId?: string | null;
  transactionGuid?: string | null;
};

const VERIFIED_CLASSIFICATIONS = new Set<HomeStudyCreditClassification>([
  "verified_positive_amount",
  "verified_null_amount_with_payment_ids",
]);

export function isVerifiedHomeStudyCreditClassification(
  classification: HomeStudyCreditClassification,
): boolean {
  return VERIFIED_CLASSIFICATIONS.has(classification);
}

/** Empty and non-numeric values stay null. Zero stays zero. */
export function parseHomeStudyDollarAmount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : null;
}

function presentPaymentId(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Classify one credit-history row. `null` means the library credit id has no
 * matching credit row (unmatched). That is never a purchase.
 */
export function classifyHomeStudyCreditEvidence(
  evidence: HomeStudyCreditEvidenceInput | null | undefined,
): HomeStudyCreditClassification {
  if (!evidence) return "excluded_unmatched";

  const transactionType = String(evidence.transactionType ?? "").trim();
  if (transactionType !== HOME_STUDY_CREDIT_TRANSACTION_TYPE) {
    return "excluded_wrong_transaction_type";
  }

  const amount = parseHomeStudyDollarAmount(evidence.dollarAmount);
  if (evidence.dollarAmount != null && String(evidence.dollarAmount).trim() !== "" && amount == null) {
    return "excluded_invalid_amount";
  }
  if (amount != null && amount < 0) return "excluded_invalid_amount";
  if (amount === 0) return "excluded_zero_amount";
  if (amount != null && amount > 0) return "verified_positive_amount";

  if (presentPaymentId(evidence.authorizeId) && presentPaymentId(evidence.transactionGuid)) {
    return "verified_null_amount_with_payment_ids";
  }
  return "excluded_null_amount_without_payment_ids";
}
