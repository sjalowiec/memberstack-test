import { describe, expect, it } from "vitest";

import { LEARN_DESIGNAKNIT_COURSE_PURCHASE_CATEGORY } from "./legacyHistoryTypes";
import {
  buildCustomerPurchasedCourses,
  HOME_STUDY_COURSE_28_TITLE_CONFLICT,
  type CustomerCoursePurchaseHistoryRow,
  type CustomerHomeStudyLibraryRow,
} from "./customerPurchasedCourses";

/**
 * DEV customer 20D59407-DEC7-E8C3-EE0D-D50B542F3FD0.
 * Seven library rows: four positive-credit Home Study candidates and three
 * subscriber-free enrollments. Two of the candidates also appear in Legacy History.
 */
const partialHistoryLibrary: CustomerHomeStudyLibraryRow[] = [
  {
    homestudy_libraryid: "6145",
    homestudy_courseid_fk: 6,
    dateadded: "2016-10-22T07:00:00.000Z",
    credit_id_fk: 92440,
    subscriberfree: 0,
  },
  {
    homestudy_libraryid: "5837",
    homestudy_courseid_fk: 54,
    dateadded: "2016-09-29T07:00:00.000Z",
    credit_id_fk: 0,
    subscriberfree: 1,
  },
  {
    homestudy_libraryid: "2585",
    homestudy_courseid_fk: 32,
    dateadded: "2015-08-05T07:00:00.000Z",
    credit_id_fk: 0,
    subscriberfree: 1,
  },
  {
    homestudy_libraryid: "2423",
    homestudy_courseid_fk: 28,
    dateadded: "2015-05-14T07:00:00.000Z",
    credit_id_fk: 61191,
    subscriberfree: 0,
  },
  {
    homestudy_libraryid: "1153",
    homestudy_courseid_fk: 3,
    dateadded: "2014-02-25T08:00:00.000Z",
    credit_id_fk: 37980,
    subscriberfree: 0,
  },
  {
    homestudy_libraryid: "658",
    homestudy_courseid_fk: 7,
    dateadded: "2013-04-01T07:00:00.000Z",
    credit_id_fk: 23982,
    subscriberfree: 0,
  },
  {
    homestudy_libraryid: "226",
    homestudy_courseid_fk: 1,
    dateadded: "2012-10-09T07:00:00.000Z",
    credit_id_fk: 0,
    subscriberfree: 1,
  },
];

const partialHistoryPurchases: CustomerCoursePurchaseHistoryRow[] = [
  {
    category: "Course Purchase",
    transaction_date: "2016-10-22T07:00:00.000Z",
    description: "Home Study Course Purchase: Need a Plus Size Cardigan? Courses ($12.48)",
    amount: "12.4750",
    source_record_id: "6145",
    item_id: "6",
    transaction_id: "92440",
  },
  {
    category: "Course Purchase",
    transaction_date: "2015-05-14T07:00:00.000Z",
    description: "Home Study Course Purchase: Jennifer's Favorite Shrug Courses ($24.95)",
    amount: "24.9500",
    source_record_id: "2423",
    item_id: "28",
    transaction_id: "61191",
  },
];

const allMatchedLibrary: CustomerHomeStudyLibraryRow[] = [
  {
    homestudy_libraryid: "8774",
    homestudy_courseid_fk: 26,
    dateadded: "2019-06-12T07:00:00.000Z",
    credit_id_fk: 155788,
    subscriberfree: 0,
  },
  {
    homestudy_libraryid: "7017",
    homestudy_courseid_fk: 49,
    dateadded: "2017-10-13T07:00:00.000Z",
    credit_id_fk: 0,
    subscriberfree: 1,
  },
  {
    homestudy_libraryid: "6993",
    homestudy_courseid_fk: 7,
    dateadded: "2017-09-23T07:00:00.000Z",
    credit_id_fk: 113631,
    subscriberfree: 0,
  },
  {
    homestudy_libraryid: "5604",
    homestudy_courseid_fk: 1,
    dateadded: "2016-08-24T07:00:00.000Z",
    credit_id_fk: 0,
    subscriberfree: 1,
  },
  {
    homestudy_libraryid: "5603",
    homestudy_courseid_fk: 32,
    dateadded: "2016-08-24T07:00:00.000Z",
    credit_id_fk: 0,
    subscriberfree: 1,
  },
  {
    homestudy_libraryid: "2428",
    homestudy_courseid_fk: 28,
    dateadded: "2015-05-15T07:00:00.000Z",
    credit_id_fk: 61208,
    subscriberfree: 0,
  },
  {
    homestudy_libraryid: "1065",
    homestudy_courseid_fk: 8,
    dateadded: "2014-01-01T08:00:00.000Z",
    credit_id_fk: 35378,
    subscriberfree: 0,
  },
];

