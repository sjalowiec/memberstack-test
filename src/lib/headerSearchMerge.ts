/** Browser-safe merge for header search. Do not import server catalogs from here. */

import { rankSearchText } from "./searchSynonyms";

export function headerSearchUrlKey(url: string): string {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const path = /^https?:\/\//i.test(raw) ? new URL(raw).pathname : raw.split(/[?#]/)[0];
    const normalized = path.toLowerCase().replace(/\/+$/, "");
    return normalized || "/";
  } catch {
    return "";
  }
}

function byTitle<T extends { title?: string }>(a: T, b: T): number {
  return String(a.title ?? "").localeCompare(String(b.title ?? ""));
}

/** Same buckets the header badges use, so one section cannot fill a tied rank. */
function categoryKey(url: string): string {
  const path = headerSearchUrlKey(url);
  if (path.startsWith("/courses") || path.startsWith("/lessons")) return "courses";
  if (path.startsWith("/videos") || path.startsWith("/video-search") || path.startsWith("/ready-set-knit")) return "videos";
  if (path.startsWith("/tools")) return "tools";
  if (path.startsWith("/reference")) return "reference";
  if (path.startsWith("/glossary")) return "glossary";
  if (path.startsWith("/help-hub")) return "help";
  return "guide";
}

/**
 * Higher ranks come first. The same path is kept once, and the higher rank wins.
 * Within one rank, sections take turns so a long run of one type cannot hide
 * an equally relevant result from another section.
 */
export function mergeHeaderSearchResults<T extends { url: string; title?: string; rank?: number }>(
  catalog: T[],
  pagefind: T[],
  limit = 30,
): T[] {
  const best = new Map<string, T>();
  for (const item of [...catalog, ...pagefind]) {
    if ((item.rank ?? 0) <= 0) continue;
    const key = headerSearchUrlKey(item.url);
    if (!key) continue;
    const prev = best.get(key);
    if (!prev || (item.rank ?? 0) > (prev.rank ?? 0)) best.set(key, item);
  }

  const byRank = new Map<number, T[]>();
  for (const item of best.values()) {
    const rank = item.rank ?? 0;
    const group = byRank.get(rank) ?? [];
    group.push(item);
    byRank.set(rank, group);
  }

  const out: T[] = [];
  for (const rank of [...byRank.keys()].sort((a, b) => b - a)) {
    const buckets = new Map<string, T[]>();
    for (const item of byRank.get(rank) ?? []) {
      const category = categoryKey(item.url);
      const group = buckets.get(category) ?? [];
      group.push(item);
      buckets.set(category, group);
    }
    for (const group of buckets.values()) group.sort(byTitle);
    const categories = [...buckets.keys()].sort();
    let progressed = true;
    while (progressed && out.length < limit) {
      progressed = false;
      for (const category of categories) {
        if (out.length >= limit) break;
        const group = buckets.get(category);
        const next = group?.shift();
        if (!next) continue;
        out.push(next);
        progressed = true;
      }
    }
  }
  return out;
}

/** Same 4/3/2/1 scale as the catalog. A Pagefind hit that misses the full query scores 0. */
export function scorePagefindHit(query: string, title: string, excerpt: string): 0 | 1 | 2 | 3 | 4 {
  const plainExcerpt = String(excerpt || "").replace(/<[^>]+>/g, " ");
  const titleRank = rankSearchText(title, query);
  const bodyRank = rankSearchText(plainExcerpt, query);
  if (titleRank === 2) return 4;
  if (titleRank === 1) return 3;
  if (bodyRank === 2) return 2;
  if (bodyRank === 1) return 1;
  return 0;
}

export function installHeaderSearchMerge(): void {
  const target = window as Window & {
    __kinMergeHeaderSearch?: typeof mergeHeaderSearchResults;
    __kinScorePagefindHit?: typeof scorePagefindHit;
  };
  target.__kinMergeHeaderSearch = mergeHeaderSearchResults;
  target.__kinScorePagefindHit = scorePagefindHit;
}
