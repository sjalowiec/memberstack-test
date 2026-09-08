import { queryWatson } from "../watson/db";
import type { WatsonQueryFn } from "../watson/memberSearch";
import {
  fieldsFromLessonDocument,
  isLessonStatus,
  lessonActorLabel,
  lessonFromRow,
  lessonStatusFromDocument,
  requireLessonId,
  type LessonInsertFields,
} from "./document";
import type { LessonDocument, MemberLessonRecord, MemberLessonRow, LessonWriteActor } from "./types";

const COLUMNS = `
  id,
  slug,
  status,
  title,
  category,
  document,
  created_at,
  updated_at,
  updated_by,
  deleted_at
`;

export const MEMBER_LESSONS_LIST_ADMIN_SQL = `
  SELECT ${COLUMNS}
  FROM member_lessons
  WHERE deleted_at IS NULL
  ORDER BY id ASC
`;

export const MEMBER_LESSONS_LIST_ADMIN_INCLUDING_DELETED_SQL = `
  SELECT ${COLUMNS}
  FROM member_lessons
  ORDER BY id ASC
`;

export const MEMBER_LESSONS_LIST_PUBLIC_SQL = `
  SELECT ${COLUMNS}
  FROM member_lessons
  WHERE deleted_at IS NULL
    AND lower(status) = 'published'
  ORDER BY id ASC
`;

export const MEMBER_LESSONS_GET_BY_SLUG_SQL = `
  SELECT ${COLUMNS}
  FROM member_lessons
  WHERE lower(slug) = lower($1)
    AND deleted_at IS NULL
  LIMIT 1
`;

export const MEMBER_LESSONS_GET_BY_ID_SQL = `
  SELECT ${COLUMNS}
  FROM member_lessons
  WHERE id = $1
    AND deleted_at IS NULL
  LIMIT 1
`;

export const MEMBER_LESSONS_MAX_ID_SQL = `
  SELECT COALESCE(MAX(id), 5000) AS max_id
  FROM member_lessons
`;

export const MEMBER_LESSONS_INSERT_SQL = `
  INSERT INTO member_lessons (
    id, slug, status, title, category, document, updated_by
  ) VALUES (
    $1, $2, $3, $4, $5, $6::jsonb, $7
  )
  ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug,
    status = EXCLUDED.status,
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    document = EXCLUDED.document,
    updated_at = NOW(),
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL
  RETURNING ${COLUMNS}
`;

export const MEMBER_LESSONS_UPDATE_SQL = `
  UPDATE member_lessons SET
    slug = $2,
    status = $3,
    title = $4,
    category = $5,
    document = $6::jsonb,
    updated_at = NOW(),
    updated_by = $7,
    deleted_at = NULL
  WHERE id = $1
    AND deleted_at IS NULL
  RETURNING ${COLUMNS}
`;

export const MEMBER_LESSONS_SOFT_DELETE_SQL = `
  UPDATE member_lessons SET
    deleted_at = NOW(),
    updated_at = NOW(),
    updated_by = $2
  WHERE id = $1
    AND deleted_at IS NULL
  RETURNING ${COLUMNS}
`;

function mapRows(rows: MemberLessonRow[]): MemberLessonRecord[] {
  return rows.map(lessonFromRow);
}

function insertParams(fields: LessonInsertFields, actor: LessonWriteActor | null): unknown[] {
  return [
    fields.id,
    fields.slug,
    fields.status,
    fields.title,
    fields.category,
    JSON.stringify(fields.document),
    lessonActorLabel(actor),
  ];
}

export async function listMemberLessonsForAdmin(
  queryFn: WatsonQueryFn = queryWatson,
  options: { includeDeleted?: boolean } = {},
): Promise<MemberLessonRecord[]> {
  const sql = options.includeDeleted
    ? MEMBER_LESSONS_LIST_ADMIN_INCLUDING_DELETED_SQL
    : MEMBER_LESSONS_LIST_ADMIN_SQL;
  const rows = await queryFn<MemberLessonRow>(sql);
  return mapRows(rows);
}

