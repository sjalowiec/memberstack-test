/**
 * Header-search catalog for content that Pagefind cannot see.
 *
 * Videos, glossary entries, and Help Hub tips are rendered on request, so they
 * are not in the Pagefind index. This module reads the same public catalogs
 * those sections already use. A saved glossary or Help Hub edit is included on
 * the next search after a short in-memory cache (no site rebuild). A published
 * video is included when the video catalog file is loaded by the server (a
 * deploy, or a dev-server reload). Pagefind results for prerendered pages
 * still update only after `pagefind --site dist`.
 */
import videosPublic from "../data/videos-public.json";
import { stripHtmlToText } from "./helpHubFaqSchema";
import { loadPublicHelpHubCategories } from "./helpHub/loadCategories";
import { loadPublicHelpHubTips } from "./helpHub/loadTips";
import type { HelpHubManagedCategory } from "./helpHub/categoryTypes";
import {
  filterPublicHelpHubTips,
  helpHubTipSearchText,
  type HelpHubTipRecord,
} from "./helpHubPublic";
import { loadPublicGlossaryEntries } from "./glossary/loadGlossaryEntries";
import { headerSearchUrlKey } from "./headerSearchMerge";
import { slugify } from "./slugify";
import { rankSearchText } from "./searchSynonyms";
import { filterPublicCatalogVideos, type VideoCatalogRecord } from "./videoPublic";

export { headerSearchUrlKey, mergeHeaderSearchResults } from "./headerSearchMerge";

export type HeaderSearchCategory = "videos" | "glossary" | "help";

export type HeaderSearchHit = {
  url: string;
  title: string;
  excerpt: string;
  cat: HeaderSearchCategory;
  /** 4 title exact, 3 title synonym, 2 body exact, 1 body synonym. */
  rank: number;
};

type HeaderSearchRecord = {
  url: string;
  title: string;
  titleText: string;
  bodyText: string;
  excerpt: string;
  cat: HeaderSearchCategory;
};

const CATALOG_CACHE_MS = 15_000;
const SEARCH_LIMIT = 40;

let catalogCache: { at: number; records: HeaderSearchRecord[] } | null = null;

export function resetHeaderSearchCatalogCache(): void {
  catalogCache = null;
}

function plain(value: unknown): string {
  return stripHtmlToText(value).replace(/\s+/g, " ").trim();
}

function excerptFrom(parts: unknown[]): string {
  const text = parts.map(plain).filter(Boolean).join(" ");
  if (text.length <= 160) return text;
  const clipped = text.slice(0, 157).replace(/\s+\S*$/, "").trim();
  return `${clipped || text.slice(0, 157).trim()}…`;
}

