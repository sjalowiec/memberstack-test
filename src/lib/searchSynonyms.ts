/**
 * Bidirectional synonym groups for customer search.
 *
 * Searching any form finds content that uses the other forms in the same group.
 * Extra words in the query still have to match, so "latch tool cast off" does
 * not return every bind-off result.
 *
 * To extend the list, append another group. Hyphen and space are the same
 * phrase ("bind-off" and "bind off"). A joined spelling such as "bindoff"
 * is different and needs its own entry in the group. Pagefind stores the
 * hyphenated phrase as that joined word, so the joined entry is what lets a
 * spaced search find it.
 *
 * Machine model names are separate: LK150, LK-150, and LK 150 are the same
 * model, while LK150 and SK150 stay different. See machineModelSearch.ts.
 */
import { collapseMachineModels, shieldMachineModels } from "./machineModelSearch";

export const SEARCH_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  [
    "bind off",
    "binding off",
    "bind-off",
    "bindoff",
    "cast off",
    "casting off",
    "cast-off",
    "castoff",
  ],
  ["short row", "short-row", "shortrow"],
  ["short rows", "short-rows", "shortrows"],
  ["cast on", "cast-on", "caston"],
];

const DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2015-]/g;
const BETWEEN_WORDS = "[\\s\\u2010-\\u2015-]+";

type SynonymPhrase = {
  group: number;
  /** Lowercase phrase used for matching. Hyphens are already spaces. */
  normalized: string;
  /** Spelling spliced into a site-search query. */
  surface: string;
};

export type SearchQueryPlan = {
  /** What the visitor typed, plus the same phrase with hyphen and space aligned. */
  exact: string[];
  /** The other words kept in place, with each other form from the group. */
  synonym: string[];
};

type SynonymSpan = {
  start: number;
  end: number;
  group: number;
  normalized: string;
  surface: string;
};

const PHRASES: SynonymPhrase[] = compilePhrases(SEARCH_SYNONYM_GROUPS);

