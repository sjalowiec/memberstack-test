import { queryWatson } from "./db";
import { type WatsonQueryFn } from "./memberSearch";

export const WATSON_NOTE_CATEGORIES = [
  "General",
  "Course",
  "Membership",
  "Payment",
  "Support",
] as const;

export type WatsonNoteCategory = (typeof WATSON_NOTE_CATEGORIES)[number];

export const WATSON_NOTE_DEFAULT_AUTHOR = "Sue";
export const WATSON_NOTE_TEXT_MAX_LENGTH = 10_000;
export const WATSON_NOTE_MEMBERID_MAX_LENGTH = 100;
export const WATSON_NOTE_AUTHOR_MAX_LENGTH = 100;

export interface WatsonNoteRow {
  id: string;
  memberid: string;
  note_text: string;
  category: string;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string | null;
}

export interface WatsonNoteDisplay {
  id: string;
  memberid: string;
  noteText: string;
  category: WatsonNoteCategory;
  createdBy: string;
  createdAt: string;
  createdAtSort: string;
  updatedAt: string | null;
  updatedAtSort: string;
}

export type WatsonNoteValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export const WATSON_NOTES_BY_MEMBER_SQL = `
  SELECT
    id,
    memberid,
    note_text,
    category,
    created_by,
    created_at,
    updated_at
  FROM watson_notes
  WHERE memberid = $1
  ORDER BY created_at DESC, id DESC
`;

export const WATSON_NOTES_BY_CUSTOMER_SQL = `
  SELECT
    id,
    memberid,
    note_text,
    category,
    created_by,
    created_at,
    updated_at
  FROM watson_notes
  WHERE memberid = $1 OR ($2::text IS NOT NULL AND memberid = $2)
  ORDER BY created_at DESC, id DESC
`;

export const WATSON_NOTE_COUNT_BY_CUSTOMER_SQL = `
  SELECT COUNT(*)::text AS note_count
  FROM watson_notes
  WHERE memberid = $1 OR ($2::text IS NOT NULL AND memberid = $2)
`;

export const WATSON_NOTE_COUNT_BY_MEMBER_SQL = `
  SELECT COUNT(*)::text AS note_count
  FROM watson_notes
  WHERE memberid = $1
`;

export const WATSON_NOTE_BY_ID_SQL = `
  SELECT
    id,
    memberid,
    note_text,
    category,
    created_by,
    created_at,
    updated_at
  FROM watson_notes
  WHERE id = $1
  LIMIT 1
`;

export function isWatsonNoteCategory(value: string): value is WatsonNoteCategory {
  return (WATSON_NOTE_CATEGORIES as readonly string[]).includes(value);
}

