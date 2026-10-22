/**
 * Landing-page state for one Help Hub visit.
 * Read more stores it in this tab. Browser Back and the article Back link restore it.
 * A direct article visit does not.
 */

export const HELP_HUB_LANDING_RETURN_KEY = "knititnow.helpHubLandingReturn";

export type HelpHubLandingSnapshot = {
  version: 1;
  /** Discovery tip that Read more opened. */
  slug: string;
  seenSlugs: string[];
  search: string;
  openNew: boolean;
  openFavorites: boolean;
  openCategories: string[];
  scrollY: number;
};

export type HelpHubLandingReturn = {
  snapshot: HelpHubLandingSnapshot;
  /** True until the article opened by Read more acknowledges this visit. */
  armed: boolean;
  /** Article whose Back to Help Hub link should restore the landing page. */
  returnSlug: string | null;
  /** That Back link asked the next landing load to restore. */
  consume: boolean;
};

export type HelpHubReadMoreClick = {
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

function sameSlug(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function stringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const next: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || next.includes(trimmed)) continue;
    next.push(trimmed);
    if (next.length >= limit) break;
  }
  return next;
}

export function isPlainHelpHubReadMoreClick(event: HelpHubReadMoreClick): boolean {
  if (event.button != null && event.button !== 0) return false;
  return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function createHelpHubLandingSnapshot(input: {
  slug: string;
  seenSlugs: string[];
  search: string;
  openNew: boolean;
  openFavorites?: boolean;
  openCategories: string[];
  scrollY: number;
}): HelpHubLandingSnapshot | null {
  const slug = input.slug.trim();
  if (!slug) return null;
  const scrollY = Number.isFinite(input.scrollY) ? Math.max(0, input.scrollY) : 0;
  return {
    version: 1,
    slug,
    seenSlugs: stringList([slug, ...input.seenSlugs], 200),
    search: input.search.slice(0, 500),
    openNew: input.openNew,
    openFavorites: input.openFavorites === true,
    openCategories: stringList(input.openCategories, 50),
    scrollY,
  };
}

export function createHelpHubLandingReturn(
  snapshot: HelpHubLandingSnapshot,
): HelpHubLandingReturn {
  return {
    snapshot,
    armed: true,
    returnSlug: null,
    consume: false,
  };
}

export function parseHelpHubLandingReturn(raw: string | null): HelpHubLandingReturn | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Partial<HelpHubLandingReturn> & {
      snapshot?: Partial<HelpHubLandingSnapshot>;
    };
    const snapshot = record.snapshot;
    if (!snapshot || snapshot.version !== 1 || typeof snapshot.slug !== "string") return null;
    const created = createHelpHubLandingSnapshot({
      slug: snapshot.slug,
      seenSlugs: Array.isArray(snapshot.seenSlugs) ? snapshot.seenSlugs : [],
      search: typeof snapshot.search === "string" ? snapshot.search : "",
      openNew: snapshot.openNew === true,
      openFavorites: snapshot.openFavorites === true,
      openCategories: Array.isArray(snapshot.openCategories) ? snapshot.openCategories : [],
      scrollY: typeof snapshot.scrollY === "number" ? snapshot.scrollY : 0,
    });
    if (!created) return null;
    return {
      snapshot: created,
      armed: record.armed === true,
      returnSlug: typeof record.returnSlug === "string" && record.returnSlug.trim()
        ? record.returnSlug.trim()
        : null,
      consume: record.consume === true,
    };
  } catch {
    return null;
  }
}

export function serializeHelpHubLandingReturn(value: HelpHubLandingReturn): string {
  return JSON.stringify(value);
}

/**
 * The article page acknowledges the Read more navigation.
 * A later direct visit in this tab clears the Back-link restore without erasing
 * the snapshot browser Back can still use.
 */
export function acknowledgeHelpHubArticleVisit(
  stored: HelpHubLandingReturn | null,
  articleSlug: string,
  navigationType: string,
): HelpHubLandingReturn | null {
  if (!stored || navigationType !== "navigate") return stored;
  const slug = articleSlug.trim();
  if (stored.armed && slug && sameSlug(stored.snapshot.slug, slug)) {
    return { ...stored, armed: false, returnSlug: slug, consume: false };
  }
  if (!stored.armed && !stored.returnSlug && !stored.consume) return stored;
  return { ...stored, armed: false, returnSlug: null, consume: false };
}

/** Arm the landing restore when this article was opened from Read more. */
export function consumeHelpHubArticleBack(
  stored: HelpHubLandingReturn | null,
  articleSlug: string,
): HelpHubLandingReturn | null {
  if (!stored?.returnSlug || !sameSlug(stored.returnSlug, articleSlug)) return null;
  return { ...stored, consume: true };
}

export function landingSnapshotToRestore(options: {
  stored: HelpHubLandingReturn | null;
  navigationType: string;
}): HelpHubLandingSnapshot | null {
  const stored = options.stored;
  if (!stored) return null;
  if (options.navigationType === "back_forward") return stored.snapshot;
  if (stored.consume && stored.returnSlug) return stored.snapshot;
  return null;
}
