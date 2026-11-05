/**
 * Video admin list: favorite totals, Tip of the Week history, and full-list sort.
 *
 * Favorite counts and tip history are calculated from saved records.
 * Draft tips are ignored. Future scheduled tips stay out of the use count.
 * Matching uses the canonical KIN video id. Slugs and Vimeo ids are not guessed.
 */
import { normalizeFavoriteContentId } from "../favorites/favoriteContentTypes";
import {
  isIsoDateOnly,
  tipIsPubliclyFeatured,
  tipScheduleBucket,
} from "../tipOfTheWeek/schedule";
import type { TipOfTheWeekRecord } from "../tipOfTheWeek/types";
import { normalizeVideoCatalogStatus } from "../videoPublic";
import { compareSortValues, type SortDirection } from "../watson/sortableTable";
import { videoContentIdKey } from "./videoPosterOverrides";

/**
 * Same KIN id rule as Tip of the Week admin matching.
 * Numeric ids ignore leading zeros. Other ids match only after trimming and lowercasing.
 */
export function canonicalVideoContentId(value: string): string {
  const trimmed = String(value || "").trim();
  if (!/^\d+$/.test(trimmed)) return trimmed.toLowerCase();
  return trimmed.replace(/^0+/, "") || "0";
}

export type TipScheduleRow = Pick<
  TipOfTheWeekRecord,
  "id" | "title" | "status" | "videoContentId" | "availableFrom" | "availableThrough"
>;

export type VideoAdminTipSummary = {
  publicCount: number;
  latestStart: string | null;
  upcomingStart: string | null;
};

export type VideoAdminSortColumn =
  | "kinId"
  | "title"
  | "status"
  | "access"
  | "vimeoId"
  | "favorites"
  | "tip";

export type VideoAdminSortable = {
  kinId: string;
  title: string;
  status: string;
  access: string;
  vimeoId: string;
  /** null when favorite totals could not be loaded. */
  favoriteCount: number | null;
  /**
   * Last featured start date (YYYY-MM-DD), "" when the video was never used,
   * or null when tip history could not be loaded.
   */
  tipSortDate: string | null;
  stableKey: string;
};

export type VideoFavoriteDocument = {
  memberId: string;
  contentIds: readonly string[];
};

export type VideoAdminSourceOk<T> = { ok: true } & T;
export type VideoAdminSourceError = { ok: false; error: string };

export type VideoAdminFavoritesSource =
  | VideoAdminSourceOk<{ counts: Record<string, number>; unmatchedIds: string[] }>
  | VideoAdminSourceError;

export type VideoAdminTipsSource =
  | VideoAdminSourceOk<{ byVideo: Record<string, VideoAdminTipSummary>; unmatchedIds: string[] }>
  | VideoAdminSourceError;

export type VideoAdminPlanningPayload = {
  ok: true;
  favorites: VideoAdminFavoritesSource;
  tips: VideoAdminTipsSource;
};

const EMPTY_TIP: VideoAdminTipSummary = {
  publicCount: 0,
  latestStart: null,
  upcomingStart: null,
};

/** Short US date for a stored YYYY-MM-DD calendar day, without shifting the day. */
export function formatVideoAdminTipDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || "").trim());
  if (!match) return String(isoDate || "").trim();
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return String(isoDate).trim();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function videoAdminTipLines(summary: VideoAdminTipSummary): string[] {
  const lines: string[] = [];
  if (summary.publicCount <= 0) {
    lines.push("Never used");
  } else if (summary.publicCount === 1) {
    const last = summary.latestStart ? formatVideoAdminTipDate(summary.latestStart) : "";
    lines.push(last ? `Used once · Last: ${last}` : "Used once");
  } else {
    const last = summary.latestStart ? formatVideoAdminTipDate(summary.latestStart) : "";
    lines.push(
      last ? `Used ${summary.publicCount} times · Last: ${last}` : `Used ${summary.publicCount} times`,
    );
  }
  if (summary.upcomingStart) {
    lines.push(`Scheduled: ${formatVideoAdminTipDate(summary.upcomingStart)}`);
  }
  return lines;
}

