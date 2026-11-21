/**
 * Stored English transcripts for hosted video saves.
 *
 * The catalog database is the source for generated transcript JSON, because
 * those files are not committed in database mode. VTT bytes are stored here
 * when the site has no GitHub writer. A save must not report success until
 * both have been written.
 */
import { gitBlobSha } from "../machines/machineSalesGithub";
import { CATALOG_TRANSCRIPT_GENERATOR } from "../transcripts/catalogTranscriptData";
import { getWatsonPool, queryWatson } from "../watson/db";
import {
  VIDEO_DRAFT_TRANSCRIPT_REPO_DIR,
  VIDEO_GENERATED_TRANSCRIPT_PATHS,
  VIDEO_TRANSCRIPT_REPO_DIR,
  type VideoRepoChange,
  type VideoRepoFileEntry,
} from "./videoCatalogGithub";
import { videoCatalogDatabaseEnabled } from "./videoCatalogStore";

export const VIDEO_TRANSCRIPT_DOCUMENT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS public.video_transcript_documents (
    kind TEXT PRIMARY KEY,
    document TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT video_transcript_documents_kind_check CHECK (kind IN ('public', 'member', 'audit'))
  )
`;

export const VIDEO_TRANSCRIPT_FILE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS public.video_transcript_files (
    path TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    sha TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

export const VIDEO_TRANSCRIPT_DOCUMENT_RLS_SQL = `
  ALTER TABLE public.video_transcript_documents ENABLE ROW LEVEL SECURITY
`;

export const VIDEO_TRANSCRIPT_FILE_RLS_SQL = `
  ALTER TABLE public.video_transcript_files ENABLE ROW LEVEL SECURITY
`;

export const VIDEO_TRANSCRIPT_DOCUMENT_UPSERT_SQL = `
  INSERT INTO video_transcript_documents (kind, document, updated_at)
  VALUES ($1, $2, NOW())
  ON CONFLICT (kind) DO UPDATE SET
    document = EXCLUDED.document,
    updated_at = NOW()
`;

export const VIDEO_TRANSCRIPT_DOCUMENT_LIST_SQL = `
  SELECT kind, document
  FROM video_transcript_documents
`;

export const VIDEO_TRANSCRIPT_FILE_LIST_SQL = `
  SELECT path, sha
  FROM video_transcript_files
`;

export const VIDEO_TRANSCRIPT_FILE_LIST_CONTENT_SQL = `
  SELECT path, content, sha
  FROM video_transcript_files
`;

export const VIDEO_TRANSCRIPT_FILE_READ_SQL = `
  SELECT content, sha
  FROM video_transcript_files
  WHERE path = $1
`;

export const VIDEO_TRANSCRIPT_FILE_UPSERT_SQL = `
  INSERT INTO video_transcript_files (path, content, sha, updated_at)
  VALUES ($1, $2, $3, NOW())
  ON CONFLICT (path) DO UPDATE SET
    content = EXCLUDED.content,
    sha = EXCLUDED.sha,
    updated_at = NOW()
`;

export const VIDEO_TRANSCRIPT_FILE_DELETE_SQL = `
  DELETE FROM video_transcript_files
  WHERE path = $1
