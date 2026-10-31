import bundledVideos from "../../data/videos-public.json";
import { normalizeVideoForSave } from "../videosPublicRecord";
import { getWatsonPool, queryWatson } from "../watson/db";
import { videoContentIdKey } from "./videoPosterOverrides";

export const VIDEO_CATALOG_SAVED_MESSAGE =
  "Saved. Published videos show in the Video Library and on their video page without a deploy.";

export const VIDEO_CATALOG_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS public.video_catalog_edits (
    content_id TEXT PRIMARY KEY,
    document JSONB,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

export const VIDEO_CATALOG_RLS_SQL = `
  ALTER TABLE public.video_catalog_edits ENABLE ROW LEVEL SECURITY
`;

export const VIDEO_CATALOG_LIST_SQL = `
  SELECT content_id, document, deleted, sort_order
  FROM video_catalog_edits
`;

export const VIDEO_CATALOG_DELETE_SQL = `
  DELETE FROM video_catalog_edits
  WHERE content_id = $1
`;

export const VIDEO_CATALOG_UPSERT_SQL = `
  INSERT INTO video_catalog_edits (content_id, document, deleted, sort_order, updated_at)
  VALUES ($1, $2::jsonb, FALSE, $3, NOW())
  ON CONFLICT (content_id) DO UPDATE SET
    document = EXCLUDED.document,
    deleted = FALSE,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW()
`;

export const VIDEO_CATALOG_TOMBSTONE_SQL = `
  INSERT INTO video_catalog_edits (content_id, document, deleted, sort_order, updated_at)
  VALUES ($1, NULL, TRUE, 0, NOW())
  ON CONFLICT (content_id) DO UPDATE SET
    document = NULL,
    deleted = TRUE,
    updated_at = NOW()
`;

type CatalogQuery = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export type VideoCatalogEdit = {
  contentId: string;
  document: Record<string, unknown> | null;
  deleted: boolean;
  sortOrder: number;
};

export type VideoCatalogWrite =
  | { op: "upsert"; contentId: string; document: Record<string, unknown>; sortOrder: number }
  | { op: "delete"; contentId: string }
  | { op: "tombstone"; contentId: string };

let schemaReady: Promise<void> | null = null;

export function bundledVideoCatalog(): unknown[] {
  return Array.isArray(bundledVideos) ? [...bundledVideos] : [];
}

/** Unit tests stay on the deployed file. Hosted and local app runs use the database. */
export function videoCatalogDatabaseEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VITEST === "true" && env.VIDEO_CATALOG_DB_IN_TEST !== "1") return false;
  return true;
}

export function isMissingVideoCatalogTable(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const raw = error instanceof Error ? error.message : "";
  return code === "42P01" || (/video_catalog_edits/i.test(raw) && /does not exist/i.test(raw));
}

export function videoCatalogErrorMessage(error: unknown, fallback: string): string {
  if (isMissingVideoCatalogTable(error)) {
    return "Video storage is not ready, so nothing was saved.";
  }
  const raw = error instanceof Error ? error.message : "";
  if (!raw || /ECONNREFUSED|ENOTFOUND|password|postgres:\/\//i.test(raw)) return fallback;
  return fallback;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stableValue(item));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = stableValue((value as Record<string, unknown>)[key]);
  }
  return out;
}

function recordsEqual(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizedFileRow(row: unknown): Record<string, unknown> | null {
  const normalized = normalizeVideoForSave(row, 0);
  return normalized.ok ? normalized.video : null;
}

export function mergeVideoCatalog(fileVideos: readonly unknown[], edits: readonly VideoCatalogEdit[]): unknown[] {
  const byId = new Map(edits.map((edit) => [edit.contentId, edit]));
  const seen = new Set<string>();
  const merged: unknown[] = [];

  for (const row of fileVideos) {
    const contentId = videoContentIdKey(asRecord(row)?.content_id);
    if (!contentId) {
      merged.push(row);
      continue;
    }
    seen.add(contentId);
    const edit = byId.get(contentId);
    if (edit?.deleted) continue;
    merged.push(edit?.document ?? row);
  }

  const added = edits
    .filter((edit) => !edit.deleted && edit.document && !seen.has(edit.contentId))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.contentId.localeCompare(b.contentId, "en"));
  for (const edit of added) merged.push(edit.document);
  return merged;
}

/**
 * Store only the rows that differ from the deployed catalog file.
 * Matching rows drop their override. Removed file rows are hidden, not rewritten.
 */
