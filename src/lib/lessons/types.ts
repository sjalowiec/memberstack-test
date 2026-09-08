/** Member lesson as stored in Postgres hybrid columns + jsonb document. */

export const LESSON_STATUSES = ["draft", "published", "review"] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export type LessonDocument = Record<string, unknown>;

export type MemberLessonRow = {
  id: number;
  slug: string;
  status: string;
  title: string | null;
  category: string | null;
  document: LessonDocument;
  created_at: Date | string;
  updated_at: Date | string;
  updated_by: string | null;
  deleted_at: Date | string | null;
};

export type MemberLessonRecord = LessonDocument & {
  id: number;
  slug: string;
  status: string;
  deletedAt?: string | null;
};

export type LessonWriteActor = {
  id?: string | null;
  email?: string | null;
};
