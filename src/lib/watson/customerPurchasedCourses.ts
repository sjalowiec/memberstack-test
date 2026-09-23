/**
 * Admin purchased-course list for a Watson customer profile.
 *
 * Families with purchase records in Watson are Home Study, LearnDAK, and
 * LK150. A Home Study library row and a Legacy History "Course Purchase" are
 * the same purchase when the history source record is that library id. They
 * are shown once. LearnDAK and LK150 are never matched to a Home Study row
 * by course id or source id. Subscriber-free enrollments are left out of the
 * list and the count. This does not grant access or change imported rows.
 *
 * Course 28 is not given a display title. HomeStudy_courses records
 * "Jennifer's Favorite Shrug" and the Challenges catalog records
 * "Fit Once ... Get Knitting!" for the same number. Those are different
 * course lists. The title stays in review.
 */
import { LEGACY_HOME_STUDY_COURSE_CATALOG } from "./legacyHomeStudyCourses";
import {
  formatCleanedLegacyDateDisplay,
  formatCleanedLegacyDateSort,
} from "./legacyHistoryStore";
import { LEARN_DESIGNAKNIT_COURSE_PURCHASE_CATEGORY } from "./legacyHistoryTypes";
import { formatLegacyMoney } from "./memberOrders";
import { queryWatson } from "./db";
import type { WatsonQueryFn } from "./memberSearch";
import {
  classifyHomeStudyCreditEvidence,
  type HomeStudyCreditEvidenceInput,
} from "../kinCourse/homeStudyCreditEvidence";
import { isVerifiedHomeStudyLibraryPurchase } from "../kinCourse/homeStudyPurchaseEntitlement";

export const HOME_STUDY_COURSE_PURCHASE_CATEGORY = "Course Purchase";
export const LK150_COURSE_BUNDLE_CATEGORY = "LK150 Bundle";

export const CUSTOMER_COURSE_FAMILIES = {
  home_study: "Home Study",
  designaknit: "LearnDAK",
  lk150: "LK150",
} as const;

export type CustomerCourseGroup = keyof typeof CUSTOMER_COURSE_FAMILIES;
export type CustomerCourseFamily = (typeof CUSTOMER_COURSE_FAMILIES)[CustomerCourseGroup];

/** Home Study course 28 and Challenges course 28 are not the same course. */
export const HOME_STUDY_COURSE_28_TITLE_CONFLICT = {
  courseId: 28,
  note: "Course ID 28 is recorded on two different course lists. Neither title is used as the purchase name until the source of this Home Study id is established.",
  recordedTitles: [
    { source: "HomeStudy_courses", title: "Jennifer's Favorite Shrug" },
    { source: "Challenges catalog", title: "Fit Once ... Get Knitting!" },
  ],
} as const;

export const CUSTOMER_HOME_STUDY_LIBRARY_SQL = `
  SELECT
    homestudy_libraryid,
    homestudy_courseid_fk,
    dateadded,
    credit_id_fk,
    subscriberfree
  FROM legacy_course_member_library
  WHERE memberid_fk = $1
  ORDER BY dateadded DESC NULLS LAST, homestudy_libraryid DESC
`;

export const CUSTOMER_COURSE_PURCHASE_HISTORY_SQL = `
  SELECT
    category,
    transaction_date,
    description,
    amount,
    source_record_id,
    item_id,
    transaction_id
  FROM watson_legacy_history
  WHERE legacy_memberid = $1
    AND category IN (
      '${HOME_STUDY_COURSE_PURCHASE_CATEGORY}',
      '${LEARN_DESIGNAKNIT_COURSE_PURCHASE_CATEGORY}',
      '${LK150_COURSE_BUNDLE_CATEGORY}'
    )
  ORDER BY transaction_date DESC NULLS LAST, description ASC
`;

export const CUSTOMER_HOME_STUDY_CREDIT_EVIDENCE_SQL = `
  SELECT
    credit_id,
    transaction_type,
    dollar_amount,
    authorize_id,
    transaction_guid
  FROM legacy_homestudy_credit_evidence
  WHERE credit_id = ANY($1::int[])
`;