export function planVideoCatalogWrites(
  fileVideos: readonly unknown[],
  submitted: readonly Record<string, unknown>[],
  existingEditIds: readonly string[] = [],
): { ok: true; writes: VideoCatalogWrite[] } | { ok: false; error: string } {
  if (submitted.length === 0) {
    return { ok: false, error: "The catalog cannot be emptied, so nothing was saved." };
  }

  const fileById = new Map<string, unknown>();
  for (const row of fileVideos) {
    const contentId = videoContentIdKey(asRecord(row)?.content_id);
    if (contentId && !fileById.has(contentId)) fileById.set(contentId, row);
  }

  const submittedIds = new Set<string>();
  const writes: VideoCatalogWrite[] = [];
  const existing = new Set(existingEditIds);

  for (let index = 0; index < submitted.length; index += 1) {
    const video = submitted[index];
    const contentId = videoContentIdKey(video?.content_id);
    if (!contentId) {
      return { ok: false, error: `Video ${index + 1} is missing a Content ID, so nothing was saved.` };
    }
    if (submittedIds.has(contentId)) {
      return { ok: false, error: `Content ID ${contentId} appears more than once, so nothing was saved.` };
    }
    submittedIds.add(contentId);

    const fileRow = fileById.get(contentId);
    const fileNormalized = fileRow === undefined ? null : normalizedFileRow(fileRow);
    const submittedNormalized = normalizedFileRow(video);
    if (fileNormalized && submittedNormalized && recordsEqual(fileNormalized, submittedNormalized)) {
      if (existing.has(contentId)) writes.push({ op: "delete", contentId });
      continue;
    }
    writes.push({ op: "upsert", contentId, document: video, sortOrder: index });
  }

  for (const contentId of fileById.keys()) {
    if (!submittedIds.has(contentId)) writes.push({ op: "tombstone", contentId });
  }
  for (const contentId of existing) {
    if (!submittedIds.has(contentId) && !fileById.has(contentId)) {
      writes.push({ op: "delete", contentId });
    }
  }

  return { ok: true, writes };
}

export function editsFromRows(rows: readonly Record<string, unknown>[]): VideoCatalogEdit[] {
  const edits: VideoCatalogEdit[] = [];
  for (const row of rows) {
    const contentId = videoContentIdKey(row.content_id);
    if (!contentId) continue;
    const deleted = row.deleted === true;
    const document = asRecord(row.document);
    const sortOrder = typeof row.sort_order === "number" && Number.isFinite(row.sort_order) ? row.sort_order : 0;
    edits.push({ contentId, document: deleted ? null : document, deleted, sortOrder });
  }
  return edits;
}

export async function applyVideoCatalogWrites(writes: readonly VideoCatalogWrite[], query: CatalogQuery): Promise<void> {
  for (const write of writes) {
    if (write.op === "delete") {
      await query(VIDEO_CATALOG_DELETE_SQL, [write.contentId]);
      continue;
    }
    if (write.op === "tombstone") {
      await query(VIDEO_CATALOG_TOMBSTONE_SQL, [write.contentId]);
      continue;
    }
    await query(VIDEO_CATALOG_UPSERT_SQL, [write.contentId, JSON.stringify(write.document), write.sortOrder]);
  }
}

export async function ensureVideoCatalogSchema(query: CatalogQuery = queryWatson as CatalogQuery): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(VIDEO_CATALOG_SCHEMA_SQL);
      await query(VIDEO_CATALOG_RLS_SQL);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export async function listVideoCatalogEdits(query: CatalogQuery = queryWatson as CatalogQuery): Promise<VideoCatalogEdit[]> {
  await ensureVideoCatalogSchema(query);
  const rows = (await query(VIDEO_CATALOG_LIST_SQL)) as Record<string, unknown>[];
  return editsFromRows(rows);
}

export async function loadMergedVideoCatalog(
  fileVideos: readonly unknown[] = bundledVideoCatalog(),
): Promise<unknown[]> {
  if (!videoCatalogDatabaseEnabled()) return [...fileVideos];
  try {
    const edits = await listVideoCatalogEdits();
    return mergeVideoCatalog(fileVideos, edits);
  } catch (error) {
    if (!isMissingVideoCatalogTable(error)) {
      console.error("Video catalog database could not be read. Using the deployed catalog.");
    }
    return [...fileVideos];
  }
}

export async function saveVideoCatalogEdits(
  submitted: readonly Record<string, unknown>[],
  fileVideos: readonly unknown[] = bundledVideoCatalog(),
): Promise<unknown[]> {
  const existing = await listVideoCatalogEdits();
  const plan = planVideoCatalogWrites(
    fileVideos,
    submitted,
    existing.map((edit) => edit.contentId),
  );
  if (!plan.ok) throw new Error(plan.error);
  if (plan.writes.length === 0) return mergeVideoCatalog(fileVideos, existing);

  await withCatalogTransaction(async (query) => {
    await applyVideoCatalogWrites(plan.writes, query);
  });
  return loadMergedVideoCatalog(fileVideos);
}

async function withCatalogTransaction(run: (query: CatalogQuery) => Promise<void>): Promise<void> {
  const pool = await getWatsonPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const query: CatalogQuery = async (sql, params = []) => {
      const result = await client.query(sql, params);
      return result.rows;
    };
    await ensureVideoCatalogSchema(query);
    await run(query);
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* The original error is the one to report. */
    }
    throw error;
  } finally {
    client.release();
  }
}
