import { documentsMatch, lessonStatusFromDocument } from "./document";
import { listMemberLessonsForAdmin, upsertMemberLessonFromDocument } from "./store";
import type { LessonDocument, LessonWriteActor, MemberLessonRecord } from "./types";
import type { WatsonQueryFn } from "../watson/memberSearch";

export type LessonImportReport = {
  expectedCount: number;
  upsertedCount: number;
  uniqueIds: boolean;
  uniqueSlugs: boolean;
  roundTripFailures: string[];
  ids: number[];
  slugs: string[];
};

export function validateLessonSnapshot(docs: LessonDocument[]): {
  uniqueIds: boolean;
  uniqueSlugs: boolean;
  ids: number[];
  slugs: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const ids: number[] = [];
  const slugs: string[] = [];
  for (const doc of docs) {
    const id = typeof doc.id === "number" ? doc.id : NaN;
    const slug = typeof doc.slug === "string" ? doc.slug.trim() : "";
    if (!Number.isFinite(id)) errors.push(`Missing numeric id for slug "${slug || "(none)"}"`);
    else ids.push(id);
    if (!slug) errors.push(`Missing slug for id ${id}`);
    else slugs.push(slug);
  }
  const uniqueIds = new Set(ids).size === ids.length;
  const uniqueSlugs = new Set(slugs.map((s) => s.toLowerCase())).size === slugs.length;
  if (!uniqueIds) errors.push("Duplicate ids in snapshot.");
  if (!uniqueSlugs) errors.push("Duplicate slugs in snapshot.");
  return { uniqueIds, uniqueSlugs, ids, slugs, errors };
}

export async function importLessonDocuments(
  docs: LessonDocument[],
  queryFn: WatsonQueryFn,
  actor: LessonWriteActor | null = { email: "lessons-json-import" },
): Promise<LessonImportReport> {
  const snapshot = validateLessonSnapshot(docs);
  if (snapshot.errors.length) {
    throw new Error(snapshot.errors.join(" "));
  }

  const upserted: MemberLessonRecord[] = [];
  for (const doc of docs) {
    upserted.push(await upsertMemberLessonFromDocument(doc, actor, queryFn));
  }

  const loaded = await listMemberLessonsForAdmin(queryFn);
  const bySlug = new Map(loaded.map((row) => [String(row.slug).trim().toLowerCase(), row]));
  const roundTripFailures: string[] = [];
  for (const original of docs) {
    const slug = String(original.slug).trim().toLowerCase();
    const imported = bySlug.get(slug);
    if (!imported) {
      roundTripFailures.push(`${slug}: missing after import`);
      continue;
    }
    const expectedStatus = lessonStatusFromDocument(original);
    if (imported.status !== expectedStatus) {
      roundTripFailures.push(`${slug}: status mismatch`);
      continue;
    }
    const comparable: LessonDocument = { ...imported };
    if (!Object.prototype.hasOwnProperty.call(original, "status")) {
      delete comparable.status;
    }
    if (!documentsMatch(original, comparable)) {
      roundTripFailures.push(`${slug}: document mismatch`);
    }
  }

  return {
    expectedCount: docs.length,
    upsertedCount: upserted.length,
    uniqueIds: snapshot.uniqueIds,
    uniqueSlugs: snapshot.uniqueSlugs,
    roundTripFailures,
    ids: snapshot.ids,
    slugs: snapshot.slugs,
  };
}
