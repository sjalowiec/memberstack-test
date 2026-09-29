/**
 * Pure helpers for public search tracking.
 * Terms are trimmed and lowercased for reporting. Obvious personal information
 * is never returned as a reportable term.
 */

export const SEARCH_TERM_MAX_LENGTH = 80;
export const SEARCH_RESULT_COUNT_MAX = 100_000;

export const SEARCH_TRACKING_START_NOTE =
  "This report starts when search tracking is deployed. Searches from before that were not recorded.";

/**
 * How long the query must stay unchanged, after the on-screen results match
 * those words, before it is recorded. Enter records the current results
 * immediately and does not wait for this pause.
 */
export const SEARCH_COMMIT_IDLE_MS = 2000;

export const SEARCH_SETTLE_NOTE =
  "A search is counted when it settles: the visitor stops changing the words for 2 seconds after the results on the page match those words, or they press Enter. Letters still being typed are not counted. Opening search, reloading a page that already has the words in the address, and clicking a result are not counted.";

export type SearchActivityArea = "global" | "video";
export type SearchActivityIdentity = "member" | "guest" | "unknown";
export type SearchActivityEnvironment = "production" | "dev";

export type SearchActivityEvent = {
  id: string;
  createdAt: string;
  area: SearchActivityArea;
  /** Present only when the term is safe to report. */
  term?: string;
  termOmitted?: "personal";
  resultCount: number;
  identity: SearchActivityIdentity;
  memberId?: string;
  environment: SearchActivityEnvironment;
};

const EMAIL_IN_TEXT = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const MEMBER_ID = /^mem_(?:sb_)?[a-z0-9]+$/i;

/** Collapse whitespace and lowercase. Empty when nothing remains. */
export function normalizeSearchTerm(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ").toLowerCase().slice(0, SEARCH_TERM_MAX_LENGTH);
}

/**
 * True when the text is or contains an email, a long phone-like number,
 * or a member id. Knitting terms such as "lk150" stay reportable.
 */
export function containsPersonalInformation(text: string): boolean {
  const value = text.trim().toLowerCase();
  if (!value) return false;
  if (value.includes("@")) return true;
  if (EMAIL_IN_TEXT.test(value)) return true;
  if (MEMBER_ID.test(value)) return true;
  const compact = value.replace(/[\s().+-]/g, "");
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length >= compact.length - 2) return true;
  return false;
}

export function classifySearchTerm(
  raw: unknown,
): { empty: true } | { empty: false; term: string; omit: boolean } {
  if (typeof raw !== "string" || !raw.trim()) return { empty: true };
  const full = raw.trim().replace(/\s+/g, " ").toLowerCase();
  if (!full) return { empty: true };
  const omit = containsPersonalInformation(full);
  return { empty: false, term: full.slice(0, SEARCH_TERM_MAX_LENGTH), omit };
}

export function isSearchActivityArea(value: unknown): value is SearchActivityArea {
  return value === "global" || value === "video";
}

export function cleanResultCount(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(SEARCH_RESULT_COUNT_MAX, Math.floor(n));
}

const PRODUCTION_SITE_ID = "7a6a8dde-c0a0-4a21-960d-dff3f0ba358b";

function hostnameFrom(value: string | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).hostname.trim().toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Site that received the search. Kin-dev stays "dev" even when Netlify sets
 * CONTEXT=production for that site's own deploys. Local astro is "dev".
 */
export function resolveSearchActivityEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): SearchActivityEnvironment {
  const siteName = String(env.SITE_NAME || "").trim().toLowerCase();
  const siteId = String(env.SITE_ID || "").trim().toLowerCase();
  const host = hostnameFrom(env.URL || env.DEPLOY_PRIME_URL);
  if (
    siteName === "kin-dev" ||
    siteId === "3196ab5e-c5a1-4cd4-a13a-980523087e9a" ||
    host === "kin-dev.netlify.app"
  ) {
    return "dev";
  }
  if (
    host === "knititnow.com" ||
    host === "www.knititnow.com" ||
    siteName === "knititnow" ||
    siteId === PRODUCTION_SITE_ID
  ) {
    return "production";
  }
  if (String(env.ALLOW_DEV_PATTERN_USER || "").trim() === "true") return "dev";
  if (String(env.CONTEXT || "").trim().toLowerCase() === "production") return "production";
  return "dev";
}

export function resolveStoredIdentity(input: {
  verifiedMemberId?: string | null;
  clientIdentity?: unknown;
}): { identity: SearchActivityIdentity; memberId?: string } {
  const memberId = String(input.verifiedMemberId || "").trim();
  if (MEMBER_ID.test(memberId)) return { identity: "member", memberId };
  if (input.clientIdentity === "guest") return { identity: "guest" };
  return { identity: "unknown" };
}

export type SearchTermRow = {
  term: string;
  area: SearchActivityArea;
  count: number;
};

export type SearchActivitySummary = {
  commonTerms: SearchTermRow[];
  zeroResultTerms: SearchTermRow[];
  omittedPersonal: number;
  searched: number;
  earliestDay: string | null;
};

function dayOf(createdAt: string): string {
  return createdAt.slice(0, 10);
}

export function eventInRange(
  createdAt: string,
  from?: string,
  to?: string,
): boolean {
  const day = dayOf(createdAt);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function summarizeSearchActivity(
  events: SearchActivityEvent[],
  options: { area?: SearchActivityArea | "all"; from?: string; to?: string; limit?: number } = {},
): SearchActivitySummary {
  const area = options.area && options.area !== "all" ? options.area : null;
  const limit = options.limit ?? 25;
  const common = new Map<string, SearchTermRow>();
  const zeros = new Map<string, SearchTermRow>();
  let omittedPersonal = 0;
  let searched = 0;
  let earliestDay: string | null = null;

  for (const event of events) {
    if (area && event.area !== area) continue;
    if (!eventInRange(event.createdAt, options.from, options.to)) continue;
    searched += 1;
    const day = dayOf(event.createdAt);
    if (!earliestDay || day < earliestDay) earliestDay = day;
    if (!event.term || event.termOmitted === "personal") {
      if (event.termOmitted === "personal") omittedPersonal += 1;
      continue;
    }
    const key = `${event.area}\0${event.term}`;
    const commonRow = common.get(key) ?? { term: event.term, area: event.area, count: 0 };
    commonRow.count += 1;
    common.set(key, commonRow);
    if (event.resultCount === 0) {
      const zeroRow = zeros.get(key) ?? { term: event.term, area: event.area, count: 0 };
      zeroRow.count += 1;
      zeros.set(key, zeroRow);
    }
  }

  const sortRows = (rows: SearchTermRow[]) =>
    rows
      .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term) || a.area.localeCompare(b.area))
      .slice(0, limit);

  return {
    commonTerms: sortRows([...common.values()]),
    zeroResultTerms: sortRows([...zeros.values()]),
    omittedPersonal,
    searched,
    earliestDay,
  };
}

export function dateRangeForSearchPreset(
  preset: string,
  now = new Date(),
): { from?: string; to?: string } {
  const to = now.toISOString().slice(0, 10);
  if (preset === "today") return { from: to, to };
  if (preset === "week") {
    const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    return { from: start.toISOString().slice(0, 10), to };
  }
  if (preset === "month") {
    const start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    return { from: start.toISOString().slice(0, 10), to };
  }
  return {};
}
