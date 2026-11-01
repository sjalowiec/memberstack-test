/**
 * Surprise Me for the Learning Library landing page.
 *
 * Eligible rows are published standalone catalog videos the visitor can watch.
 * The catalog argument is the merged live catalog (bundled file plus admin edits).
 * Course-only lesson objects, clips, drafts, and rows that cannot open a video
 * page are left out. Playback access uses the same rule as the video page.
 */

import { nextDiscoveryIndex } from "../helpHub/discovery";
import { catalogVideoIsPublic, type VideoCatalogRecord } from "../videoPublic";
import { catalogVideoPlaybackAccess } from "./catalogVideoPlaybackAccess";
import { videoContentIdKey } from "./videoPosterOverrides";

export const VIDEO_SURPRISE_SESSION_KEY = "kin-video-library-surprise";

const SHORT_DESCRIPTION_LENGTH = 220;

export type LearningLibrarySurpriseAccess = "open" | "member";

export type LearningLibrarySurpriseRef = {
  id: string;
  access: LearningLibrarySurpriseAccess;
};

export type LearningLibrarySurpriseCard = {
  content_id?: string | number;
  title?: string;
  description?: string;
  summary?: string;
  posterUrl?: string;
};

export type LearningLibrarySurpriseVideo = {
  id: string;
  title: string;
  description: string;
  posterUrl: string;
  href: string;
  access: LearningLibrarySurpriseAccess;
};

export type VideoSurpriseAccessMode = "checking" | "member" | "guest";

export type VideoSurprisePanel = "ready" | "checking" | "empty";

export type VideoSurpriseSession = {
  /** Empty when a shown video is no longer eligible but earlier picks should stay remembered. */
  currentId: string;
  seenIds: string[];
};

type CatalogRow = VideoCatalogRecord & {
  access_level?: unknown;
  isTipOfWeek?: boolean;
  tipOfWeek?: boolean;
  videoType?: unknown;
  sourceVideoId?: unknown;
  vimeo_id?: unknown;
  vimeo_id_public?: unknown;
  type?: unknown;
};

function asCatalogRow(value: unknown): CatalogRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as CatalogRow;
}

function plainText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Catalog description, shortened so the landing card stays readable. */
export function shortVideoDescription(value: unknown, maxLength = SHORT_DESCRIPTION_LENGTH): string {
  const text = plainText(value);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const space = cut.lastIndexOf(" ");
  const trimmed = (space > 80 ? cut.slice(0, space) : cut).trim();
  return `${trimmed}…`;
}

/** Same-origin video page. No autoplay parameter. */
export function learningLibraryVideoHref(contentId: string): string {
  return `/videos/${encodeURIComponent(contentId)}`;
}

export function safeVideoPosterUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw.includes("\\") || raw.includes("..")) return "";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  if (/^[a-zA-Z0-9._~-]+$/.test(raw)) return `/images/${raw}`;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return "";
  }
  return "";
}

function hasPlayableVimeo(row: CatalogRow): boolean {
  const raw = row.vimeo_id ?? row.vimeo_id_public;
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0;
  const text = String(raw ?? "").trim();
  return /^[1-9]\d*$/.test(text);
}

/** Clips belong to a parent video. Course lesson components are not catalog rows. */
function isStandaloneLearningLibraryVideo(row: CatalogRow): boolean {
  if (String(row.type ?? "").trim().toLowerCase() === "video" && !plainText(row.slug)) return false;
  const videoType = String(row.videoType ?? "").trim().toLowerCase();
  if (videoType === "clip") return false;
  if (row.sourceVideoId !== undefined && row.sourceVideoId !== null && String(row.sourceVideoId).trim() !== "") {
    return false;
  }
  return true;
}

/**
 * Published standalone Learning Library videos from the merged catalog.
 * Access is recorded here; the visitor's membership is applied later.
 */
export function learningLibrarySurpriseRefs(videos: readonly unknown[]): LearningLibrarySurpriseRef[] {
  const refs: LearningLibrarySurpriseRef[] = [];
  const seen = new Set<string>();
  for (const value of videos) {
    const row = asCatalogRow(value);
    if (!row || !catalogVideoIsPublic(row) || !isStandaloneLearningLibraryVideo(row)) continue;
    if (!hasPlayableVimeo(row)) continue;
    const id = videoContentIdKey(row.content_id);
    const title = plainText(row.title);
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    refs.push({
      id,
      access: catalogVideoPlaybackAccess(row),
    });
  }
  return refs;
}

export function assembleLearningLibrarySurpriseVideos(
  refs: readonly LearningLibrarySurpriseRef[],
  cards: readonly LearningLibrarySurpriseCard[],
): LearningLibrarySurpriseVideo[] {
  const byId = new Map<string, LearningLibrarySurpriseCard>();
  for (const card of cards) {
    const id = videoContentIdKey(card.content_id);
    if (id && !byId.has(id)) byId.set(id, card);
  }
  const videos: LearningLibrarySurpriseVideo[] = [];
  for (const ref of refs) {
    const card = byId.get(ref.id);
    if (!card) continue;
    const title = plainText(card.title);
    if (!title) continue;
    const description = shortVideoDescription(card.description || card.summary);
    videos.push({
      id: ref.id,
      title,
      description,
      posterUrl: safeVideoPosterUrl(card.posterUrl),
      href: learningLibraryVideoHref(ref.id),
      access: ref.access,
    });
  }
  return videos;
}