export function videoAdminStatusLabel(raw: unknown): string {
  const status = normalizeVideoCatalogStatus(raw);
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function videoAdminAccessLabel(raw: unknown): string {
  if (raw === null || raw === undefined) return "Not set";
  const value = String(raw).trim();
  return value || "Not set";
}

export function videoAdminKinId(raw: unknown): string {
  return videoContentIdKey(raw);
}

export function catalogCanonicalIds(contentIds: readonly unknown[]): Set<string> {
  const ids = new Set<string>();
  for (const raw of contentIds) {
    const key = canonicalVideoContentId(videoAdminKinId(raw));
    if (key) ids.add(key);
  }
  return ids;
}

function sortedIds(ids: Iterable<string>): string[] {
  return [...ids].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

/**
 * Unique members per canonical KIN id.
 * Duplicate rows for the same member and video count once.
 * Ids that are not a catalog KIN id are returned unmatched and are not assigned.
 */
export function countUniqueVideoFavorites(
  documents: readonly VideoFavoriteDocument[],
  catalogIds: ReadonlySet<string>,
): { counts: Record<string, number>; unmatchedIds: string[] } {
  const users = new Map<string, Set<string>>();
  const unmatched = new Set<string>();
  for (const doc of documents) {
    const memberId = doc.memberId.trim();
    if (!memberId) continue;
    const seen = new Set<string>();
    for (const raw of doc.contentIds) {
      const normalized = normalizeFavoriteContentId(raw);
      if (!normalized) continue;
      const canonical = canonicalVideoContentId(normalized);
      if (!canonical || seen.has(canonical)) continue;
      seen.add(canonical);
      if (!catalogIds.has(canonical)) {
        unmatched.add(canonical);
        continue;
      }
      let members = users.get(canonical);
      if (!members) {
        members = new Set();
        users.set(canonical, members);
      }
      members.add(memberId);
    }
  }
  const counts: Record<string, number> = {};
  for (const [id, members] of users) counts[id] = members.size;
  return { counts, unmatchedIds: sortedIds(unmatched) };
}

/**
 * Tip history for each catalog KIN id.
 * Uses the same date, timezone bucket, and status rules as the Tip admin usage summary.
 */
export function summarizeCatalogTipHistory(
  catalogIds: readonly unknown[],
  tips: readonly TipScheduleRow[],
  todayLa: string,
): { byVideo: Record<string, VideoAdminTipSummary>; unmatchedIds: string[] } {
  const catalog = catalogCanonicalIds(catalogIds);
  const byVideo: Record<string, VideoAdminTipSummary> = {};
  const unmatched = new Set<string>();

  for (const tip of tips) {
    const raw = String(tip.videoContentId || "").trim();
    if (!raw) {
      unmatched.add("(no video id)");
      continue;
    }
    const canonical = canonicalVideoContentId(raw);
    if (!canonical || !catalog.has(canonical)) {
      unmatched.add(raw);
      continue;
    }
    const summary = byVideo[canonical] ?? {
      publicCount: 0,
      latestStart: null,
      upcomingStart: null,
    };
    applyTipToSummary(summary, tip, todayLa);
    byVideo[canonical] = summary;
  }

  for (const id of Object.keys(byVideo)) {
    const summary = byVideo[id];
    if (summary.publicCount === 0 && !summary.upcomingStart) delete byVideo[id];
  }
  return { byVideo, unmatchedIds: sortedIds(unmatched) };
}

/**
 * Published, current, and past runs count. Drafts do not.
 * A future scheduled or active tip is kept as the upcoming date and is not a past use.
 * An archived tip counts only after its end date.
 */
function applyTipToSummary(summary: VideoAdminTipSummary, tip: TipScheduleRow, todayLa: string): void {
  if (tip.status === "draft") return;
  if (tipIsPubliclyFeatured(tip, todayLa)) {
    summary.publicCount += 1;
    summary.latestStart = laterDate(summary.latestStart, tip.availableFrom);
    return;
  }
  const bucket = tipScheduleBucket(tip, todayLa);
  if (bucket === "scheduled") {
    summary.upcomingStart = earlierDate(summary.upcomingStart, tip.availableFrom);
    return;
  }
  if (bucket === "expired") {
    summary.publicCount += 1;
    summary.latestStart = laterDate(summary.latestStart, tip.availableFrom);
    return;
  }
  if (
    tip.status === "archived" &&
    isIsoDateOnly(tip.availableFrom) &&
    isIsoDateOnly(tip.availableThrough) &&
    tip.availableThrough < todayLa
  ) {
    summary.publicCount += 1;
    summary.latestStart = laterDate(summary.latestStart, tip.availableFrom);
  }
}

function laterDate(current: string | null, next: string): string | null {
  if (!isIsoDateOnly(next)) return current;
  if (!current || next > current) return next;
  return current;
}

function earlierDate(current: string | null, next: string): string | null {
  if (!isIsoDateOnly(next)) return current;
  if (!current || next < current) return next;
  return current;
}

export function tipSummaryForVideo(
  source: VideoAdminTipsSource,
  contentId: unknown,
): VideoAdminTipSummary | null {
  if (!source.ok) return null;
  const key = canonicalVideoContentId(videoAdminKinId(contentId));
  if (!key) return { ...EMPTY_TIP };
  return source.byVideo[key] ?? { ...EMPTY_TIP };
}

export function favoriteCountForVideo(
  source: VideoAdminFavoritesSource,
  contentId: unknown,
): number | null {
  if (!source.ok) return null;
  const key = canonicalVideoContentId(videoAdminKinId(contentId));
  if (!key) return 0;
  return source.counts[key] ?? 0;
}

function directed(comparison: number, direction: SortDirection): number {
  return direction === "asc" ? comparison : -comparison;
}

function compareKnownNumbers(left: number, right: number, direction: SortDirection): number {
  return directed(left - right, direction);
}

/**
 * Sort the full filtered set.
 * Never-used tips share an empty date, so they stay together.
 * Unavailable favorite or tip values stay together at the end and are not treated as zero.
 */
export function orderVideoAdminRows<T extends VideoAdminSortable>(
  rows: readonly T[],
  column: VideoAdminSortColumn,
  direction: SortDirection,
): T[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const primary = compareVideoAdminColumn(a, b, column, direction);
    if (primary !== 0) return primary;
    const kin = compareSortValues(a.kinId, b.kinId, "string");
    if (kin !== 0) return kin;
    return compareSortValues(a.stableKey, b.stableKey, "string");
  });
  return copy;
}

