/**
 * Browser client for the member favorites Netlify function.
 * Sends a verified Memberstack session JWT; never sends a member id for ownership.
 */

import { memberIdFromMemberstackPayload } from "../patterns/memberstackMember";
import { normalizeFavoriteContentId, type FavoriteContentType, type FavoriteRecord } from "./favoriteContentTypes";

export const FAVORITES_CHANGE_EVENT = "kin-favorites-change";

export type FavoritesChangeDetail = {
  contentType: FavoriteContentType;
  contentId: string;
  isFavorite: boolean;
};

const API_PATH = "/.netlify/functions/favorites";

async function waitForMemberstackDom(maxAttempts = 35, intervalMs = 200) {
  for (let i = 0; i < maxAttempts; i++) {
    const ms = window.$memberstackDom;
    if (ms?.getCurrentMember) {
      if (ms.onReady) await ms.onReady;
      return ms;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return window.$memberstackDom;
}

/** Authorization header from Memberstack session cookie, or {} when logged out. */
export async function getFavoritesAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  try {
    const ms = await waitForMemberstackDom();
    const token = await ms?.getMemberCookie?.();
    if (typeof token === "string" && token.trim()) {
      return { Authorization: `Bearer ${token.trim()}` };
    }
  } catch {
    /* unauthenticated */
  }
  return {};
}

export async function isFavoritesMemberLoggedIn(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const ms = await waitForMemberstackDom();
    const res = await ms?.getCurrentMember?.();
    return Boolean(memberIdFromMemberstackPayload(res));
  } catch {
    return false;
  }
}

type ListResponse = {
  ok: boolean;
  favorites?: FavoriteRecord[];
  error?: string;
};

type MutateResponse = {
  ok: boolean;
  favorite?: FavoriteRecord;
  created?: boolean;
  removed?: boolean;
  error?: string;
};

export async function listFavorites(contentType: FavoriteContentType): Promise<FavoriteRecord[]> {
  const headers = await getFavoritesAuthHeaders();
  if (!headers.Authorization) {
    throw new FavoritesAuthError("Sign in required.");
  }

  const url = `${API_PATH}?content_type=${encodeURIComponent(contentType)}`;
  const res = await fetch(url, { method: "GET", headers, credentials: "same-origin" });
  let body: ListResponse | null = null;
  try {
    body = (await res.json()) as ListResponse;
  } catch {
    body = null;
  }

  if (res.status === 401) {
    throw new FavoritesAuthError(body?.error || "Sign in required.");
  }
  if (!res.ok || !body?.ok) {
    throw new FavoritesApiError(body?.error || "Failed to load favorites.", res.status);
  }
  return Array.isArray(body.favorites) ? body.favorites : [];
}

export async function addFavorite(
  contentType: FavoriteContentType,
  contentId: string | number,
): Promise<FavoriteRecord> {
  const normalized = normalizeFavoriteContentId(contentId);
  if (!normalized) throw new FavoritesApiError("content_id is required.", 400);

  const headers = {
    ...(await getFavoritesAuthHeaders()),
    "Content-Type": "application/json",
  };
  if (!headers.Authorization) {
    throw new FavoritesAuthError("Sign in required.");
  }

  const res = await fetch(API_PATH, {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({ content_type: contentType, content_id: normalized }),
  });
  let body: MutateResponse | null = null;
  try {
    body = (await res.json()) as MutateResponse;
  } catch {
    body = null;
  }

  if (res.status === 401) {
    throw new FavoritesAuthError(body?.error || "Sign in required.");
  }
  if (!res.ok || !body?.ok || !body.favorite) {
    throw new FavoritesApiError(body?.error || "Failed to save favorite.", res.status);
  }
  return body.favorite;
}

export async function removeFavorite(
  contentType: FavoriteContentType,
  contentId: string | number,
): Promise<void> {
  const normalized = normalizeFavoriteContentId(contentId);
  if (!normalized) throw new FavoritesApiError("content_id is required.", 400);

  const headers = {
    ...(await getFavoritesAuthHeaders()),
    "Content-Type": "application/json",
  };
  if (!headers.Authorization) {
    throw new FavoritesAuthError("Sign in required.");
  }

  const res = await fetch(API_PATH, {
    method: "DELETE",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({ content_type: contentType, content_id: normalized }),
  });
  let body: MutateResponse | null = null;
  try {
    body = (await res.json()) as MutateResponse;
  } catch {
    body = null;
  }

  if (res.status === 401) {
    throw new FavoritesAuthError(body?.error || "Sign in required.");
  }
  if (!res.ok || !body?.ok) {
    throw new FavoritesApiError(body?.error || "Failed to remove favorite.", res.status);
  }
}

export function emitFavoritesChange(detail: FavoritesChangeDetail): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(FAVORITES_CHANGE_EVENT, { detail }));
  } catch {
    /* ignore */
  }
}

/** In-flight locks keyed by content_type + content_id. */
const inFlight = new Set<string>();

function flightKey(contentType: FavoriteContentType, contentId: string): string {
  return `${contentType}:${contentId}`;
}

/**
 * Toggle a favorite with optimistic UI support via callbacks.
 * Prevents concurrent toggles for the same item.
 */
export async function toggleFavorite(options: {
  contentType: FavoriteContentType;
  contentId: string | number;
  currentlyFavorite: boolean;
  onOptimistic?: (next: boolean) => void;
  onRollback?: (previous: boolean) => void;
  onSuccess?: (next: boolean) => void;
  onError?: (error: Error) => void;
}): Promise<boolean> {
  const contentId = normalizeFavoriteContentId(options.contentId);
  if (!contentId) {
    const err = new FavoritesApiError("content_id is required.", 400);
    options.onError?.(err);
    throw err;
  }

  const key = flightKey(options.contentType, contentId);
  if (inFlight.has(key)) {
    return options.currentlyFavorite;
  }

  const previous = options.currentlyFavorite;
  const next = !previous;
  inFlight.add(key);
  options.onOptimistic?.(next);
  emitFavoritesChange({ contentType: options.contentType, contentId, isFavorite: next });

  try {
    if (next) {
      await addFavorite(options.contentType, contentId);
    } else {
      await removeFavorite(options.contentType, contentId);
    }
    options.onSuccess?.(next);
    return next;
  } catch (error) {
    options.onRollback?.(previous);
    emitFavoritesChange({ contentType: options.contentType, contentId, isFavorite: previous });
    const err = error instanceof Error ? error : new Error(String(error));
    options.onError?.(err);
    throw err;
  } finally {
    inFlight.delete(key);
  }
}

export class FavoritesAuthError extends Error {
  readonly status = 401;
  constructor(message: string) {
    super(message);
    this.name = "FavoritesAuthError";
  }
}

export class FavoritesApiError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "FavoritesApiError";
    this.status = status;
  }
}
