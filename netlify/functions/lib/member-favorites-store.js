/**
 * Netlify Blobs store for member favorites.
 * Key layout: `{verifiedMemberId}/by-type/{contentType}.json` in store `member-favorites`.
 */
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

export const MEMBER_FAVORITES_BLOB_STORE = "member-favorites";

export const FAVORITE_CONTENT_TYPES = ["video", "stitch", "reference", "tool"];

/**
 * @param {string} segment
 */
export function sanitizeKeySegment(segment) {
  return String(segment)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

/**
 * @param {string} memberId Verified Memberstack member id (never from the browser unchecked).
 * @param {string} contentType
 */
export function favoritesBlobKey(memberId, contentType) {
  return `${sanitizeKeySegment(memberId)}/by-type/${sanitizeKeySegment(contentType)}.json`;
}

/**
 * @param {unknown} value
 * @returns {value is "video" | "stitch" | "reference" | "tool"}
 */
export function isFavoriteContentType(value) {
  return typeof value === "string" && FAVORITE_CONTENT_TYPES.includes(value);
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeFavoriteContentId(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

export function getFavoritesStore() {
  return getStore({
    name: MEMBER_FAVORITES_BLOB_STORE,
    consistency: "strong",
  });
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  };
}

export function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders())) {
    headers.set(k, v);
  }
  return new Response(response.body, { status: response.status, headers });
}

/**
 * @param {unknown} raw
 * @returns {{ version: number, favorites: Array<Record<string, unknown>> }}
 */
export function normalizeFavoritesDocument(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 1, favorites: [] };
  }
  const favorites = Array.isArray(raw.favorites) ? raw.favorites.filter((row) => row && typeof row === "object") : [];
  return { version: 1, favorites: /** @type {Array<Record<string, unknown>>} */ (favorites) };
}

/**
 * @param {import("@netlify/blobs").Store} store
 * @param {string} memberId
 * @param {string} contentType
 */
export async function readFavoritesDocument(store, memberId, contentType) {
  const key = favoritesBlobKey(memberId, contentType);
  try {
    const raw = await store.get(key, { type: "json" });
    if (!raw) return { version: 1, favorites: [] };
    return normalizeFavoritesDocument(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not found|404|does not exist/i.test(message)) {
      return { version: 1, favorites: [] };
    }
    throw err;
  }
}

/**
 * @param {import("@netlify/blobs").Store} store
 * @param {string} memberId
 * @param {string} contentType
 * @param {{ version: number, favorites: unknown[] }} doc
 */
export async function writeFavoritesDocument(store, memberId, contentType, doc) {
  const key = favoritesBlobKey(memberId, contentType);
  await store.setJSON(key, doc);
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} memberId
 * @param {string} contentType
 */
function coerceFavoriteRecord(row, memberId, contentType) {
  const contentId = normalizeFavoriteContentId(row.content_id);
  if (!contentId) return null;
  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : randomUUID();
  const created =
    typeof row.created_at === "string" && row.created_at.trim()
      ? row.created_at.trim()
      : new Date().toISOString();
  return {
    id,
    member_id: memberId,
    content_type: contentType,
    content_id: contentId,
    created_at: created,
  };
}

/**
 * @param {import("@netlify/blobs").Store} store
 * @param {string} memberId
 * @param {string} contentType
 */
export async function listFavorites(store, memberId, contentType) {
  const doc = await readFavoritesDocument(store, memberId, contentType);
  const favorites = [];
  for (const row of doc.favorites) {
    const record = coerceFavoriteRecord(row, memberId, contentType);
    if (record) favorites.push(record);
  }
  return favorites;
}

/**
 * Idempotent add. Returns the existing or newly created record.
 * @param {import("@netlify/blobs").Store} store
 * @param {string} memberId
 * @param {string} contentType
 * @param {string} contentId
 */
export async function addFavorite(store, memberId, contentType, contentId) {
  const normalizedId = normalizeFavoriteContentId(contentId);
  if (!normalizedId) {
    return { ok: false, error: "content_id is required.", status: 400 };
  }

  const doc = await readFavoritesDocument(store, memberId, contentType);
  const existing = [];
  for (const row of doc.favorites) {
    const record = coerceFavoriteRecord(row, memberId, contentType);
    if (record) existing.push(record);
  }

  const found = existing.find((row) => row.content_id === normalizedId);
  if (found) {
    return { ok: true, favorite: found, created: false };
  }

  const favorite = {
    id: randomUUID(),
    member_id: memberId,
    content_type: contentType,
    content_id: normalizedId,
    created_at: new Date().toISOString(),
  };
  existing.push(favorite);
  await writeFavoritesDocument(store, memberId, contentType, { version: 1, favorites: existing });
  return { ok: true, favorite, created: true };
}

/**
 * Idempotent remove. Missing favorites are a no-op success.
 * @param {import("@netlify/blobs").Store} store
 * @param {string} memberId
 * @param {string} contentType
 * @param {string} contentId
 */
export async function removeFavorite(store, memberId, contentType, contentId) {
  const normalizedId = normalizeFavoriteContentId(contentId);
  if (!normalizedId) {
    return { ok: false, error: "content_id is required.", status: 400 };
  }

  const doc = await readFavoritesDocument(store, memberId, contentType);
  const next = [];
  let removed = false;
  for (const row of doc.favorites) {
    const record = coerceFavoriteRecord(row, memberId, contentType);
    if (!record) continue;
    if (record.content_id === normalizedId) {
      removed = true;
      continue;
    }
    next.push(record);
  }

  if (removed) {
    await writeFavoritesDocument(store, memberId, contentType, { version: 1, favorites: next });
  }
  return { ok: true, removed };
}
