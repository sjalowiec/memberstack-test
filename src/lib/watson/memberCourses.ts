import { hasDisplayValue } from "./memberDetail";
import { formatMemberJoinedDateDisplay, type WatsonQueryFn } from "./memberSearch";
import { queryWatson } from "./db";
import { resolveLegacyCourseName } from "./courseNameLookup";

export interface LegacyCourseMemberLibraryRow {
  homestudy_libraryid: string | number;
  homestudy_courseid_fk: number;
  dateadded: Date | string | null;
  credit_id_fk: number | null;
  memberid_fk: string;
  subscriberfree: number | null;
}

export interface MemberCourseDisplay {
  libraryRecordId: string;
  courseId: string;
  courseIdSort: string;
  courseName: string | null;
  dateAdded: string | null;
  dateAddedSort: string;
  accessStatus: string | null;
  creditId: string | null;
  creditIdSort: string;
}

export const MEMBER_COURSES_TABLE = "legacy_course_member_library";

export const MEMBER_COURSES_SQL = `
  SELECT
    homestudy_libraryid,
    homestudy_courseid_fk,
    dateadded,
    credit_id_fk,
    memberid_fk,
    subscriberfree
  FROM ${MEMBER_COURSES_TABLE}
  WHERE memberid_fk = $1
  ORDER BY dateadded DESC NULLS LAST, homestudy_libraryid DESC
`;

/** Columns exposed to the sortable courses table (for tests and UI). */
export const MEMBER_COURSE_SORTABLE_COLUMNS = [
  "libraryRecordId",
  "courseId",
  "courseName",
  "dateAdded",
  "accessStatus",
  "creditId",
] as const;

export type MemberCourseSortableColumn = (typeof MEMBER_COURSE_SORTABLE_COLUMNS)[number];

export function formatCourseAccessStatus(
  row: Pick<LegacyCourseMemberLibraryRow, "subscriberfree" | "credit_id_fk">,
): string | null {
  if (row.subscriberfree === 1) {
    return "Subscriber free";
  }
  if (row.credit_id_fk != null && row.credit_id_fk !== 0) {
    return "Credit purchase";
  }
  if (row.subscriberfree === 0) {
    return "Standard enrollment";
  }
  return null;
}

export function buildCourseDateAddedSort(dateadded: Date | string | null): string {
  if (!dateadded) {
    return "";
  }
  if (dateadded instanceof Date) {
    return dateadded.toISOString();
  }
  return String(dateadded);
}

export function buildCourseDisplay(
  row: LegacyCourseMemberLibraryRow,
  courseName: string | null = resolveLegacyCourseName(row.homestudy_courseid_fk),
): MemberCourseDisplay {
  const creditId =
    row.credit_id_fk != null && row.credit_id_fk !== 0 ? String(row.credit_id_fk) : null;

  return {
    libraryRecordId: String(row.homestudy_libraryid),
    courseId: String(row.homestudy_courseid_fk),
    courseIdSort: String(row.homestudy_courseid_fk).padStart(8, "0"),
    courseName: hasDisplayValue(courseName) ? String(courseName).trim() : null,
    dateAdded: row.dateadded ? formatMemberJoinedDateDisplay(row.dateadded) : null,
    dateAddedSort: buildCourseDateAddedSort(row.dateadded),
    accessStatus: formatCourseAccessStatus(row),
    creditId,
    creditIdSort: creditId ?? "",
  };
}

export function getVisibleCourseColumns(courses: MemberCourseDisplay[]): {
  showCourseName: boolean;
  showAccessStatus: boolean;
  showCreditId: boolean;
} {
  return {
    showCourseName: courses.some((course) => course.courseName != null),
    showAccessStatus: courses.some((course) => course.accessStatus != null),
    showCreditId: courses.some((course) => course.creditId != null),
  };
}

export async function getMemberCourses(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<MemberCourseDisplay[]> {
  const normalized = memberid.trim();
  if (!normalized) {
    return [];
  }

  const rows = await queryFn<LegacyCourseMemberLibraryRow>(MEMBER_COURSES_SQL, [normalized]);
  return rows.map((row) => buildCourseDisplay(row));
}
