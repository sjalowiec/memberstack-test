import catalogCsv from "../../../data/watson/legacy-home-study-courses.csv?raw";

import { queryWatson } from "./db";
import type { WatsonQueryFn } from "./memberSearch";
import { formatLaTimestamp } from "./salesReportDates";

/**
 * Planning catalog for legacy Home Study courses.
 * Facts come from the September 23, 2026 SQL Server export
 * (HomeStudy_courses + HomeStudy_Course_member_library).
 * Course ID is HomeStudy_courseid from that export.
 * Editable status and notes live in watson_legacy_homestudy_course_plans.
 * This module does not read or write customer course-library rows.
 */

export const LEGACY_HOME_STUDY_SNAPSHOT = {
  exportedOn: "2026-09-23",
  exportedOnDisplay: "September 23, 2026",
  sourceTables: "HomeStudy_courses and HomeStudy_Course_member_library",
  idSource: "HomeStudy_courseid",
} as const;

export const LEGACY_CREDIT_ENTRIES_LABEL = "Legacy credit entries";

export const PLACEHOLDER_COURSE_IDS = [37, 56, 60] as const;

export const RECREATION_STATUSES = [
  { value: "not_reviewed", label: "Not reviewed" },
  { value: "considering", label: "Considering" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "recreated", label: "Recreated" },
  { value: "will_not_recreate", label: "Will not recreate" },
] as const;

export type RecreationStatus = (typeof RECREATION_STATUSES)[number]["value"];

export const PLAN_NOTES_MAX_LENGTH = 5_000;

export const LEGACY_HOME_STUDY_PLAN_TABLE = "watson_legacy_homestudy_course_plans";

export const LIST_LEGACY_HOME_STUDY_PLANS_SQL = `
  SELECT course_id, recreation_status, other_uses, private_notes, updated_at
  FROM watson_legacy_homestudy_course_plans
`;

export const UPSERT_LEGACY_HOME_STUDY_PLAN_SQL = `
  INSERT INTO watson_legacy_homestudy_course_plans (
    course_id,
    recreation_status,
    other_uses,
    private_notes,
    updated_at
  )
  VALUES ($1, $2, $3, $4, NOW())
  ON CONFLICT (course_id) DO UPDATE SET
    recreation_status = EXCLUDED.recreation_status,
    other_uses = EXCLUDED.other_uses,
    private_notes = EXCLUDED.private_notes,
    updated_at = NOW()
  RETURNING course_id, recreation_status, other_uses, private_notes, updated_at
`;

const CSV_COLUMNS = [
  "CourseID",
  "Title",
  "Active",
  "CourseCost",
  "LibraryEntries",
  "CreditEntries",
  "SubscriberFreeEntries",
] as const;

const PLACEHOLDER_ID_SET = new Set<number>(PLACEHOLDER_COURSE_IDS);

export interface LegacyHomeStudyCourseRecord {
  courseId: number;
  title: string;
  active: 0 | 1;
  courseCost: string;
  libraryEntries: number;
  creditEntries: number;
  subscriberFreeEntries: number;
}

export interface LegacyHomeStudyPlanRow {
  course_id: number;
  recreation_status: string;
  other_uses: string | null;
  private_notes: string | null;
  updated_at: Date | string | null;
}

export interface LegacyHomeStudyPlanningCourse extends LegacyHomeStudyCourseRecord {
  legacyActiveLabel: "Yes" | "No";
  courseCostDisplay: string;
  libraryEntriesDisplay: string;
  creditEntriesDisplay: string;
  subscriberFreeEntriesDisplay: string;
  recreationStatus: RecreationStatus;
  otherUses: string;
  privateNotes: string;
  updatedAtDisplay: string | null;
  updatedAtSort: string;
}

export interface LegacyHomeStudyPlanWriteInput {
  courseId: unknown;
  recreationStatus: unknown;
  otherUses: unknown;
  privateNotes: unknown;
}

export interface ValidatedLegacyHomeStudyPlanWrite {
  courseId: number;
  recreationStatus: RecreationStatus;
  otherUses: string | null;
  privateNotes: string | null;
}

export type LegacyHomeStudyPlanResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export class LegacyHomeStudyPlanTableMissingError extends Error {
  constructor() {
    super(
      "Planning notes are not available yet. Apply scripts/sql/watson-legacy-home-study-course-plans.sql to the DEV Watson database.",
    );
    this.name = "LegacyHomeStudyPlanTableMissingError";
  }
}

