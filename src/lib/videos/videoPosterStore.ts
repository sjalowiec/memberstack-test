import { getWatsonPool, queryWatson } from "../watson/db";
import type { VideoPosterOverride } from "./videoPosterOverrides";

type PosterQuery = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export const VIDEO_POSTER_LIST_SQL = `
  SELECT content_id, poster_url
  FROM video_poster_overrides
  ORDER BY content_id ASC
`;

export const VIDEO_POSTER_DELETE_SQL = `DELETE FROM video_poster_overrides`;

export const VIDEO_POSTER_INSERT_SQL = `
  INSERT INTO video_poster_overrides (content_id, poster_url, updated_at)
  VALUES ($1, $2, NOW())
`;

type PosterRow = {
  content_id?: unknown;
  poster_url?: unknown;
};

export function isMissingVideoPosterTable(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const raw = error instanceof Error ? error.message : "";
  return code === "42P01" || (/video_poster_overrides/i.test(raw) && /does not exist/i.test(raw));
}

export function videoPosterErrorMessage(error: unknown, fallback: string): string {
  if (isMissingVideoPosterTable(error)) {
    return "Thumbnail storage is not ready, so nothing was saved.";
  }
  const raw = error instanceof Error ? error.message : "";
  if (!raw || /ECONNREFUSED|ENOTFOUND|password|postgres:\/\//i.test(raw)) return fallback;
  return fallback;
}

export function posterMapFromRows(rows: PosterRow[]): Map<string, string> {
  const overrides = new Map<string, string>();
  for (const row of rows) {
    const contentId = String(row.content_id ?? "").trim();
    if (!contentId) continue;
    overrides.set(contentId, typeof row.poster_url === "string" ? row.poster_url : "");
  }
  return overrides;
}

export async function listVideoPosterOverrides(
  query: PosterQuery = queryWatson as PosterQuery,
): Promise<Map<string, string>> {
  const rows = (await query(VIDEO_POSTER_LIST_SQL)) as PosterRow[];
  return posterMapFromRows(rows);
}

export async function replaceVideoPosterOverrides(
  overrides: VideoPosterOverride[],
  transaction?: (run: (query: PosterQuery) => Promise<void>) => Promise<void>,
): Promise<void> {
  const run = transaction ?? withPosterTransaction;
  await run(async (query) => {
    await query(VIDEO_POSTER_DELETE_SQL);
    for (const override of overrides) {
      await query(VIDEO_POSTER_INSERT_SQL, [override.contentId, override.posterUrl]);
    }
  });
}

export const VIDEO_POSTER_DELETE_ONE_SQL = `DELETE FROM video_poster_overrides WHERE content_id = $1`;

/**
 * Store one video's thumbnail. A catalog save calls this so the stored picture
 * matches the saved record right away, before the next deploy carries it.
 */
export async function setVideoPosterOverride(
  override: VideoPosterOverride,
  transaction?: (run: (query: PosterQuery) => Promise<void>) => Promise<void>,
): Promise<void> {
  const run = transaction ?? withPosterTransaction;
  await run(async (query) => {
    await query(VIDEO_POSTER_DELETE_ONE_SQL, [override.contentId]);
    await query(VIDEO_POSTER_INSERT_SQL, [override.contentId, override.posterUrl]);
  });
}

/** Public pages keep the catalog poster when storage cannot be read. */
export async function loadPublicVideoPosterOverrides(): Promise<Map<string, string>> {
  try {
    return await listVideoPosterOverrides();
  } catch (error) {
    if (!isMissingVideoPosterTable(error)) {
      console.error("Video thumbnail storage could not be read. Using catalog posters.");
    }
    return new Map();
  }
}

async function withPosterTransaction(run: (query: PosterQuery) => Promise<void>): Promise<void> {
  const pool = await getWatsonPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await run(async (sql, params = []) => {
      const result = await client.query(sql, params);
      return result.rows;
    });
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