function glossaryFlag(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

/** Active public glossary rows, using the same visibility rules as `/glossary`. */
export function glossaryHeaderRecords(entries: unknown[]): HeaderSearchRecord[] {
  const records: HeaderSearchRecord[] = [];
  const seen = new Set<string>();
  const rows = entries
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .filter((entry) => entry.active === true)
    .filter((entry) => !glossaryFlag(entry.dak) && !glossaryFlag(entry.dak9))
    .map((entry) => ({
      entry,
      english: plain(entry.english ?? entry.English),
    }))
    .filter((row) => row.english.length > 0)
    .sort((a, b) => a.english.localeCompare(b.english));

  for (const row of rows) {
    const slug = slugify(row.english);
    if (!slug) continue;
    const url = `/glossary/${slug}/`;
    const key = headerSearchUrlKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    const alt = plain(row.entry.alt);
    records.push({
      url,
      title: row.english,
      titleText: [row.english, alt].filter(Boolean).join(" "),
      bodyText: [plain(row.entry.example), plain(row.entry.notes), plain(row.entry.helpinfo ?? row.entry.helpInfo ?? row.entry.Helpinfo)].filter(Boolean).join(" "),
      excerpt: excerptFrom([row.entry.example, row.entry.helpinfo ?? row.entry.helpInfo ?? row.entry.Helpinfo]),
      cat: "glossary",
    });
  }
  return records;
}

/** Published catalog videos. Playback access stays on the video page. */
export function videoHeaderRecords(videos: VideoCatalogRecord[]): HeaderSearchRecord[] {
  const records: HeaderSearchRecord[] = [];
  const seen = new Set<string>();
  for (const video of filterPublicCatalogVideos(videos)) {
    const title = plain(video.title);
    const contentId = video.content_id != null ? String(video.content_id).trim() : "";
    const slug = typeof video.slug === "string" ? video.slug.trim() : "";
    const url = contentId ? `/videos/${contentId}` : slug ? `/videos/${slug}` : "";
    const key = headerSearchUrlKey(url);
    if (!title || !key || seen.has(key)) continue;
    seen.add(key);
    records.push({
      url,
      title,
      titleText: title,
      bodyText: [plain(video.description), plain(video.summary)].filter(Boolean).join(" "),
      excerpt: excerptFrom([video.description, video.summary]),
      cat: "videos",
    });
  }
  return records;
}

/** Published Help Hub tips. The visible title is the public question when one is stored. */
export function helpHubHeaderRecords(
  tips: HelpHubTipRecord[],
  categories: HelpHubManagedCategory[] = [],
): HeaderSearchRecord[] {
  const records: HeaderSearchRecord[] = [];
  const seen = new Set<string>();
  for (const tip of filterPublicHelpHubTips(tips)) {
    const slug = typeof tip.slug === "string" ? tip.slug.trim() : "";
    const question = plain(tip.question);
    const storedTitle = plain(tip.title);
    const title = question || storedTitle;
    const url = slug ? `/help-hub/${slug}` : "";
    const key = headerSearchUrlKey(url);
    if (!title || !key || seen.has(key)) continue;
    seen.add(key);
    const body = helpHubTipSearchText(tip, categories);
    records.push({
      url,
      title,
      titleText: [question, storedTitle].filter(Boolean).join(" "),
      bodyText: body,
      excerpt: excerptFrom([tip.bubbleAnswer, tip.hook, tip.metaDescription]),
      cat: "help",
    });
  }
  return records;
}

function matchRank(titleText: string, bodyText: string, query: string): number {
  const titleRank = rankSearchText(titleText, query);
  if (titleRank > 0) return titleRank + 2;
  return rankSearchText(bodyText, query);
}

function byRankThenTitle<T extends { title?: string; rank?: number }>(a: T, b: T): number {
  const rank = (b.rank ?? 0) - (a.rank ?? 0);
  if (rank !== 0) return rank;
  return String(a.title ?? "").localeCompare(String(b.title ?? ""));
}

export function searchHeaderCatalog(
  records: HeaderSearchRecord[],
  query: string,
  limit = SEARCH_LIMIT,
): HeaderSearchHit[] {
  const trimmed = query.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return [];
  const hits: HeaderSearchHit[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const rank = matchRank(record.titleText, record.bodyText, trimmed);
    if (rank <= 0) continue;
    const key = headerSearchUrlKey(record.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    hits.push({
      url: record.url,
      title: record.title,
      excerpt: record.excerpt,
      cat: record.cat,
      rank,
    });
  }
  hits.sort(byRankThenTitle);
  return hits.slice(0, limit);
}

async function loadGlossaryRecords(): Promise<HeaderSearchRecord[]> {
  try {
    return glossaryHeaderRecords(await loadPublicGlossaryEntries());
  } catch (error) {
    console.error("Header search could not load glossary entries.", error);
    return [];
  }
}

async function loadHelpRecords(): Promise<HeaderSearchRecord[]> {
  try {
    const tips = await loadPublicHelpHubTips();
    let categories: HelpHubManagedCategory[] = [];
    try {
      categories = await loadPublicHelpHubCategories();
    } catch {
      categories = [];
    }
    return helpHubHeaderRecords(tips as HelpHubTipRecord[], categories);
  } catch (error) {
    console.error("Header search could not load Help Hub tips.", error);
    return [];
  }
}

export async function loadHeaderSearchRecords(): Promise<HeaderSearchRecord[]> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.at < CATALOG_CACHE_MS) return catalogCache.records;
  const videos = videoHeaderRecords(
    (Array.isArray(videosPublic) ? videosPublic : []) as VideoCatalogRecord[],
  );
  const [glossary, help] = await Promise.all([loadGlossaryRecords(), loadHelpRecords()]);
  const records = [...videos, ...glossary, ...help];
  catalogCache = { at: now, records };
  return records;
}
