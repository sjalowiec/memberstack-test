/**
 * Count unique members who currently have each catalog video favorited.
 * Reads the existing member-favorites blobs once. Member ids never leave this module.
 */
import { getFavoritesStore } from "../../../netlify/functions/lib/member-favorites-store.js";
import { normalizeFavoriteContentId } from "../favorites/favoriteContentTypes";
import {
  catalogCanonicalIds,
  countUniqueVideoFavorites,
  type VideoAdminFavoritesSource,
  type VideoFavoriteDocument,
} from "./videoAdminPlanning";

const VIDEO_FAVORITE_KEY_SUFFIX = "/by-type/video.json";
const READ_CONCURRENCY = 8;

export type VideoFavoriteBlobStore = {
  list(options?: { paginate?: false }): Promise<{ blobs?: Array<{ key?: string }> }>;
  get(key: string, options: { type: "json" }): Promise<unknown>;
};

function publicFavoriteError(error: unknown): string {
  const fallback = "Saved favorites could not be read, so counts are not shown.";
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message || message.length > 180) return fallback;
  if (/postgres|password|secret|token|postgres:\/\//i.test(message)) return fallback;
  return `${fallback} ${message}`;
}

function contentIdsFromDocument(raw: unknown): { ok: true; contentIds: string[] } | { ok: false } {
  if (raw == null) return { ok: true, contentIds: [] };
  if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false };
  if (!("favorites" in raw)) return { ok: true, contentIds: [] };
  const favorites = (raw as { favorites?: unknown }).favorites;
  if (!Array.isArray(favorites)) return { ok: false };
  const contentIds: string[] = [];
  for (const row of favorites) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return { ok: false };
    const id = normalizeFavoriteContentId((row as { content_id?: unknown }).content_id);
    if (id) contentIds.push(id);
  }
  return { ok: true, contentIds };
}

function memberIdFromVideoFavoriteKey(key: string): string {
  if (!key.endsWith(VIDEO_FAVORITE_KEY_SUFFIX)) return "";
  return key.slice(0, -VIDEO_FAVORITE_KEY_SUFFIX.length).trim();
}

async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function loadVideoFavoriteDocuments(
  store: VideoFavoriteBlobStore,
): Promise<{ ok: true; documents: VideoFavoriteDocument[] } | { ok: false; error: string }> {
  let listed: { blobs?: Array<{ key?: string }> };
  try {
    listed = await store.list();
  } catch (error) {
    return { ok: false, error: publicFavoriteError(error) };
  }

  const keys = (listed.blobs ?? [])
    .map((blob) => (typeof blob?.key === "string" ? blob.key : ""))
    .filter((key) => key.endsWith(VIDEO_FAVORITE_KEY_SUFFIX));

  try {
    const documents = await mapPool(keys, READ_CONCURRENCY, async (key) => {
      const memberId = memberIdFromVideoFavoriteKey(key);
      if (!memberId) {
        throw new Error("A video favorite record has no member id.");
      }
      const raw = await store.get(key, { type: "json" });
      const parsed = contentIdsFromDocument(raw);
      if (!parsed.ok) {
        throw new Error("A video favorite record could not be read.");
      }
      return { memberId, contentIds: parsed.contentIds };
    });
    return { ok: true, documents };
  } catch (error) {
    return { ok: false, error: publicFavoriteError(error) };
  }
}

export async function loadVideoFavoriteCounts(
  catalogIds: readonly unknown[],
  store: VideoFavoriteBlobStore = getFavoritesStore() as VideoFavoriteBlobStore,
): Promise<VideoAdminFavoritesSource> {
  const loaded = await loadVideoFavoriteDocuments(store);
  if (!loaded.ok) return loaded;
  const counted = countUniqueVideoFavorites(loaded.documents, catalogCanonicalIds(catalogIds));
  return { ok: true, counts: counted.counts, unmatchedIds: counted.unmatchedIds };
}
