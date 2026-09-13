import { getLessonId, nextLessonId, readLessonsFile, sortLessonsById, writeLessonsFile } from "./jsonFile";
import { lessonIsPubliclyPublished } from "../helpHubMemberLesson";
import {
  getMemberLessonById,
  getMemberLessonBySlug,
  insertMemberLesson,
  listMemberLessonsForAdmin,
  listPublicMemberLessons,
  nextMemberLessonDatabaseId,
  softDeleteMemberLesson,
  updateMemberLesson,
} from "./store";
import { useLessonsJsonStore } from "./storeMode";
import type { LessonDocument, LessonWriteActor, MemberLessonRecord } from "./types";

export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "23505";
}

export async function loadLessonsForAdmin(): Promise<MemberLessonRecord[]> {
  if (useLessonsJsonStore()) {
    return sortLessonsById(readLessonsFile()) as MemberLessonRecord[];
  }
  return listMemberLessonsForAdmin();
}

export async function loadPublicLessons(): Promise<MemberLessonRecord[]> {
  if (useLessonsJsonStore()) {
    return (readLessonsFile() as MemberLessonRecord[]).filter((row) =>
      lessonIsPubliclyPublished(row),
    );
  }
  const rows = await listPublicMemberLessons();
  return rows.filter((row) => lessonIsPubliclyPublished(row));
}

export async function loadLessonBySlug(
  slug: string,
  options: { publicOnly?: boolean } = {},
): Promise<MemberLessonRecord | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;
  if (useLessonsJsonStore()) {
    const found = readLessonsFile().find((row) => {
      const s = typeof row.slug === "string" ? row.slug.trim().toLowerCase() : "";
      return s === trimmed.toLowerCase();
    }) as MemberLessonRecord | undefined;
    if (!found) return null;
    if (options.publicOnly && !lessonIsPubliclyPublished(found)) return null;
    return found;
  }
  const lesson = await getMemberLessonBySlug(trimmed);
  if (!lesson) return null;
  if (options.publicOnly && !lessonIsPubliclyPublished(lesson)) return null;
  return lesson;
}

export async function loadLessonById(id: number): Promise<MemberLessonRecord | null> {
  if (useLessonsJsonStore()) {
    const found = readLessonsFile().find((row) => getLessonId(row) === id);
    return (found as MemberLessonRecord) ?? null;
  }
  return getMemberLessonById(id);
}

export async function saveNewLesson(
  body: LessonDocument,
  required: { slug: string; status: string; title: string; category: string },
  actor: LessonWriteActor | null,
): Promise<MemberLessonRecord> {
  if (useLessonsJsonStore()) {
    const lessons = readLessonsFile();
    const id = nextLessonId(lessons);
    const row: LessonDocument = {
      ...body,
      id,
      slug: required.slug,
      status: required.status,
      title: required.title,
    };
    if (required.category) row.category = required.category;
    lessons.push(row);
    writeLessonsFile(lessons);
    return row as MemberLessonRecord;
  }
  const id = await nextMemberLessonDatabaseId();
  return insertMemberLesson(
    body,
    { id, slug: required.slug, status: required.status, title: required.title, category: required.category },
    actor,
  );
}

export async function saveExistingLesson(
  id: number,
  body: LessonDocument,
  required: { slug: string; status: string; title: string; category: string },
  actor: LessonWriteActor | null,
): Promise<MemberLessonRecord | null> {
  if (useLessonsJsonStore()) {
    const lessons = readLessonsFile();
    const idx = lessons.findIndex((row) => getLessonId(row) === id);
    if (idx === -1) return null;
    const row: LessonDocument = {
      ...lessons[idx],
      ...body,
      id,
      slug: required.slug,
      status: required.status,
      title: required.title,
    };
    if (required.category) row.category = required.category;
    else if (Object.prototype.hasOwnProperty.call(body, "category") && !required.category) {
      delete row.category;
    }
    lessons[idx] = row;
    writeLessonsFile(lessons);
    return row as MemberLessonRecord;
  }
  return updateMemberLesson(id, body, required, actor);
}

export async function removeLesson(
  id: number,
  actor: LessonWriteActor | null,
): Promise<boolean> {
  if (useLessonsJsonStore()) {
    const lessons = readLessonsFile();
    const next = lessons.filter((row) => getLessonId(row) !== id);
    if (next.length === lessons.length) return false;
    writeLessonsFile(next);
    return true;
  }
  const deleted = await softDeleteMemberLesson(id, actor);
  return deleted != null;
}
