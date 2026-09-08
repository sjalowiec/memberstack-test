import { getLessonId } from "./jsonFile";
import {
  LESSON_STATUSES,
  type LessonDocument,
  type LessonStatus,
  type LessonWriteActor,
  type MemberLessonRecord,
  type MemberLessonRow,
} from "./types";

export function isLessonStatus(value: string): value is LessonStatus {
  return (LESSON_STATUSES as readonly string[]).includes(value);
}

export function lessonActorLabel(actor: LessonWriteActor | null | undefined): string | null {
  const email = typeof actor?.email === "string" ? actor.email.trim() : "";
  if (email) return email;
  const id = typeof actor?.id === "string" ? actor.id.trim() : "";
  return id || null;
}

export function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Searchable status column: omitted/empty status on legacy rows is published. */
export function lessonStatusFromDocument(doc: LessonDocument): LessonStatus {
  const raw = typeof doc.status === "string" ? doc.status.trim().toLowerCase() : "";
  if (isLessonStatus(raw)) return raw;
  return "published";
}

export function canonicalLessonDocument(doc: LessonDocument): LessonDocument {
  const copy: LessonDocument = { ...doc };
  delete copy.deletedAt;
  return copy;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
}

export function documentsMatch(a: LessonDocument, b: LessonDocument): boolean {
  return stableStringify(canonicalLessonDocument(a)) === stableStringify(canonicalLessonDocument(b));
}

export function lessonFromRow(row: MemberLessonRow): MemberLessonRecord {
  const raw =
    row.document && typeof row.document === "object" && !Array.isArray(row.document)
      ? { ...row.document }
      : {};
  const lesson: MemberLessonRecord = {
    ...raw,
    id: row.id,
    slug: row.slug,
    status: row.status,
  };
  if (row.deleted_at) {
    lesson.deletedAt =
      row.deleted_at instanceof Date ? row.deleted_at.toISOString() : String(row.deleted_at);
  } else {
    delete lesson.deletedAt;
  }
  return lesson;
}

export type LessonInsertFields = {
  id: number;
  slug: string;
  status: LessonStatus;
  title: string;
  category: string | null;
  document: LessonDocument;
};

export function fieldsFromLessonDocument(
  lesson: LessonDocument,
  required: { id: number; slug: string; status: LessonStatus; title: string; category: string },
): LessonInsertFields {
  const document = canonicalLessonDocument({
    ...lesson,
    id: required.id,
    slug: required.slug,
  });
  if (required.title) document.title = required.title;
  if (Object.prototype.hasOwnProperty.call(lesson, "status")) {
    document.status = required.status;
  } else {
    delete document.status;
  }
  if (required.category) document.category = required.category;
  else if (!Object.prototype.hasOwnProperty.call(lesson, "category")) {
    delete document.category;
  }
  return {
    id: required.id,
    slug: required.slug,
    status: required.status,
    title: required.title,
    category: required.category || null,
    document,
  };
}

export function requireLessonId(lesson: LessonDocument): number {
  const id = getLessonId(lesson);
  if (id == null) {
    throw new Error("Lesson is missing a numeric id.");
  }
  return id;
}

export type LessonPutValidatedFields = {
  id: number;
  title: string;
  slug: string;
  status: string;
  category: string;
};

/**
 * Merge a PUT payload into an existing lesson.
 * Omitted body fields keep existing values so editor-only fields cannot wipe the document.
 */
export function mergeLessonPutUpdate(
  existing: Record<string, unknown>,
  body: Record<string, unknown>,
  validated: LessonPutValidatedFields,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    ...existing,
    ...body,
  };
  row.id = validated.id;
  row.title = validated.title;
  row.slug = validated.slug;
  row.status = validated.status;
  if (validated.category) row.category = validated.category;
  else if (Object.prototype.hasOwnProperty.call(body, "category")) {
    if (validated.category === "") delete row.category;
    else row.category = validated.category;
  }
  delete row.deletedAt;
  return row;
}