export async function listPublicMemberLessons(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<MemberLessonRecord[]> {
  const rows = await queryFn<MemberLessonRow>(MEMBER_LESSONS_LIST_PUBLIC_SQL);
  return mapRows(rows);
}

export async function getMemberLessonBySlug(
  slug: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<MemberLessonRecord | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;
  const rows = await queryFn<MemberLessonRow>(MEMBER_LESSONS_GET_BY_SLUG_SQL, [trimmed]);
  return rows[0] ? lessonFromRow(rows[0]) : null;
}

export async function getMemberLessonById(
  id: number,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<MemberLessonRecord | null> {
  if (!Number.isFinite(id)) return null;
  const rows = await queryFn<MemberLessonRow>(MEMBER_LESSONS_GET_BY_ID_SQL, [id]);
  return rows[0] ? lessonFromRow(rows[0]) : null;
}

export async function nextMemberLessonDatabaseId(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<number> {
  const rows = await queryFn<{ max_id: number | string }>(MEMBER_LESSONS_MAX_ID_SQL);
  const raw = rows[0]?.max_id;
  const max = typeof raw === "number" ? raw : parseInt(String(raw ?? "5000"), 10);
  const n = Number.isFinite(max) ? max : 5000;
  return Math.max(n, 5000) + 1;
}

export async function insertMemberLesson(
  lesson: LessonDocument,
  required: { id: number; slug: string; status: string; title: string; category: string },
  actor: LessonWriteActor | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<MemberLessonRecord> {
  if (!isLessonStatus(required.status)) {
    throw new Error(`Invalid lesson status: ${required.status}`);
  }
  const fields = fieldsFromLessonDocument(lesson, {
    id: required.id,
    slug: required.slug,
    status: required.status,
    title: required.title,
    category: required.category,
  });
  const rows = await queryFn<MemberLessonRow>(MEMBER_LESSONS_INSERT_SQL, insertParams(fields, actor));
  if (!rows[0]) throw new Error("Lesson insert returned no row.");
  return lessonFromRow(rows[0]);
}

export async function updateMemberLesson(
  id: number,
  lesson: LessonDocument,
  required: { slug: string; status: string; title: string; category: string },
  actor: LessonWriteActor | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<MemberLessonRecord | null> {
  if (!isLessonStatus(required.status)) {
    throw new Error(`Invalid lesson status: ${required.status}`);
  }
  const fields = fieldsFromLessonDocument(lesson, {
    id,
    slug: required.slug,
    status: required.status,
    title: required.title,
    category: required.category,
  });
  const params = insertParams(fields, actor);
  const rows = await queryFn<MemberLessonRow>(MEMBER_LESSONS_UPDATE_SQL, [
    id,
    params[1],
    params[2],
    params[3],
    params[4],
    params[5],
    params[6],
  ]);
  return rows[0] ? lessonFromRow(rows[0]) : null;
}

export async function softDeleteMemberLesson(
  id: number,
  actor: LessonWriteActor | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<MemberLessonRecord | null> {
  const rows = await queryFn<MemberLessonRow>(MEMBER_LESSONS_SOFT_DELETE_SQL, [
    id,
    lessonActorLabel(actor),
  ]);
  return rows[0] ? lessonFromRow(rows[0]) : null;
}

export async function upsertMemberLessonFromDocument(
  lesson: LessonDocument,
  actor: LessonWriteActor | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<MemberLessonRecord> {
  const id = requireLessonId(lesson);
  const slug = typeof lesson.slug === "string" ? lesson.slug.trim() : "";
  const title = typeof lesson.title === "string" ? lesson.title.trim() : slug;
  const category = typeof lesson.category === "string" ? lesson.category.trim() : "";
  const status = lessonStatusFromDocument(lesson);
  if (!slug) throw new Error(`Lesson id ${id} is missing a slug.`);
  return insertMemberLesson(
    lesson,
    { id, slug, status, title, category },
    actor,
    queryFn,
  );
}