export function parseLegacyHomeStudyCoursesCsv(text: string): LegacyHomeStudyCourseRecord[] {
  const table = parseCsv(text.replace(/^\uFEFF/, ""));
  const header = table[0];
  if (!header) {
    throw new Error("Legacy Home Study course export is empty.");
  }

  const indexes = CSV_COLUMNS.map((column) => header.indexOf(column));
  if (indexes.some((index) => index < 0)) {
    throw new Error(
      `Legacy Home Study course export must include ${CSV_COLUMNS.join(", ")}.`,
    );
  }

  const records: LegacyHomeStudyCourseRecord[] = [];
  const seen = new Set<number>();

  for (const [rowIndex, row] of table.slice(1).entries()) {
    if (row.every((cell) => cell.trim() === "")) {
      continue;
    }

    const courseId = parseRequiredInteger(row[indexes[0]] ?? "", "CourseID", rowIndex + 2);
    if (seen.has(courseId)) {
      throw new Error(`Duplicate HomeStudy course ID ${courseId}.`);
    }
    seen.add(courseId);

    const title = row[indexes[1]] ?? "";
    if (title.trim() === "") {
      throw new Error(`Course ${courseId} is missing a title.`);
    }

    const activeRaw = parseRequiredInteger(row[indexes[2]] ?? "", "Active", rowIndex + 2);
    if (activeRaw !== 0 && activeRaw !== 1) {
      throw new Error(`Course ${courseId} has an invalid Active flag.`);
    }

    const courseCost = (row[indexes[3]] ?? "").trim();
    if (!/^\d+\.\d{2}$/.test(courseCost)) {
      throw new Error(`Course ${courseId} has an invalid CourseCost.`);
    }

    records.push({
      courseId,
      title,
      active: activeRaw,
      courseCost,
      libraryEntries: parseRequiredInteger(row[indexes[4]] ?? "", "LibraryEntries", rowIndex + 2),
      creditEntries: parseRequiredInteger(row[indexes[5]] ?? "", "CreditEntries", rowIndex + 2),
      subscriberFreeEntries: parseRequiredInteger(
        row[indexes[6]] ?? "",
        "SubscriberFreeEntries",
        rowIndex + 2,
      ),
    });
  }

  return records;
}

export function isPlaceholderCourseId(courseId: number): boolean {
  return PLACEHOLDER_ID_SET.has(courseId);
}

export function isRecreationStatus(value: string): value is RecreationStatus {
  return RECREATION_STATUSES.some((status) => status.value === value);
}

export function recreationStatusLabel(status: RecreationStatus): string {
  return RECREATION_STATUSES.find((option) => option.value === status)?.label ?? status;
}

export function planningCourses(
  catalog: readonly LegacyHomeStudyCourseRecord[] = LEGACY_HOME_STUDY_COURSE_CATALOG,
): LegacyHomeStudyCourseRecord[] {
  return catalog.filter((course) => !isPlaceholderCourseId(course.courseId));
}

export function courseMatchesPlanningQuery(
  course: Pick<LegacyHomeStudyCourseRecord, "courseId" | "title">,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return (
    String(course.courseId).includes(needle) || course.title.toLowerCase().includes(needle)
  );
}

export function filterPlanningCourses(
  courses: readonly LegacyHomeStudyCourseRecord[],
  query: string,
): LegacyHomeStudyCourseRecord[] {
  return courses
    .filter((course) => courseMatchesPlanningQuery(course, query))
    .slice()
    .sort(compareByCreditEntriesDesc);
}

export function compareByCreditEntriesDesc(
  left: Pick<LegacyHomeStudyCourseRecord, "courseId" | "creditEntries">,
  right: Pick<LegacyHomeStudyCourseRecord, "courseId" | "creditEntries">,
): number {
  return right.creditEntries - left.creditEntries || left.courseId - right.courseId;
}

export function formatCourseCost(courseCost: string): string {
  return `$${courseCost}`;
}

export function formatEntryCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function mergePlanningCourses(
  courses: readonly LegacyHomeStudyCourseRecord[],
  plans: readonly LegacyHomeStudyPlanRow[],
): LegacyHomeStudyPlanningCourse[] {
  const plansById = new Map(plans.map((plan) => [Number(plan.course_id), plan]));
  return courses.map((course) => toPlanningCourse(course, plansById.get(course.courseId)));
}

export function validateLegacyHomeStudyPlanWrite(
  input: LegacyHomeStudyPlanWriteInput,
  catalog: readonly LegacyHomeStudyCourseRecord[] = LEGACY_HOME_STUDY_COURSE_CATALOG,
): LegacyHomeStudyPlanResult<ValidatedLegacyHomeStudyPlanWrite> {
  const courseId = parseCourseId(input.courseId);
  if (courseId == null) {
    return { ok: false, error: "Course ID must be a HomeStudy course ID from the export." };
  }

  const course = catalog.find((entry) => entry.courseId === courseId);
  if (!course) {
    return { ok: false, error: `Course ${courseId} is not in the Home Study export.` };
  }
  if (isPlaceholderCourseId(courseId)) {
    return {
      ok: false,
      error: `Course ${courseId} is a placeholder row and is not on the planning list.`,
    };
  }

  const statusRaw = typeof input.recreationStatus === "string" ? input.recreationStatus.trim() : "";
  if (!isRecreationStatus(statusRaw)) {
    return { ok: false, error: "Choose a recreation status." };
  }

  const otherUses = validateNotes(input.otherUses, "Other uses");
  if (!otherUses.ok) {
    return otherUses;
  }
  const privateNotes = validateNotes(input.privateNotes, "Private notes");
  if (!privateNotes.ok) {
    return privateNotes;
  }

  return {
    ok: true,
    value: {
      courseId,
      recreationStatus: statusRaw,
      otherUses: otherUses.value,
      privateNotes: privateNotes.value,
    },
  };
}