`;

export type VideoTranscriptDocumentKind = "public" | "member" | "audit";

export type StoredTranscriptFile = {
  path: string;
  content: string;
  sha: string;
};

type TranscriptQuery = (sql: string, params?: unknown[]) => Promise<unknown[]>;

const DOCUMENT_KIND_BY_PATH: Record<string, VideoTranscriptDocumentKind> = {
  [VIDEO_GENERATED_TRANSCRIPT_PATHS[0]]: "public",
  [VIDEO_GENERATED_TRANSCRIPT_PATHS[1]]: "member",
  [VIDEO_GENERATED_TRANSCRIPT_PATHS[2]]: "audit",
};

const VTT_FILE_RE = /^\d+(?:_en(?:-US)?)?\.vtt$/i;

let schemaReady: Promise<void> | null = null;

export function transcriptStorageErrorMessage(error: unknown, fallback: string): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const raw = error instanceof Error ? error.message : "";
  if (code === "42P01" || (/video_transcript_/i.test(raw) && /does not exist/i.test(raw))) {
    return "Transcript storage is not ready, so nothing was saved.";
  }
  if (!raw || /ECONNREFUSED|ENOTFOUND|password|postgres:\/\//i.test(raw)) return fallback;
  return fallback;
}

export function generatedDocumentKind(path: string): VideoTranscriptDocumentKind | null {
  return DOCUMENT_KIND_BY_PATH[path.replace(/\\/g, "/")] ?? null;
}

/** Repo path for one English VTT. Anything else is refused so it cannot be discarded quietly. */
export function transcriptFilePath(path: string): string {
  const normalized = path.replace(/\\/g, "/").trim();
  if (!normalized || normalized.includes("..") || normalized.startsWith("/") || normalized.includes("\\")) {
    throw new Error(`The transcript upload could not be stored. Nothing was saved.`);
  }
  for (const dir of [VIDEO_TRANSCRIPT_REPO_DIR, VIDEO_DRAFT_TRANSCRIPT_REPO_DIR]) {
    if (normalized.startsWith(`${dir}/`) && VTT_FILE_RE.test(normalized.slice(dir.length + 1))) return normalized;
  }
  throw new Error(`The transcript upload could not be stored. Nothing was saved.`);
}

export function generatedDocumentsFromChanges(
  changes: readonly VideoRepoChange[],
): Array<{ kind: VideoTranscriptDocumentKind; text: string }> {
  const docs: Array<{ kind: VideoTranscriptDocumentKind; text: string }> = [];
  for (const change of changes) {
    if (!("content" in change)) continue;
    const kind = generatedDocumentKind(change.path);
    if (!kind) continue;
    const text = change.content.toString("utf8");
    let parsed: { generator?: unknown; kind?: unknown };
    try {
      parsed = JSON.parse(text) as { generator?: unknown; kind?: unknown };
    } catch {
      throw new Error("The transcript could not be stored. Nothing was saved.");
    }
    if (parsed.generator !== CATALOG_TRANSCRIPT_GENERATOR || parsed.kind !== kind) {
      throw new Error("The transcript could not be stored. Nothing was saved.");
    }
    docs.push({ kind, text });
  }
  return docs;
}

/** Apply VTT writes, copies, and deletes. Copies are read before any delete in the same save. */
export function applyTranscriptFileEdits(
  existing: readonly StoredTranscriptFile[],
  changes: readonly VideoRepoChange[],
): StoredTranscriptFile[] {
  const byPath = new Map(existing.map((file) => [transcriptFilePath(file.path), { ...file, path: transcriptFilePath(file.path) }]));
  const copies = new Map<string, string>();
  for (const change of changes) {
    if (!("copyOf" in change)) continue;
    const path = transcriptFilePath(change.path);
    transcriptFilePath(change.copyOf.path);
    const source = byPath.get(transcriptFilePath(change.copyOf.path));
    if (!source) {
      throw new Error(`The stored transcript ${change.copyOf.path} could not be read, so nothing was saved.`);
    }
    copies.set(path, source.content);
  }
  for (const change of changes) {
    const path = transcriptFilePath(change.path);
    if ("delete" in change) {
      byPath.delete(path);
      continue;
    }
    const content = "copyOf" in change ? copies.get(path)! : change.content.toString("utf8");
    byPath.set(path, { path, content, sha: gitBlobSha(Buffer.from(content, "utf8")) });
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function transcriptListings(files: readonly Pick<StoredTranscriptFile, "path" | "sha">[]): {
  published: VideoRepoFileEntry[];
  drafts: VideoRepoFileEntry[];
} {
  const published: VideoRepoFileEntry[] = [];
  const drafts: VideoRepoFileEntry[] = [];
  for (const file of files) {
    const path = transcriptFilePath(file.path);
    const name = (dir: string) => path.slice(dir.length + 1);
    if (path.startsWith(`${VIDEO_TRANSCRIPT_REPO_DIR}/`)) published.push({ name: name(VIDEO_TRANSCRIPT_REPO_DIR), sha: file.sha });
    else drafts.push({ name: name(VIDEO_DRAFT_TRANSCRIPT_REPO_DIR), sha: file.sha });
  }
  return { published, drafts };
}

export async function ensureVideoTranscriptSchema(query: TranscriptQuery = queryWatson as TranscriptQuery): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(VIDEO_TRANSCRIPT_DOCUMENT_SCHEMA_SQL);
      await query(VIDEO_TRANSCRIPT_FILE_SCHEMA_SQL);
      await query(VIDEO_TRANSCRIPT_DOCUMENT_RLS_SQL);
      await query(VIDEO_TRANSCRIPT_FILE_RLS_SQL);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function withTranscriptTransaction(run: (query: TranscriptQuery) => Promise<void>): Promise<void> {
  const pool = await getWatsonPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const query: TranscriptQuery = async (sql, params = []) => {
      const result = await client.query(sql, params);
      return result.rows;
    };
    await ensureVideoTranscriptSchema(query);
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

export async function saveGeneratedTranscriptDocuments(
  changes: readonly VideoRepoChange[],
  transaction: (run: (query: TranscriptQuery) => Promise<void>) => Promise<void> = withTranscriptTransaction,
): Promise<void> {
  const docs = generatedDocumentsFromChanges(changes);
  if (docs.length === 0) return;
  try {
    await transaction(async (query) => {
      for (const doc of docs) await query(VIDEO_TRANSCRIPT_DOCUMENT_UPSERT_SQL, [doc.kind, doc.text]);
    });
  } catch (error) {
    throw new Error(transcriptStorageErrorMessage(error, "The transcript could not be stored. Nothing was saved."));
  }
}

export async function loadStoredGeneratedTranscriptTexts(
  query: TranscriptQuery = queryWatson as TranscriptQuery,
): Promise<Partial<Record<VideoTranscriptDocumentKind, string>>> {
  if (!videoCatalogDatabaseEnabled()) return {};
  await ensureVideoTranscriptSchema(query);
  const rows = (await query(VIDEO_TRANSCRIPT_DOCUMENT_LIST_SQL)) as Array<{ kind?: unknown; document?: unknown }>;
  const out: Partial<Record<VideoTranscriptDocumentKind, string>> = {};
  for (const row of rows) {
    const kind = row.kind === "public" || row.kind === "member" || row.kind === "audit" ? row.kind : null;
    if (!kind || typeof row.document !== "string" || !row.document.trim()) continue;
    out[kind] = row.document;
  }
  return out;
}

async function listStoredTranscriptFileRows(
  query: TranscriptQuery = queryWatson as TranscriptQuery,
): Promise<Array<{ path: string; sha: string; content?: string }>> {
  if (!videoCatalogDatabaseEnabled()) return [];
  await ensureVideoTranscriptSchema(query);
  const rows = (await query(VIDEO_TRANSCRIPT_FILE_LIST_SQL)) as Array<{ path?: unknown; sha?: unknown }>;
  const files: Array<{ path: string; sha: string }> = [];
  for (const row of rows) {
    if (typeof row.path !== "string" || typeof row.sha !== "string") continue;
    files.push({ path: transcriptFilePath(row.path), sha: row.sha });
  }
  return files;
}

export async function listStoredTranscriptFiles(
  query: TranscriptQuery = queryWatson as TranscriptQuery,
): Promise<{ published: VideoRepoFileEntry[]; drafts: VideoRepoFileEntry[] }> {
  return transcriptListings(await listStoredTranscriptFileRows(query));
}

export async function readStoredTranscriptFile(
  path: string,
  query: TranscriptQuery = queryWatson as TranscriptQuery,
): Promise<Buffer | null> {
  if (!videoCatalogDatabaseEnabled()) return null;
  await ensureVideoTranscriptSchema(query);
  const rows = (await query(VIDEO_TRANSCRIPT_FILE_READ_SQL, [transcriptFilePath(path)])) as Array<{ content?: unknown }>;
  const content = rows[0]?.content;
  return typeof content === "string" ? Buffer.from(content, "utf8") : null;
}

export async function applyStoredTranscriptFileChanges(
  changes: readonly VideoRepoChange[],
  query: TranscriptQuery = queryWatson as TranscriptQuery,
  transaction: (run: (query: TranscriptQuery) => Promise<void>) => Promise<void> = withTranscriptTransaction,
): Promise<void> {
  if (changes.length === 0) return;
  try {
    await ensureVideoTranscriptSchema(query);
    const rows = (await query(VIDEO_TRANSCRIPT_FILE_LIST_CONTENT_SQL)) as Array<{
      path?: unknown;
      content?: unknown;
      sha?: unknown;
    }>;
    const fullRows: StoredTranscriptFile[] = [];
    for (const row of rows) {
      if (typeof row.path !== "string" || typeof row.content !== "string" || typeof row.sha !== "string") continue;
      fullRows.push({ path: transcriptFilePath(row.path), content: row.content, sha: row.sha });
    }
    const next = applyTranscriptFileEdits(fullRows, changes);
    const nextByPath = new Map(next.map((file) => [file.path, file]));
    const previous = new Set(fullRows.map((file) => file.path));
    await transaction(async (write) => {
      for (const path of previous) {
        if (!nextByPath.has(path)) await write(VIDEO_TRANSCRIPT_FILE_DELETE_SQL, [path]);
      }
      for (const file of next) {
        const before = fullRows.find((row) => row.path === file.path);
        if (before && before.content === file.content && before.sha === file.sha) continue;
        await write(VIDEO_TRANSCRIPT_FILE_UPSERT_SQL, [file.path, file.content, file.sha]);
      }
    });
  } catch (error) {
    if (error instanceof Error && /Nothing was saved/.test(error.message)) throw error;
    throw new Error(transcriptStorageErrorMessage(error, "The transcript could not be stored. Nothing was saved."));
  }
}

type TranscriptArtifactLike = {
  generator?: string;
  kind?: string;
  records?: unknown;
};

/** Prefer the stored generated document. The deployed file remains the fallback. */
export async function loadDisplayedTranscriptArtifact<T extends TranscriptArtifactLike>(
  kind: "public" | "member",
  bundled: T,
): Promise<T> {
  if (!videoCatalogDatabaseEnabled()) return bundled;
  try {
    const stored = await loadStoredGeneratedTranscriptTexts();
    const text = stored[kind];
    if (!text) return bundled;
    const parsed = JSON.parse(text) as TranscriptArtifactLike;
    if (parsed?.generator !== CATALOG_TRANSCRIPT_GENERATOR || parsed.kind !== kind || !Array.isArray(parsed.records)) {
      return bundled;
    }
    return parsed as T;
  } catch (error) {
    console.error("Stored transcripts could not be read. Using the deployed transcript.");
    return bundled;
  }
}