const HOME_STUDY_PURCHASE_TITLE =
  /^Home Study Course Purchase:\s*(.+?)\s+Courses(?:\s+\(|$)/i;
const LK150_BUNDLE_TITLE = /^Course Bundle Purchase:\s*(.+?)\s+Courses(?:\s+\(|$)/i;

const catalogTitleById = new Map(
  LEGACY_HOME_STUDY_COURSE_CATALOG.map((course) => [course.courseId, course.title.trim()]),
);

export type RecordedCourseTitle = {
  source: string;
  title: string;
};

export type CustomerHomeStudyLibraryRow = {
  homestudy_libraryid: string | number;
  homestudy_courseid_fk: number;
  dateadded: Date | string | null;
  credit_id_fk: number | null;
  subscriberfree: number | null;
};

export type CustomerCoursePurchaseHistoryRow = {
  category: string;
  transaction_date: Date | string | null;
  description: string | null;
  amount: string | number | null;
  source_record_id?: string | null;
  item_id?: string | null;
  transaction_id?: string | null;
};

export type CustomerHomeStudyCreditEvidenceRow = {
  credit_id: number;
  transaction_type: string | null;
  dollar_amount: unknown;
  authorize_id: string | null;
  transaction_guid: string | null;
};

export type CustomerPurchasedCourseRow = {
  group: CustomerCourseGroup;
  family: CustomerCourseFamily;
  courseId: string | null;
  title: string | null;
  titleNeedsReview: boolean;
  titleReviewNote: string | null;
  recordedTitles: RecordedCourseTitle[];
  purchaseDate: string | null;
  purchaseDateSort: string;
  sourceLabel: string | null;
  amount: string | null;
};

export type CustomerCourseReviewRow = {
  family: CustomerCourseFamily;
  libraryRecordId: string;
  courseId: string;
  title: string | null;
  titleNeedsReview: boolean;
  titleReviewNote: string | null;
  recordedTitles: RecordedCourseTitle[];
  dateAdded: string | null;
  dateAddedSort: string;
  creditId: string | null;
  reason: string;
};

export type CustomerPurchasedCoursesView = {
  purchases: CustomerPurchasedCourseRow[];
  homeStudyPurchases: CustomerPurchasedCourseRow[];
  designaknitPurchases: CustomerPurchasedCourseRow[];
  lk150Purchases: CustomerPurchasedCourseRow[];
  needsReview: CustomerCourseReviewRow[];
  positiveCreditCandidateCount: number;
  subscriberFreeExcludedCount: number;
  purchaseCount: number;
  creditEvidenceAvailable: boolean;
};

export function emptyCustomerPurchasedCoursesView(): CustomerPurchasedCoursesView {
  return {
    purchases: [],
    homeStudyPurchases: [],
    designaknitPurchases: [],
    lk150Purchases: [],
    needsReview: [],
    positiveCreditCandidateCount: 0,
    subscriberFreeExcludedCount: 0,
    purchaseCount: 0,
    creditEvidenceAvailable: false,
  };
}

type TitleResolution = {
  title: string | null;
  titleNeedsReview: boolean;
  titleReviewNote: string | null;
  recordedTitles: RecordedCourseTitle[];
};

function cleanText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function sameTitle(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function recordedHomeStudyPurchaseTitle(
  description: string | null | undefined,
): string | null {
  return titledPurchase(description, HOME_STUDY_PURCHASE_TITLE);
}

export function recordedLk150BundleTitle(description: string | null | undefined): string | null {
  return titledPurchase(description, LK150_BUNDLE_TITLE);
}

function titledPurchase(description: string | null | undefined, pattern: RegExp): string | null {
  const text = cleanText(description);
  if (!text) return null;
  const match = pattern.exec(text);
  const title = match?.[1]?.trim() ?? "";
  if (!title || /^\d+$/.test(title)) return null;
  return title;
}

function catalogTitle(courseId: number | null): string | null {
  if (courseId == null || !Number.isInteger(courseId)) return null;
  return catalogTitleById.get(courseId) ?? null;
}

export function resolveHomeStudyCourseTitle(
  courseId: number | null,
  description: string | null | undefined,
): TitleResolution {
  if (courseId === HOME_STUDY_COURSE_28_TITLE_CONFLICT.courseId) {
    const recorded = recordedHomeStudyPurchaseTitle(description);
    const recordedTitles: RecordedCourseTitle[] = [
      ...HOME_STUDY_COURSE_28_TITLE_CONFLICT.recordedTitles,
    ];
    if (recorded && !recordedTitles.some((entry) => sameTitle(entry.title, recorded))) {
      recordedTitles.push({ source: "Legacy History purchase record", title: recorded });
    }
    return {
      title: null,
      titleNeedsReview: true,
      titleReviewNote: HOME_STUDY_COURSE_28_TITLE_CONFLICT.note,
      recordedTitles,
    };
  }

  const catalog = catalogTitle(courseId);
  const recorded = recordedHomeStudyPurchaseTitle(description);

  if (catalog && recorded && !sameTitle(catalog, recorded)) {
    return {
      title: null,
      titleNeedsReview: true,
      titleReviewNote:
        "The Home Study catalog title and the Legacy History purchase description do not match. Neither title is used as the purchase name.",
      recordedTitles: [
        { source: "HomeStudy_courses", title: catalog },
        { source: "Legacy History purchase record", title: recorded },
      ],
    };
  }

  const title = recorded ?? catalog;
  if (title) {
    return {
      title,
      titleNeedsReview: false,
      titleReviewNote: null,
      recordedTitles: [],
    };
  }

  const recordedDescription = cleanText(description);
  return {
    title: null,
    titleNeedsReview: true,
    titleReviewNote: "The Home Study purchase record does not name a course.",
    recordedTitles: recordedDescription
      ? [{ source: "Legacy History purchase record", title: recordedDescription }]
      : [],
  };
}

function positiveCreditId(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return null;
  return value;
}

function isSubscriberFree(row: Pick<CustomerHomeStudyLibraryRow, "subscriberfree">): boolean {
  return row.subscriberfree === 1;
}

function evidenceFromRow(
  row: CustomerHomeStudyCreditEvidenceRow | undefined,
): HomeStudyCreditEvidenceInput | null {
  if (!row) return null;
  return {
    transactionType: row.transaction_type,
    dollarAmount: row.dollar_amount,
    authorizeId: row.authorize_id,
    transactionGuid: row.transaction_guid,
  };
}

function reviewReason(input: {
  creditId: number | null;
  creditEvidenceAvailable: boolean;
  evidence: HomeStudyCreditEvidenceInput | null;
  identifierConflict: boolean;
}): string {
  if (input.identifierConflict) {
    return "Legacy History identifiers do not match this library row.";
  }
  if (!input.creditId) {
    return "No positive credit id and no matching Legacy History course purchase.";
  }
  if (!input.creditEvidenceAvailable) {
    return "No matching Legacy History course purchase, and credit-history payment evidence is not loaded.";
  }
  if (!input.evidence) {
    return "No credit-history row matches this credit id.";
  }
  const classification = classifyHomeStudyCreditEvidence(input.evidence);
  if (classification === "excluded_zero_amount") {
    return "The credit-history amount is zero.";
  }
  if (classification === "excluded_wrong_transaction_type") {
    return "The credit-history transaction type is not a Home Study course purchase.";
  }
  if (classification === "excluded_null_amount_without_payment_ids") {
    return "The credit-history amount is blank and a payment id is missing.";
  }
  return "Credit-history evidence does not verify payment.";
}

function sourceLabel(
  kind: "credit" | "transaction",
  id: string | null,
): string | null {
  if (!id) return null;
  return kind === "credit" ? `Credit ${id}` : `Transaction ${id}`;
}

function comparePurchaseDateDesc(
  left: { purchaseDateSort: string; courseId: string | null },
  right: { purchaseDateSort: string; courseId: string | null },
): number {
  const byDate = right.purchaseDateSort.localeCompare(left.purchaseDateSort);
  if (byDate !== 0) return byDate;
  return (left.courseId ?? "").localeCompare(right.courseId ?? "");
}

type HistoryMatch = "match" | "conflict" | "no";

function historyMatchForLibrary(
  history: CustomerCoursePurchaseHistoryRow,
  library: CustomerHomeStudyLibraryRow,
): HistoryMatch {
  if (history.category !== HOME_STUDY_COURSE_PURCHASE_CATEGORY) return "no";
  const libraryId = String(library.homestudy_libraryid);
  const courseId = String(library.homestudy_courseid_fk);
  const creditId = positiveCreditId(library.credit_id_fk);
  const source = cleanText(history.source_record_id);
  const item = cleanText(history.item_id);
  const transaction = cleanText(history.transaction_id);
  const sourceMatches = source !== "" && source === libraryId;
  const itemAgrees = item === "" || item === courseId;
  const transactionAgrees =
    transaction === "" || creditId == null || transaction === String(creditId);

  if (sourceMatches) {
    return itemAgrees && transactionAgrees ? "match" : "conflict";
  }
  if (creditId != null && transaction === String(creditId) && item === courseId) {
    return "match";
  }
  return "no";
}

function purchaseFromHistory(
  history: CustomerCoursePurchaseHistoryRow,
  group: CustomerCourseGroup,
  courseId: number | null,
  creditId: string | null,
): CustomerPurchasedCourseRow {
  const transactionId = cleanText(history.transaction_id) || null;
  const title =
    group === "home_study"
      ? resolveHomeStudyCourseTitle(courseId, history.description)
      : group === "lk150"
        ? resolveLk150BundleTitle(history.description)
        : {
            title: cleanText(history.description) || null,
            titleNeedsReview: !cleanText(history.description),
            titleReviewNote: cleanText(history.description)
              ? null
              : "The LearnDAK purchase record does not name a course.",
            recordedTitles: [],
          };
  const sourceKind = creditId ? "credit" : "transaction";
  const sourceId = creditId ?? transactionId;
  return {
    group,
    family: CUSTOMER_COURSE_FAMILIES[group],
    courseId: courseId == null ? cleanText(history.item_id) || null : String(courseId),
    title: title.title,
    titleNeedsReview: title.titleNeedsReview,
    titleReviewNote: title.titleReviewNote,
    recordedTitles: title.recordedTitles,
    purchaseDate: formatCleanedLegacyDateDisplay(history.transaction_date),
    purchaseDateSort: formatCleanedLegacyDateSort(history.transaction_date),
    sourceLabel: sourceLabel(sourceKind, sourceId),
    amount: formatLegacyMoney(history.amount),
  };
}

function resolveLk150BundleTitle(description: string | null | undefined): TitleResolution {
  const title = recordedLk150BundleTitle(description);
  if (title) {
    return {
      title,
      titleNeedsReview: false,
      titleReviewNote: null,
      recordedTitles: [],
    };
  }
  const recorded = cleanText(description);
  return {
    title: null,
    titleNeedsReview: true,
    titleReviewNote: "The LK150 purchase record does not name a course.",
    recordedTitles: recorded ? [{ source: "Legacy History LK150 bundle", title: recorded }] : [],
  };
}

export function buildCustomerPurchasedCourses(input: {
  library: CustomerHomeStudyLibraryRow[];
  history: CustomerCoursePurchaseHistoryRow[];
  evidence?: CustomerHomeStudyCreditEvidenceRow[];
  creditEvidenceAvailable: boolean;
}): CustomerPurchasedCoursesView {
  const evidenceByCredit = new Map<number, CustomerHomeStudyCreditEvidenceRow>();
  for (const row of input.evidence ?? []) {
    if (Number.isInteger(row.credit_id)) {
      evidenceByCredit.set(row.credit_id, row);
    }
  }

  const homeStudyHistory = input.history.filter(
    (row) => row.category === HOME_STUDY_COURSE_PURCHASE_CATEGORY,
  );
  const usedHistory = new Set<number>();
  const homeStudyPurchases: CustomerPurchasedCourseRow[] = [];
  const needsReview: CustomerCourseReviewRow[] = [];
  let positiveCreditCandidateCount = 0;
  let subscriberFreeExcludedCount = 0;

  for (const library of input.library) {
    if (isSubscriberFree(library)) {
      subscriberFreeExcludedCount += 1;
      for (const [index, history] of homeStudyHistory.entries()) {
        const match = historyMatchForLibrary(history, library);
        if (match === "match" || match === "conflict") usedHistory.add(index);
      }
      continue;
    }

    const creditId = positiveCreditId(library.credit_id_fk);
    if (creditId) positiveCreditCandidateCount += 1;
    const evidence = creditId ? evidenceFromRow(evidenceByCredit.get(creditId)) : null;
    const courseId = library.homestudy_courseid_fk;
    const title = resolveHomeStudyCourseTitle(courseId, null);

    let matched: number | null = null;
    let conflict = false;
    for (const [index, history] of homeStudyHistory.entries()) {
      const match = historyMatchForLibrary(history, library);
      if (match === "match" && matched == null) matched = index;
      if (match === "conflict") conflict = true;
    }

    if (matched != null) {
      usedHistory.add(matched);
      for (const [index, history] of homeStudyHistory.entries()) {
        if (historyMatchForLibrary(history, library) === "conflict") usedHistory.add(index);
      }
      homeStudyPurchases.push(
        purchaseFromHistory(
          homeStudyHistory[matched]!,
          "home_study",
          courseId,
          creditId ? String(creditId) : null,
        ),
      );
      continue;
    }

    const verified =
      input.creditEvidenceAvailable &&
      creditId != null &&
      isVerifiedHomeStudyLibraryPurchase(
        {
          subscriberfree: library.subscriberfree,
          credit_id_fk: library.credit_id_fk,
          homestudy_courseid_fk: courseId,
        },
        evidence,
      );

    if (verified && creditId != null) {
      const evidenceRow = evidenceByCredit.get(creditId);
      homeStudyPurchases.push({
        group: "home_study",
        family: CUSTOMER_COURSE_FAMILIES.home_study,
        courseId: String(courseId),
        title: title.title,
        titleNeedsReview: title.titleNeedsReview,
        titleReviewNote: title.titleReviewNote,
        recordedTitles: title.recordedTitles,
        purchaseDate: formatCleanedLegacyDateDisplay(library.dateadded),
        purchaseDateSort: formatCleanedLegacyDateSort(library.dateadded),
        sourceLabel: sourceLabel("credit", String(creditId)),
        amount: formatLegacyMoney(
          typeof evidenceRow?.dollar_amount === "string" ||
            typeof evidenceRow?.dollar_amount === "number"
            ? evidenceRow.dollar_amount
            : null,
        ),
      });
      continue;
    }

    for (const [index, history] of homeStudyHistory.entries()) {
      if (historyMatchForLibrary(history, library) === "conflict") usedHistory.add(index);
    }

    needsReview.push({
      family: CUSTOMER_COURSE_FAMILIES.home_study,
      libraryRecordId: String(library.homestudy_libraryid),
      courseId: String(courseId),
      title: title.title,
      titleNeedsReview: title.titleNeedsReview,
      titleReviewNote: title.titleReviewNote,
      recordedTitles: title.recordedTitles,
      dateAdded: formatCleanedLegacyDateDisplay(library.dateadded),
      dateAddedSort: formatCleanedLegacyDateSort(library.dateadded),
      creditId: creditId ? String(creditId) : null,
      reason: reviewReason({
        creditId,
        creditEvidenceAvailable: input.creditEvidenceAvailable,
        evidence,
        identifierConflict: conflict,
      }),
    });
  }

  for (const [index, history] of homeStudyHistory.entries()) {
    if (usedHistory.has(index)) continue;
    const item = cleanText(history.item_id);
    const courseId = /^\d+$/.test(item) ? Number(item) : null;
    const transaction = cleanText(history.transaction_id) || null;
    homeStudyPurchases.push(
      purchaseFromHistory(history, "home_study", courseId, transaction),
    );
  }

  const designaknitPurchases = input.history
    .filter((row) => row.category === LEARN_DESIGNAKNIT_COURSE_PURCHASE_CATEGORY)
    .map((row) => purchaseFromHistory(row, "designaknit", null, null));
  const lk150Purchases = input.history
    .filter((row) => row.category === LK150_COURSE_BUNDLE_CATEGORY)
    .map((row) => purchaseFromHistory(row, "lk150", null, null));

  homeStudyPurchases.sort(comparePurchaseDateDesc);
  designaknitPurchases.sort(comparePurchaseDateDesc);
  lk150Purchases.sort(comparePurchaseDateDesc);
  const purchases = [...homeStudyPurchases, ...designaknitPurchases, ...lk150Purchases];
  purchases.sort(comparePurchaseDateDesc);
  needsReview.sort((left, right) => right.dateAddedSort.localeCompare(left.dateAddedSort));

  return {
    purchases,
    homeStudyPurchases,
    designaknitPurchases,
    lk150Purchases,
    needsReview,
    positiveCreditCandidateCount,
    subscriberFreeExcludedCount,
    purchaseCount: purchases.length,
    creditEvidenceAvailable: input.creditEvidenceAvailable,
  };
}

function isMissingCreditEvidenceTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("42P01") || message.includes("legacy_homestudy_credit_evidence");
}

export async function loadCustomerPurchasedCourses(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<CustomerPurchasedCoursesView> {
  const normalized = memberid.trim();
  if (!normalized) return emptyCustomerPurchasedCoursesView();

  const [library, history] = await Promise.all([
    queryFn<CustomerHomeStudyLibraryRow>(CUSTOMER_HOME_STUDY_LIBRARY_SQL, [normalized]),
    queryFn<CustomerCoursePurchaseHistoryRow>(CUSTOMER_COURSE_PURCHASE_HISTORY_SQL, [normalized]),
  ]);

  const creditIds = [
    ...new Set(
      library
        .map((row) => positiveCreditId(row.credit_id_fk))
        .filter((id): id is number => id != null),
    ),
  ];

  let creditEvidenceAvailable = true;
  let evidence: CustomerHomeStudyCreditEvidenceRow[] = [];
  try {
    evidence = await queryFn<CustomerHomeStudyCreditEvidenceRow>(
      CUSTOMER_HOME_STUDY_CREDIT_EVIDENCE_SQL,
      [creditIds],
    );
  } catch (error) {
    if (!isMissingCreditEvidenceTable(error)) throw error;
    creditEvidenceAvailable = false;
    evidence = [];
  }

  return buildCustomerPurchasedCourses({
    library,
    history,
    evidence,
    creditEvidenceAvailable,
  });
}