const allMatchedHistory: CustomerCoursePurchaseHistoryRow[] = [
  {
    category: "Course Purchase",
    transaction_date: "2019-06-12T07:00:00.000Z",
    description: "Home Study Course Purchase: Ribber Basic Bootcamp Courses ($24.98)",
    amount: "24.9750",
    source_record_id: "8774",
    item_id: "26",
    transaction_id: "155788",
  },
  {
    category: "Course Purchase",
    transaction_date: "2017-09-23T07:00:00.000Z",
    description: "Home Study Course Purchase: Top Down Raglan Sweaters Courses ($12.74)",
    amount: "12.7415",
    source_record_id: "6993",
    item_id: "7",
    transaction_id: "113631",
  },
  {
    category: "Course Purchase",
    transaction_date: "2015-05-15T07:00:00.000Z",
    description: "Home Study Course Purchase: Jennifer's Favorite Shrug Courses ($24.95)",
    amount: "24.9500",
    source_record_id: "2428",
    item_id: "28",
    transaction_id: "61208",
  },
  {
    category: "Course Purchase",
    transaction_date: "2014-01-01T08:00:00.000Z",
    description: "Home Study Course Purchase: Beginner Bootcamp  Courses ($39.96)",
    amount: "39.9600",
    source_record_id: "1065",
    item_id: "8",
    transaction_id: "35378",
  },
];

function listedCourseIds(view: ReturnType<typeof buildCustomerPurchasedCourses>): string[] {
  return [
    ...view.homeStudyPurchases.map((row) => row.courseId),
    ...view.needsReview.map((row) => row.courseId),
  ].filter((id): id is string => id != null);
}