export function videoSurpriseAccessMode(input: {
  hasMemberAccess?: boolean | null;
  previewForceMember?: boolean | null;
}): VideoSurpriseAccessMode {
  if (input.previewForceMember === true) return "member";
  if (input.previewForceMember === false) return "guest";
  if (typeof input.hasMemberAccess !== "boolean") return "checking";
  return input.hasMemberAccess ? "member" : "guest";
}

/** Guests and unresolved visits only receive videos that play without membership. */
export function eligibleSurpriseVideos<T extends { access: LearningLibrarySurpriseAccess }>(
  videos: readonly T[],
  access: VideoSurpriseAccessMode,
): T[] {
  if (access === "member") return [...videos];
  return videos.filter((video) => video.access === "open");
}

export function videoSurprisePanel(input: {
  access: VideoSurpriseAccessMode;
  openCount: number;
  memberOnlyCount: number;
}): VideoSurprisePanel {
  const openCount = Math.max(0, input.openCount);
  const memberOnlyCount = Math.max(0, input.memberOnlyCount);
  if (input.access === "member") return openCount + memberOnlyCount > 0 ? "ready" : "empty";
  if (input.access === "guest") return openCount > 0 ? "ready" : "empty";
  if (openCount > 0) return "ready";
  if (memberOnlyCount > 0) return "checking";
  return "empty";
}

function uniqueIds(ids: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const key = id.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function rollIndex(count: number, random: () => number): number {
  if (count <= 0) return 0;
  const roll = random();
  const safe = Number.isFinite(roll) ? Math.min(0.999999, Math.max(0, roll)) : 0;
  return Math.floor(safe * count);
}

export function parseVideoSurpriseSession(raw: string | null): VideoSurpriseSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as { currentId?: unknown; seenIds?: unknown };
    const currentId = String(record.currentId ?? "").trim();
    if (!Array.isArray(record.seenIds)) return null;
    const seenIds = uniqueIds(record.seenIds.map((id) => String(id ?? "")));
    if (currentId && !seenIds.includes(currentId)) seenIds.push(currentId);
    if (!currentId && seenIds.length === 0) return null;
    return { currentId, seenIds };
  } catch {
    return null;
  }
}

export function serializeVideoSurpriseSession(session: VideoSurpriseSession): string {
  return JSON.stringify({
    currentId: session.currentId,
    seenIds: uniqueIds(session.seenIds),
  });
}

/** Drop picks the visitor can no longer watch. Remember the rest of this session. */
export function sessionForEligiblePool(
  session: VideoSurpriseSession | null,
  eligibleIds: readonly string[],
): VideoSurpriseSession | null {
  if (!session) return null;
  const allowed = new Set(uniqueIds(eligibleIds));
  const seenIds = session.seenIds.filter((id) => allowed.has(id));
  const currentId = allowed.has(session.currentId) ? session.currentId : "";
  if (!currentId && seenIds.length === 0) return null;
  if (currentId && !seenIds.includes(currentId)) seenIds.push(currentId);
  return { currentId, seenIds };
}

/** First pick. Skips videos already shown in this session until every eligible video has been shown. */
export function startSurpriseVideo(
  eligibleIds: readonly string[],
  seenIds: readonly string[] = [],
  random: () => number = Math.random,
): VideoSurpriseSession | null {
  const ids = uniqueIds(eligibleIds);
  if (ids.length === 0) return null;
  const allowed = new Set(ids);
  const seen = new Set(seenIds.filter((id) => allowed.has(id)));
  let pool = ids.filter((id) => !seen.has(id));
  const nextSeen = new Set(seen);
  if (pool.length === 0) {
    pool = ids;
    nextSeen.clear();
  }
  const id = pool[rollIndex(pool.length, random)] ?? pool[0];
  if (!id) return null;
  nextSeen.add(id);
  return { currentId: id, seenIds: ids.filter((item) => nextSeen.has(item)) };
}

/**
 * Another video. Reuses Help Hub's no-repeat rule: skip videos already shown,
 * and when the pool is exhausted start over without repeating the one on screen.
 */
export function anotherSurpriseVideo(
  eligibleIds: readonly string[],
  session: VideoSurpriseSession,
  random: () => number = Math.random,
): VideoSurpriseSession | null {
  const ids = uniqueIds(eligibleIds);
  const current = ids.indexOf(session.currentId);
  if (current < 0) return null;
  const seen = new Set<number>();
  for (const id of session.seenIds) {
    const index = ids.indexOf(id);
    if (index >= 0) seen.add(index);
  }
  seen.add(current);
  const next = nextDiscoveryIndex(ids.length, current, seen, random);
  if (!next) return null;
  const seenIds: string[] = [];
  for (const index of next.seen) {
    const id = ids[index];
    if (id && !seenIds.includes(id)) seenIds.push(id);
  }
  const currentId = ids[next.index] ?? "";
  if (!currentId) return null;
  if (!seenIds.includes(currentId)) seenIds.push(currentId);
  return { currentId, seenIds };
}