function compareVideoAdminColumn(
  a: VideoAdminSortable,
  b: VideoAdminSortable,
  column: VideoAdminSortColumn,
  direction: SortDirection,
): number {
  if (column === "favorites") {
    if (a.favoriteCount === null && b.favoriteCount === null) return 0;
    if (a.favoriteCount === null) return 1;
    if (b.favoriteCount === null) return -1;
    return compareKnownNumbers(a.favoriteCount, b.favoriteCount, direction);
  }
  if (column === "tip") {
    if (a.tipSortDate === null && b.tipSortDate === null) return 0;
    if (a.tipSortDate === null) return 1;
    if (b.tipSortDate === null) return -1;
    return directed(compareSortValues(a.tipSortDate, b.tipSortDate, "date"), direction);
  }
  const left =
    column === "kinId"
      ? a.kinId
      : column === "title"
        ? a.title
        : column === "status"
          ? a.status
          : column === "access"
            ? a.access
            : a.vimeoId;
  const right =
    column === "kinId"
      ? b.kinId
      : column === "title"
        ? b.title
        : column === "status"
          ? b.status
          : column === "access"
            ? b.access
            : b.vimeoId;
  return directed(compareSortValues(left, right, "string"), direction);
}

function listedIds(ids: readonly string[]): string {
  const shown = ids.slice(0, 8);
  const extra = ids.length - shown.length;
  const text = shown.join(", ");
  return extra > 0 ? `${text}, and ${extra} more` : text;
}

export function videoAdminDataNotes(payload: {
  favorites: VideoAdminFavoritesSource;
  tips: VideoAdminTipsSource;
}): string[] {
  const notes: string[] = [];
  if (!payload.favorites.ok) {
    notes.push(payload.favorites.error);
  } else if (payload.favorites.unmatchedIds.length > 0) {
    notes.push(
      `Some saved favorites use an id that is not a catalog KIN ID, so they were not counted: ${listedIds(payload.favorites.unmatchedIds)}.`,
    );
  }
  if (!payload.tips.ok) {
    if (!notes.includes(payload.tips.error)) notes.push(payload.tips.error);
  } else if (payload.tips.unmatchedIds.length > 0) {
    notes.push(
      `Some Tip of the Week records use a video id that is not a catalog KIN ID, so they were not matched: ${listedIds(payload.tips.unmatchedIds)}.`,
    );
  }
  return notes;
}