function compilePhrases(groups: readonly (readonly string[])[]): SynonymPhrase[] {
  const phrases: SynonymPhrase[] = [];
  const seen = new Set<string>();
  groups.forEach((forms, groupIndex) => {
    forms.forEach((form) => {
      const normalized = normalizeSearchText(form);
      if (!normalized) return;
      const key = `${groupIndex}\0${normalized}`;
      if (seen.has(key)) return;
      seen.add(key);
      phrases.push({ group: groupIndex, normalized, surface: normalized });
    });
  });
  return phrases.sort(
    (a, b) => b.normalized.length - a.normalized.length || a.normalized.localeCompare(b.normalized),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lowercase, treat hyphens as spaces, and drop other punctuation. */
export function normalizeSearchText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(DASHES, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phrasePattern(normalized: string): RegExp {
  const body = normalized.split(" ").map(escapeRegExp).join(BETWEEN_WORDS);
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(${body})(?=$|[^\\p{L}\\p{N}])`, "iu");
}

function findSynonymSpan(query: string): SynonymSpan | null {
  let best: SynonymSpan | null = null;
  for (const phrase of PHRASES) {
    const match = phrasePattern(phrase.normalized).exec(query);
    if (!match?.[1]) continue;
    const relative = match[0].lastIndexOf(match[1]);
    const start = match.index + relative;
    const end = start + match[1].length;
    const longer = best ? end - start > best.end - best.start : false;
    if (!best || start < best.start || (start === best.start && longer)) {
      best = {
        start,
        end,
        group: phrase.group,
        normalized: phrase.normalized,
        surface: phrase.surface,
      };
    }
  }
  return best;
}

function cleanQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Same Pagefind words for LK150, LK-150, and LK 150. Other punctuation stays. */
function searchQuery(value: string): string {
  return cleanQuery(collapseMachineModels(value));
}

function matchesCollapsedText(haystack: string, query: string): boolean {
  const needle = shieldMachineModels(query.toLowerCase());
  if (!needle) return false;
  return shieldMachineModels(haystack.toLowerCase()).includes(needle);
}

/**
 * Queries to send to a word search such as Pagefind.
 * The first exact query is the visitor's text, with a machine model written as one word.
 * Synonym queries keep the other words.
 */
export function buildSearchQueryPlan(raw: string): SearchQueryPlan {
  const trimmed = cleanQuery(raw);
  if (!trimmed) return { exact: [], synonym: [] };
  const span = findSynonymSpan(trimmed);
  if (!span) {
    const exact = searchQuery(trimmed);
    return exact ? { exact: [exact], synonym: [] } : { exact: [], synonym: [] };
  }

  const prefix = trimmed.slice(0, span.start);
  const suffix = trimmed.slice(span.end);
  const exact: string[] = [];
  const synonym: string[] = [];
  const seen = new Set<string>();
  const push = (list: string[], query: string) => {
    const cleaned = searchQuery(query);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) return;
    seen.add(key);
    list.push(cleaned);
  };

  push(exact, trimmed);
  push(exact, `${prefix}${span.surface}${suffix}`);
  for (const phrase of PHRASES) {
    if (phrase.group !== span.group || phrase.normalized === span.normalized) continue;
    push(synonym, `${prefix}${phrase.surface}${suffix}`);
  }
  return { exact, synonym };
}

/**
 * 2 = the visitor's own phrase is present, 1 = another form from the group, 0 = no match.
 * Queries that do not use a synonym keep ordinary case-insensitive matching.
 * A machine model still matches when only the hyphen or space differs.
 * Extra words on either side of the synonym still have to appear.
 */
export function rankSearchText(haystack: string, query: string): 0 | 1 | 2 {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) return 0;
  const collapsed = cleanQuery(trimmed);
  const span = findSynonymSpan(collapsed);
  const hay = String(haystack ?? "");
  if (!span) return matchesCollapsedText(hay, trimmed) ? 2 : 0;

  const normalizedHay = shieldMachineModels(normalizeSearchText(hay));
  const before = shieldMachineModels(normalizeSearchText(collapsed.slice(0, span.start)));
  const after = shieldMachineModels(normalizeSearchText(collapsed.slice(span.end)));
  if (before && !normalizedHay.includes(before)) return 0;
  if (after && !normalizedHay.includes(after)) return 0;
  if (normalizedHay.includes(span.normalized)) return 2;

  const synonymHit = PHRASES.some(
    (phrase) => phrase.group === span.group && normalizedHay.includes(phrase.normalized),
  );
  return synonymHit ? 1 : 0;
}

export type RankedSearchHit<T> = {
  key: string;
  item: T;
  score?: number;
};

/**
 * One result per key. Exact-tier hits stay ahead of synonym hits, then higher scores.
 */
export function mergeRankedSearchHits<T>(
  groups: Array<{ tier: 1 | 2; hits: Array<RankedSearchHit<T>> }>,
): T[] {
  const byKey = new Map<string, { item: T; tier: number; score: number }>();
  for (const group of groups) {
    for (const hit of group.hits) {
      const key = String(hit.key || "");
      if (!key) continue;
      const score = Number(hit.score) || 0;
      const prev = byKey.get(key);
      if (!prev || group.tier > prev.tier || (group.tier === prev.tier && score > prev.score)) {
        byKey.set(key, { item: hit.item, tier: group.tier, score });
      }
    }
  }
  return [...byKey.values()]
    .sort((a, b) => b.tier - a.tier || b.score - a.score)
    .map((row) => row.item);
}

type SearchSynonymWindow = Window & {
  __kinBuildSearchQueryPlan?: typeof buildSearchQueryPlan;
  __kinRankSearchText?: typeof rankSearchText;
  __kinMergeSearchHits?: typeof mergeRankedSearchHits;
};

/** Pages with an inline search box call these after the header module loads. */
export function installSearchSynonymHelpers(): void {
  if (typeof window === "undefined") return;
  const target = window as SearchSynonymWindow;
  target.__kinBuildSearchQueryPlan = buildSearchQueryPlan;
  target.__kinRankSearchText = rankSearchText;
  target.__kinMergeSearchHits = mergeRankedSearchHits;
}