export async function listLegacyHomeStudyPlans(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<LegacyHomeStudyPlanRow[]> {
  try {
    return await queryFn<LegacyHomeStudyPlanRow>(LIST_LEGACY_HOME_STUDY_PLANS_SQL);
  } catch (error) {
    if (isMissingPlanTableError(error)) {
      throw new LegacyHomeStudyPlanTableMissingError();
    }
    throw error;
  }
}

export async function listLegacyHomeStudyPlanningCourses(
  query = "",
  queryFn: WatsonQueryFn = queryWatson,
): Promise<LegacyHomeStudyPlanningCourse[]> {
  const courses = filterPlanningCourses(planningCourses(), query);
  const plans = await listLegacyHomeStudyPlans(queryFn);
  return mergePlanningCourses(courses, plans);
}

export async function saveLegacyHomeStudyCoursePlan(
  input: LegacyHomeStudyPlanWriteInput,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<LegacyHomeStudyPlanResult<LegacyHomeStudyPlanningCourse>> {
  const validated = validateLegacyHomeStudyPlanWrite(input);
  if (!validated.ok) {
    return validated;
  }

  let rows: LegacyHomeStudyPlanRow[];
  try {
    rows = await queryFn<LegacyHomeStudyPlanRow>(UPSERT_LEGACY_HOME_STUDY_PLAN_SQL, [
      validated.value.courseId,
      validated.value.recreationStatus,
      validated.value.otherUses,
      validated.value.privateNotes,
    ]);
  } catch (error) {
    if (isMissingPlanTableError(error)) {
      throw new LegacyHomeStudyPlanTableMissingError();
    }
    throw error;
  }

  const course = LEGACY_HOME_STUDY_COURSE_CATALOG.find(
    (entry) => entry.courseId === validated.value.courseId,
  );
  if (!course || !rows[0]) {
    return { ok: false, error: "Unable to save this course plan." };
  }

  return { ok: true, value: toPlanningCourse(course, rows[0]) };
}

export function isMissingPlanTableError(error: unknown): boolean {
  if (typeof error !== "object" || error == null) {
    return false;
  }
  const code = "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  return code === "42P01" || /does not exist/i.test(message);
}

export const LEGACY_HOME_STUDY_COURSE_CATALOG = parseLegacyHomeStudyCoursesCsv(catalogCsv);

function toPlanningCourse(
  course: LegacyHomeStudyCourseRecord,
  plan: LegacyHomeStudyPlanRow | undefined,
): LegacyHomeStudyPlanningCourse {
  const status =
    plan && isRecreationStatus(plan.recreation_status) ? plan.recreation_status : "not_reviewed";
  const updatedAtSort = toTimestampSort(plan?.updated_at);
  return {
    ...course,
    legacyActiveLabel: course.active === 1 ? "Yes" : "No",
    courseCostDisplay: formatCourseCost(course.courseCost),
    libraryEntriesDisplay: formatEntryCount(course.libraryEntries),
    creditEntriesDisplay: formatEntryCount(course.creditEntries),
    subscriberFreeEntriesDisplay: formatEntryCount(course.subscriberFreeEntries),
    recreationStatus: status,
    otherUses: plan?.other_uses ?? "",
    privateNotes: plan?.private_notes ?? "",
    updatedAtDisplay: updatedAtSort ? formatLaTimestamp(updatedAtSort) : null,
    updatedAtSort,
  };
}

function toTimestampSort(value: Date | string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

function parseCourseId(value: unknown): number | null {
  const raw =
    typeof value === "number" && Number.isInteger(value)
      ? String(value)
      : typeof value === "string"
        ? value.trim()
        : "";
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const courseId = Number(raw);
  if (!Number.isSafeInteger(courseId)) {
    return null;
  }
  return courseId;
}

function validateNotes(
  value: unknown,
  label: string,
): LegacyHomeStudyPlanResult<string | null> {
  if (value == null) {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `${label} must be text.` };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (trimmed.length > PLAN_NOTES_MAX_LENGTH) {
    return { ok: false, error: `${label} must be ${PLAN_NOTES_MAX_LENGTH} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

function parseRequiredInteger(value: string, label: string, line: number): number {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} on line ${line} must be a whole number.`);
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} on line ${line} is out of range.`);
  }
  return parsed;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      field = "";
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    field += char ?? "";
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}
