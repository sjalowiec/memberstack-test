import { describe, expect, it, vi } from "vitest";

import {
  buildCourseDisplay,
  formatCourseAccessStatus,
  getMemberCourses,
  getVisibleCourseColumns,
  MEMBER_COURSES_SQL,
  MEMBER_COURSE_SORTABLE_COLUMNS,
} from "./memberCourses";

describe("memberCourses", () => {
  const memberId = "DBBBB468-D698-F97C-C715-A8D1FB67238A";

  const subscriberFreeRow = {
    homestudy_libraryid: 353,
    homestudy_courseid_fk: 7,
    dateadded: "2013-03-27T00:00:00.000Z",
    credit_id_fk: 0,
    memberid_fk: memberId,
    subscriberfree: 1,
  };

  const creditPurchaseRow = {
    homestudy_libraryid: 2556,
    homestudy_courseid_fk: 7,
    dateadded: "2015-07-21T00:00:00.000Z",
    credit_id_fk: 63468,
    memberid_fk: memberId,
    subscriberfree: 0,
  };

  it("filters courses by memberid_fk", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([]);

    await getMemberCourses(memberId, queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_COURSES_SQL, [memberId]);
    expect(MEMBER_COURSES_SQL).toContain("legacy_course_member_library");
    expect(MEMBER_COURSES_SQL).toContain("WHERE memberid_fk = $1");
  });

  it("defaults to newest dateadded first in SQL", () => {
    expect(MEMBER_COURSES_SQL).toContain("ORDER BY dateadded DESC NULLS LAST, homestudy_libraryid DESC");
  });

  it("exposes sortable course columns for the UI", () => {
    expect(MEMBER_COURSE_SORTABLE_COLUMNS).toEqual([
      "libraryRecordId",
      "courseId",
      "courseName",
      "dateAdded",
      "accessStatus",
      "creditId",
    ]);
  });

  it("hides optional columns when a member has no useful values", () => {
    const visible = getVisibleCourseColumns([
      buildCourseDisplay(subscriberFreeRow, null),
      buildCourseDisplay(
        {
          ...creditPurchaseRow,
          credit_id_fk: 0,
          subscriberfree: null,
        },
        null,
      ),
    ]);

    expect(visible.showCourseName).toBe(false);
    expect(visible.showCreditId).toBe(false);
    expect(visible.showAccessStatus).toBe(true);
  });

  it("preserves multiple historical enrollments for the same course", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce([subscriberFreeRow, creditPurchaseRow]);

    const courses = await getMemberCourses(memberId, queryFn);

    expect(courses).toHaveLength(2);
    expect(courses.map((course) => course.libraryRecordId)).toEqual(["353", "2556"]);
    expect(courses.every((course) => course.courseId === "7")).toBe(true);
  });

  it("formats access status from imported subscriberfree and credit_id_fk", () => {
    expect(formatCourseAccessStatus(subscriberFreeRow)).toBe("Subscriber free");
    expect(formatCourseAccessStatus(creditPurchaseRow)).toBe("Credit purchase");
    expect(
      formatCourseAccessStatus({
        subscriberfree: 0,
        credit_id_fk: 0,
      }),
    ).toBe("Standard enrollment");
  });

  it("omits empty credit id values from display rows", () => {
    const display = buildCourseDisplay(subscriberFreeRow, "Sample Course");
    expect(display.creditId).toBeNull();
    expect(display.courseName).toBe("Sample Course");
  });
});
