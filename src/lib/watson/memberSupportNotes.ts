import { hasDisplayValue } from "./memberDetail";
import { type WatsonQueryFn } from "./memberSearch";
import { queryWatson } from "./db";

export const LEGACY_MEMBER_NOTES_SOURCE = "legacy_members.notes";

export interface LegacyMemberNotesRow {
  memberid: string;
  notes: string | null;
}

export interface MemberLegacySupportNoteDisplay {
  noteRecordId: string;
  noteSource: string;
  noteText: string;
  noteDate: string | null;
  noteDateSort: string;
  author: string | null;
  noteType: string | null;
  status: string | null;
}

export const MEMBER_LEGACY_SUPPORT_NOTES_SQL = `
  SELECT
    memberid,
    notes
  FROM legacy_members
  WHERE memberid = $1
    AND notes IS NOT NULL
    AND BTRIM(notes) <> ''
`;

export const MEMBER_LEGACY_SUPPORT_NOTE_COUNT_SQL = `
  SELECT COUNT(*)::text AS note_count
  FROM legacy_members
  WHERE memberid = $1
    AND notes IS NOT NULL
    AND BTRIM(notes) <> ''
`;

export const MEMBER_SUPPORT_NOTE_SORTABLE_COLUMNS = [
  "noteRecordId",
  "noteSource",
  "noteText",
  "noteDate",
  "author",
  "noteType",
  "status",
] as const;

export function buildLegacySupportNoteRecordId(memberid: string): string {
  return `${memberid}:legacy-notes`;
}

export function buildLegacySupportNoteDisplay(row: LegacyMemberNotesRow): MemberLegacySupportNoteDisplay {
  return {
    noteRecordId: buildLegacySupportNoteRecordId(row.memberid),
    noteSource: LEGACY_MEMBER_NOTES_SOURCE,
    noteText: String(row.notes).trim(),
    noteDate: null,
    noteDateSort: "",
    author: null,
    noteType: null,
    status: null,
  };
}

export function getVisibleSupportNoteColumns(notes: MemberLegacySupportNoteDisplay[]): {
  showNoteDate: boolean;
  showAuthor: boolean;
  showNoteType: boolean;
  showStatus: boolean;
} {
  const hasValue = (getter: (note: MemberLegacySupportNoteDisplay) => string | null) =>
    notes.some((note) => getter(note) != null);

  return {
    showNoteDate: hasValue((note) => note.noteDate),
    showAuthor: hasValue((note) => note.author),
    showNoteType: hasValue((note) => note.noteType),
    showStatus: hasValue((note) => note.status),
  };
}

export async function getMemberLegacySupportNoteCount(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<number> {
  const normalized = memberid.trim();
  if (!normalized) {
    return 0;
  }

  const rows = await queryFn<{ note_count: string }>(MEMBER_LEGACY_SUPPORT_NOTE_COUNT_SQL, [
    normalized,
  ]);
  const count = Number.parseInt(rows[0]?.note_count ?? "0", 10);
  return Number.isNaN(count) ? 0 : count;
}

export async function getMemberLegacySupportNotes(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<MemberLegacySupportNoteDisplay[]> {
  const normalized = memberid.trim();
  if (!normalized) {
    return [];
  }

  const rows = await queryFn<LegacyMemberNotesRow>(MEMBER_LEGACY_SUPPORT_NOTES_SQL, [normalized]);
  return rows.map(buildLegacySupportNoteDisplay);
}

export function hasLegacySupportNoteText(value: string | null | undefined): boolean {
  return hasDisplayValue(value);
}