export function validateWatsonNoteMemberid(
  value: unknown,
): WatsonNoteValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "Member ID is required." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "Member ID is required." };
  }
  if (trimmed.length > WATSON_NOTE_MEMBERID_MAX_LENGTH) {
    return {
      ok: false,
      error: `Member ID must be ${WATSON_NOTE_MEMBERID_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function validateWatsonNoteText(value: unknown): WatsonNoteValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "Note text is required." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "Note text is required." };
  }
  if (trimmed.length > WATSON_NOTE_TEXT_MAX_LENGTH) {
    return {
      ok: false,
      error: `Note text must be ${WATSON_NOTE_TEXT_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function validateWatsonNoteCategory(
  value: unknown,
): WatsonNoteValidationResult<WatsonNoteCategory> {
  if (typeof value !== "string") {
    return { ok: false, error: "Category is required." };
  }
  const trimmed = value.trim();
  if (!isWatsonNoteCategory(trimmed)) {
    return {
      ok: false,
      error: `Category must be one of: ${WATSON_NOTE_CATEGORIES.join(", ")}.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function validateWatsonNoteAuthor(
  value: unknown,
): WatsonNoteValidationResult<string> {
  if (value == null || value === "") {
    return { ok: true, value: WATSON_NOTE_DEFAULT_AUTHOR };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Created by must be a string." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: WATSON_NOTE_DEFAULT_AUTHOR };
  }
  if (trimmed.length > WATSON_NOTE_AUTHOR_MAX_LENGTH) {
    return {
      ok: false,
      error: `Created by must be ${WATSON_NOTE_AUTHOR_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function validateWatsonNoteId(value: unknown): WatsonNoteValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "Note ID is required." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "Note ID is required." };
  }
  if (trimmed.length > 64) {
    return { ok: false, error: "Note ID is invalid." };
  }
  return { ok: true, value: trimmed };
}

export function toWatsonNoteTimestampSort(value: Date | string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

export function formatWatsonNoteTimestamp(value: Date | string | null | undefined): string | null {
  const sort = toWatsonNoteTimestampSort(value);
  if (!sort) {
    return null;
  }
  const date = new Date(sort);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildWatsonNoteDisplay(row: WatsonNoteRow): WatsonNoteDisplay {
  const category = isWatsonNoteCategory(row.category) ? row.category : "General";
  const createdAtSort = toWatsonNoteTimestampSort(row.created_at);
  const updatedAtSort = toWatsonNoteTimestampSort(row.updated_at);

  return {
    id: row.id,
    memberid: row.memberid,
    noteText: row.note_text,
    category,
    createdBy: row.created_by,
    createdAt: formatWatsonNoteTimestamp(row.created_at) ?? "",
    createdAtSort,
    updatedAt: formatWatsonNoteTimestamp(row.updated_at),
    updatedAtSort,
  };
}

export async function getMemberWatsonNoteCount(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<number> {
  const validated = validateWatsonNoteMemberid(memberid);
  if (!validated.ok) {
    return 0;
  }

  const rows = await queryFn<{ note_count: string }>(WATSON_NOTE_COUNT_BY_MEMBER_SQL, [
    validated.value,
  ]);
  const count = Number.parseInt(rows[0]?.note_count ?? "0", 10);
  return Number.isNaN(count) ? 0 : count;
}

export async function getMemberWatsonNotes(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WatsonNoteDisplay[]> {
  const validated = validateWatsonNoteMemberid(memberid);
  if (!validated.ok) {
    return [];
  }

  const rows = await queryFn<WatsonNoteRow>(WATSON_NOTES_BY_MEMBER_SQL, [validated.value]);
  return rows.map(buildWatsonNoteDisplay);
}

export async function getCustomerWatsonNotes(
  memberstackId: string,
  legacyMemberId?: string | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WatsonNoteDisplay[]> {
  const validatedMemberstackId = validateWatsonNoteMemberid(memberstackId);
  if (!validatedMemberstackId.ok) {
    return [];
  }

  const legacyId =
    legacyMemberId && legacyMemberId !== validatedMemberstackId.value
      ? validateWatsonNoteMemberid(legacyMemberId)
      : null;
  const legacyValue = legacyId?.ok ? legacyId.value : null;

  const rows = await queryFn<WatsonNoteRow>(WATSON_NOTES_BY_CUSTOMER_SQL, [
    validatedMemberstackId.value,
    legacyValue,
  ]);
  return rows.map(buildWatsonNoteDisplay);
}

export async function getCustomerWatsonNoteCount(
  memberstackId: string,
  legacyMemberId?: string | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<number> {
  const validatedMemberstackId = validateWatsonNoteMemberid(memberstackId);
  if (!validatedMemberstackId.ok) {
    return 0;
  }

  const legacyId =
    legacyMemberId && legacyMemberId !== validatedMemberstackId.value
      ? validateWatsonNoteMemberid(legacyMemberId)
      : null;
  const legacyValue = legacyId?.ok ? legacyId.value : null;

  const rows = await queryFn<{ note_count: string }>(WATSON_NOTE_COUNT_BY_CUSTOMER_SQL, [
    validatedMemberstackId.value,
    legacyValue,
  ]);
  const count = Number.parseInt(rows[0]?.note_count ?? "0", 10);
  return Number.isNaN(count) ? 0 : count;
}

export async function getWatsonNoteById(
  id: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WatsonNoteDisplay | null> {
  const validated = validateWatsonNoteId(id);
  if (!validated.ok) {
    return null;
  }

  const rows = await queryFn<WatsonNoteRow>(WATSON_NOTE_BY_ID_SQL, [validated.value]);
  const row = rows[0];
  return row ? buildWatsonNoteDisplay(row) : null;
}

export interface CreateWatsonNoteInput {
  memberid: string;
  noteText: string;
  category: string;
  createdBy?: string;
}

export async function createWatsonNote(
  input: CreateWatsonNoteInput,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WatsonNoteValidationResult<WatsonNoteDisplay>> {
  const memberid = validateWatsonNoteMemberid(input.memberid);
  if (!memberid.ok) {
    return memberid;
  }
  const noteText = validateWatsonNoteText(input.noteText);
  if (!noteText.ok) {
    return noteText;
  }
  const category = validateWatsonNoteCategory(input.category);
  if (!category.ok) {
    return category;
  }
  const createdBy = validateWatsonNoteAuthor(input.createdBy);
  if (!createdBy.ok) {
    return createdBy;
  }

  const rows = await queryFn<WatsonNoteRow>(
    `
      INSERT INTO watson_notes (memberid, note_text, category, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        memberid,
        note_text,
        category,
        created_by,
        created_at,
        updated_at
    `,
    [memberid.value, noteText.value, category.value, createdBy.value],
  );

  const row = rows[0];
  if (!row) {
    return { ok: false, error: "Unable to create note." };
  }
  return { ok: true, value: buildWatsonNoteDisplay(row) };
}

export interface UpdateWatsonNoteInput {
  id: string;
  noteText?: string;
  category?: string;
}

export async function updateWatsonNote(
  input: UpdateWatsonNoteInput,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WatsonNoteValidationResult<WatsonNoteDisplay>> {
  const id = validateWatsonNoteId(input.id);
  if (!id.ok) {
    return id;
  }

  const existing = await getWatsonNoteById(id.value, queryFn);
  if (!existing) {
    return { ok: false, error: "Note not found." };
  }

  let noteText = existing.noteText;
  if (input.noteText !== undefined) {
    const validated = validateWatsonNoteText(input.noteText);
    if (!validated.ok) {
      return validated;
    }
    noteText = validated.value;
  }

  let category = existing.category;
  if (input.category !== undefined) {
    const validated = validateWatsonNoteCategory(input.category);
    if (!validated.ok) {
      return validated;
    }
    category = validated.value;
  }

  const rows = await queryFn<WatsonNoteRow>(
    `
      UPDATE watson_notes
      SET
        note_text = $2,
        category = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        memberid,
        note_text,
        category,
        created_by,
        created_at,
        updated_at
    `,
    [id.value, noteText, category],
  );

  const row = rows[0];
  if (!row) {
    return { ok: false, error: "Note not found." };
  }
  return { ok: true, value: buildWatsonNoteDisplay(row) };
}

export async function deleteWatsonNote(
  id: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WatsonNoteValidationResult<{ id: string }>> {
  const validated = validateWatsonNoteId(id);
  if (!validated.ok) {
    return validated;
  }

  const rows = await queryFn<{ id: string }>(
    `
      DELETE FROM watson_notes
      WHERE id = $1
      RETURNING id
    `,
    [validated.value],
  );

  if (!rows[0]) {
    return { ok: false, error: "Note not found." };
  }
  return { ok: true, value: { id: rows[0].id } };
}