describe("customer purchased courses", () => {
  it("keeps four positive-credit candidates, drops three subscriber-free rows, and does not count history twice", () => {
    const view = buildCustomerPurchasedCourses({
      library: partialHistoryLibrary,
      history: partialHistoryPurchases,
      creditEvidenceAvailable: false,
    });

    expect(view.positiveCreditCandidateCount).toBe(4);
    expect(view.subscriberFreeExcludedCount).toBe(3);
    expect(view.homeStudyPurchases).toHaveLength(2);
    expect(view.purchaseCount).toBe(2);
    expect(view.purchaseCount).not.toBe(
      view.positiveCreditCandidateCount + partialHistoryPurchases.length,
    );
    expect(view.needsReview.map((row) => row.courseId)).toEqual(["3", "7"]);
    expect(listedCourseIds(view).filter((id) => ["1", "32", "54"].includes(id))).toEqual([]);
    expect(view.homeStudyPurchases.map((row) => row.courseId)).toEqual(["6", "28"]);
    expect(view.homeStudyPurchases.map((row) => row.sourceLabel)).toEqual([
      "Credit 92440",
      "Credit 61191",
    ]);
    expect(view.homeStudyPurchases[0]?.title).toBe("Need a Plus Size Cardigan?");
    expect(view.homeStudyPurchases[0]?.purchaseDateSort).toBe("2016-10-22");
    expect(view.designaknitPurchases).toEqual([]);
  });

  it("does not choose a title for Home Study course 28", () => {
    const view = buildCustomerPurchasedCourses({
      library: partialHistoryLibrary,
      history: partialHistoryPurchases,
      creditEvidenceAvailable: false,
    });
    const course28 = view.homeStudyPurchases.find((row) => row.courseId === "28");

    expect(course28?.title).toBeNull();
    expect(course28?.titleNeedsReview).toBe(true);
    expect(course28?.title).not.toBe("Fit Once ... Get Knitting!");
    expect(course28?.title).not.toBe("Jennifer's Favorite Shrug");
    expect(course28?.recordedTitles).toEqual(HOME_STUDY_COURSE_28_TITLE_CONFLICT.recordedTitles);
  });

  it("counts four reconciled Home Study purchases once when every candidate has history", () => {
    const view = buildCustomerPurchasedCourses({
      library: allMatchedLibrary,
      history: allMatchedHistory,
      creditEvidenceAvailable: false,
    });

    expect(view.positiveCreditCandidateCount).toBe(4);
    expect(view.subscriberFreeExcludedCount).toBe(3);
    expect(view.homeStudyPurchases).toHaveLength(4);
    expect(view.purchaseCount).toBe(4);
    expect(view.needsReview).toEqual([]);
    expect(view.purchaseCount).not.toBe(allMatchedLibrary.length + allMatchedHistory.length);
    expect(view.homeStudyPurchases.find((row) => row.courseId === "28")?.title).toBeNull();
    expect(view.homeStudyPurchases.find((row) => row.courseId === "8")?.title).toBe(
      "Beginner Bootcamp",
    );
  });

  it("keeps a DesignaKnit purchase with the same numeric id out of the Home Study list", () => {
    const view = buildCustomerPurchasedCourses({
      library: [
        {
          homestudy_libraryid: "658",
          homestudy_courseid_fk: 7,
          dateadded: "2013-04-01T07:00:00.000Z",
          credit_id_fk: 23982,
          subscriberfree: 0,
        },
      ],
      history: [
        {
          category: "Course Purchase",
          transaction_date: "2013-04-01T07:00:00.000Z",
          description: "Home Study Course Purchase: Top Down Raglan Sweaters Courses ($14.99)",
          amount: "14.99",
          source_record_id: "658",
          item_id: "7",
          transaction_id: "23982",
        },
        {
          category: LEARN_DESIGNAKNIT_COURSE_PURCHASE_CATEGORY,
          transaction_date: "2020-01-02",
          description: "Standard Garment Styling",
          amount: "29.00",
          source_record_id: "learndesignknit:514",
          item_id: "7",
          transaction_id: "514",
        },
      ],
      creditEvidenceAvailable: false,
    });

    expect(view.homeStudyPurchases.map((row) => row.title)).toEqual(["Top Down Raglan Sweaters"]);
    expect(view.designaknitPurchases.map((row) => row.title)).toEqual(["Standard Garment Styling"]);
    expect(view.designaknitPurchases[0]?.family).toBe("LearnDAK");
    expect(view.designaknitPurchases[0]?.sourceLabel).toBe("Transaction 514");
    expect(view.purchases.map((row) => row.family)).toEqual(["LearnDAK", "Home Study"]);
    expect(view.purchaseCount).toBe(2);
    expect(view.needsReview).toEqual([]);
  });

  it("uses loaded credit evidence when Legacy History has no matching purchase", () => {
    const view = buildCustomerPurchasedCourses({
      library: [
        {
          homestudy_libraryid: "1153",
          homestudy_courseid_fk: 3,
          dateadded: "2014-02-25T08:00:00.000Z",
          credit_id_fk: 37980,
          subscriberfree: 0,
        },
      ],
      history: [],
      evidence: [
        {
          credit_id: 37980,
          transaction_type: "Home Study Courses",
          dollar_amount: "19.99",
          authorize_id: "auth",
          transaction_guid: "guid",
        },
      ],
      creditEvidenceAvailable: true,
    });

    expect(view.homeStudyPurchases).toHaveLength(1);
    expect(view.homeStudyPurchases[0]?.sourceLabel).toBe("Credit 37980");
    expect(view.homeStudyPurchases[0]?.amount).toBe("$19.99");
    expect(view.needsReview).toEqual([]);
  });

  it("keeps an LK150 bundle separate when its source id matches a Home Study library id", () => {
    const view = buildCustomerPurchasedCourses({
      library: [
        {
          homestudy_libraryid: "1134",
          homestudy_courseid_fk: 6,
          dateadded: "2016-10-22T07:00:00.000Z",
          credit_id_fk: 92440,
          subscriberfree: 0,
        },
      ],
      history: [
        {
          category: "Course Purchase",
          transaction_date: "2016-10-22T07:00:00.000Z",
          description: "Home Study Course Purchase: Need a Plus Size Cardigan? Courses ($12.48)",
          amount: "12.48",
          source_record_id: "1134",
          item_id: "6",
          transaction_id: "92440",
        },
        {
          category: "LK150 Bundle",
          transaction_date: "2018-03-01",
          description: "Course Bundle Purchase: Mastering your LK-150 Courses ($89.00)",
          amount: "89.00",
          source_record_id: "1134",
          item_id: "1001",
          transaction_id: "214808",
        },
      ],
      creditEvidenceAvailable: false,
    });

    expect(view.purchaseCount).toBe(2);
    expect(view.lk150Purchases).toEqual([
      expect.objectContaining({
        family: "LK150",
        title: "Mastering your LK-150",
        courseId: "1001",
        sourceLabel: "Transaction 214808",
      }),
    ]);
    expect(view.homeStudyPurchases.map((row) => row.title)).toEqual(["Need a Plus Size Cardigan?"]);
    expect(view.purchases.map((row) => row.family).sort()).toEqual(["Home Study", "LK150"]);
  });

  it("excludes a subscriber-free Home Study course 49 row and still lists LearnDAK", () => {
    const view = buildCustomerPurchasedCourses({
      library: [
        {
          homestudy_libraryid: "9001",
          homestudy_courseid_fk: 49,
          dateadded: "2016-01-01T00:00:00.000Z",
          credit_id_fk: 0,
          subscriberfree: 1,
        },
      ],
      history: [
        {
          category: LEARN_DESIGNAKNIT_COURSE_PURCHASE_CATEGORY,
          transaction_date: "2019-04-04",
          description: "Stitch Designer 101",
          amount: "49.00",
          source_record_id: "learndesignknit:77",
          item_id: "49",
          transaction_id: "77",
        },
      ],
      creditEvidenceAvailable: false,
    });

    expect(view.subscriberFreeExcludedCount).toBe(1);
    expect(view.homeStudyPurchases).toEqual([]);
    expect(view.needsReview).toEqual([]);
    expect(view.purchases).toEqual([
      expect.objectContaining({
        family: "LearnDAK",
        title: "Stitch Designer 101",
        sourceLabel: "Transaction 77",
      }),
    ]);
    expect(view.purchaseCount).toBe(1);
  });

  it("uses the Home Study catalog when the purchase text is only a course count", () => {
    const view = buildCustomerPurchasedCourses({
      library: [
        {
          homestudy_libraryid: "10",
          homestudy_courseid_fk: 1,
          dateadded: "2014-01-01T00:00:00.000Z",
          credit_id_fk: 100,
          subscriberfree: 0,
        },
      ],
      history: [
        {
          category: "Course Purchase",
          transaction_date: "2014-01-01",
          description: "Home Study Course Purchase: 1 Courses ($9.99)",
          amount: "9.99",
          source_record_id: "10",
          item_id: "1",
          transaction_id: "100",
        },
      ],
      creditEvidenceAvailable: false,
    });

    expect(view.homeStudyPurchases[0]?.title).toBe(
      "Using Hand Knitting Patterns for Machine Knitting",
    );
    expect(view.homeStudyPurchases[0]?.titleNeedsReview).toBe(false);
    expect(view.purchaseCount).toBe(1);
  });
});
