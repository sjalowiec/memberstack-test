import { queryWatson } from "../watson/db";
import type { WatsonQueryFn } from "../watson/memberSearch";
import {
  validateStudioSessionInput,
  type StudioSessionRecord,
  type StudioSessionResult,
  type StudioSessionStatus,
} from "./sessions";

const SESSION_SELECT = `
  id,
  slug,
  title,
  introduction,
  video,
  status,
  created_at,
  updated_at
`;

export const STUDIO_SESSIONS_SQL = `
  SELECT ${SESSION_SELECT}
  FROM watson_studio_sessions
  ORDER BY updated_at DESC, title ASC
`;

type StudioSessionRow = {
  id: string;
  slug: string;
  title: string;
  introduction: string;
  video: string;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
};

function iso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

export function mapStudioSessionRow(row: StudioSessionRow): StudioSessionRecord | null {
  if (row.status !== "draft" && row.status !== "published") return null;
  if (!row.id || !row.slug || !row.title) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    introduction: row.introduction ?? "",
    video: row.video ?? "",
    status: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function duplicateSlug(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique|duplicate/i.test(message);
}

async function slugTakenByOther(
  slug: string,
  exceptId: string | null,
  queryFn: WatsonQueryFn,
): Promise<boolean> {
  const rows = await queryFn<{ id: string }>(
    `
      SELECT id
      FROM watson_studio_sessions
      WHERE slug = $1 AND ($2::text IS NULL OR id <> $2)
      LIMIT 1
    `,
    [slug, exceptId],
  );
  return rows.length > 0;
}

export async function listStudioSessions(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<StudioSessionRecord[]> {
  const rows = await queryFn<StudioSessionRow>(STUDIO_SESSIONS_SQL);
  return rows.flatMap((row) => {
    const session = mapStudioSessionRow(row);
    return session ? [session] : [];
  });
}

export async function getStudioSessionById(
  id: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<StudioSessionRecord | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  const rows = await queryFn<StudioSessionRow>(
    `SELECT ${SESSION_SELECT} FROM watson_studio_sessions WHERE id = $1 LIMIT 1`,
    [trimmed],
  );
  return rows[0] ? mapStudioSessionRow(rows[0]) : null;
}

export async function getStudioSessionBySlug(
  slug: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<StudioSessionRecord | null> {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return null;
  const rows = await queryFn<StudioSessionRow>(
    `SELECT ${SESSION_SELECT} FROM watson_studio_sessions WHERE slug = $1 LIMIT 1`,
    [trimmed],
  );
  return rows[0] ? mapStudioSessionRow(rows[0]) : null;
}

export async function createStudioSession(
  input: Record<string, unknown>,
  queryFn: WatsonQueryFn = queryWatson,
  createId: () => string = () => crypto.randomUUID(),
): Promise<StudioSessionResult<StudioSessionRecord>> {
  const validated = validateStudioSessionInput(input);
  if (!validated.ok) return validated;
  if (await slugTakenByOther(validated.value.slug, null, queryFn)) {
    return validateStudioSessionInput(input, { slugTaken: true });
  }

  const id = createId();
  try {
    const rows = await queryFn<StudioSessionRow>(
      `
        INSERT INTO watson_studio_sessions (
          id, slug, title, introduction, video, status, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING ${SESSION_SELECT}
      `,
      [
        id,
        validated.value.slug,
        validated.value.title,
        validated.value.introduction,
        validated.value.video,
        validated.value.status,
      ],
    );
    const session = rows[0] ? mapStudioSessionRow(rows[0]) : null;
    if (!session || session.id !== id) return { ok: false, error: "Unable to create the session." };
    return { ok: true, value: session };
  } catch (error) {
    if (duplicateSlug(error)) {
      return { ok: false, error: "That public URL is already used by another session.", field: "slug" };
    }
    throw error;
  }
}

export async function updateStudioSession(
  id: string,
  input: Record<string, unknown>,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<StudioSessionResult<StudioSessionRecord>> {
  const existing = await getStudioSessionById(id, queryFn);
  if (!existing) return { ok: false, error: "Session not found." };

  const merged: Record<string, unknown> = {
    title: input.title ?? existing.title,
    introduction: input.introduction ?? existing.introduction,
    video: input.video ?? existing.video,
    slug: input.slug ?? existing.slug,
    status: input.status ?? existing.status,
  };
  const validated = validateStudioSessionInput(merged);
  if (!validated.ok) return validated;
  if (await slugTakenByOther(validated.value.slug, existing.id, queryFn)) {
    return validateStudioSessionInput(merged, { slugTaken: true });
  }

  try {
    const rows = await queryFn<StudioSessionRow>(
      `
        UPDATE watson_studio_sessions
        SET slug = $2,
            title = $3,
            introduction = $4,
            video = $5,
            status = $6,
            updated_at = NOW()
        WHERE id = $1
        RETURNING ${SESSION_SELECT}
      `,
      [
        existing.id,
        validated.value.slug,
        validated.value.title,
        validated.value.introduction,
        validated.value.video,
        validated.value.status,
      ],
    );
    const session = rows[0] ? mapStudioSessionRow(rows[0]) : null;
    if (!session || session.id !== existing.id) {
      return { ok: false, error: "Unable to save the session." };
    }
    return { ok: true, value: session };
  } catch (error) {
    if (duplicateSlug(error)) {
      return { ok: false, error: "That public URL is already used by another session.", field: "slug" };
    }
    throw error;
  }
}

export function splitStudioSessions(sessions: StudioSessionRecord[]): {
  drafts: StudioSessionRecord[];
  published: StudioSessionRecord[];
} {
  return {
    drafts: sessions.filter((session) => session.status === "draft"),
    published: sessions.filter((session) => session.status === "published"),
  };
}

export function studioSessionStatusLabel(status: StudioSessionStatus): "Draft" | "Published" {
  return status === "published" ? "Published" : "Draft";
}
