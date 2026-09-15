/**
 * Practice-page return link (`Back to Skill Builders`).
 *
 * Uses `history.back()` only when the previous same-origin document was the
 * Skill Builders catalog, matching the Videos watch-page helper without
 * following unrelated history.
 */

export const SKILL_BUILDERS_PRACTICE_BACK_LINK_SELECTOR = ".back-to-skill-builders-link";
export const SKILL_BUILDERS_CATALOG_PATH = "/learn/skill-builders";

function pathnameWithoutTrailingSlash(pathname: string): string {
  const trimmed = String(pathname || "").replace(/\/+$/, "");
  return trimmed || "/";
}

/** True for `/learn/skill-builders` or `/learn/skill-builders/`, not a practice page. */
export function isSkillBuildersCatalogPath(pathname: string): boolean {
  return pathnameWithoutTrailingSlash(pathname) === SKILL_BUILDERS_CATALOG_PATH;
}

export function isSkillBuildersCatalogReferrer(
  referrer: string,
  currentOrigin: string,
): boolean {
  const raw = String(referrer || "").trim();
  if (!raw || !currentOrigin) return false;
  try {
    const url = new URL(raw, currentOrigin);
    if (url.origin !== currentOrigin) return false;
    return isSkillBuildersCatalogPath(url.pathname);
  } catch {
    return false;
  }
}

export type SkillBuilderPracticeBackHistoryInput = {
  referrer: string;
  historyLength: number;
  currentOrigin: string;
};

/**
 * Use browser Back only when this tab can return to the Skill Builders catalog.
 * New tabs, pasted URLs, and unrelated referrers keep the catalog href.
 */
export function shouldUseSkillBuildersCatalogHistoryBack(
  opts: SkillBuilderPracticeBackHistoryInput,
): boolean {
  if (!Number.isFinite(opts.historyLength) || opts.historyLength <= 1) {
    return false;
  }
  return isSkillBuildersCatalogReferrer(opts.referrer, opts.currentOrigin);
}

export function isUnmodifiedPrimaryClick(event: {
  defaultPrevented?: boolean;
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}): boolean {
  if (event.defaultPrevented) return false;
  if ((event.button ?? 0) !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  return true;
}

export type SkillBuilderPracticeBackClickEvent = {
  preventDefault(): void;
  defaultPrevented?: boolean;
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

/** @returns true when history.back() ran instead of following href. */
export function handleSkillBuilderPracticeBackLinkClick(
  event: SkillBuilderPracticeBackClickEvent,
  opts: SkillBuilderPracticeBackHistoryInput & { back: () => void },
): boolean {
  if (!isUnmodifiedPrimaryClick(event)) return false;
  if (!shouldUseSkillBuildersCatalogHistoryBack(opts)) return false;
  event.preventDefault();
  opts.back();
  return true;
}

export type SkillBuilderPracticeBackLinkElement = {
  href: string;
  addEventListener(
    type: "click",
    listener: (event: SkillBuilderPracticeBackClickEvent) => void,
  ): void;
};

export type BindSkillBuilderPracticeBackLinksOptions = {
  links:
    | Iterable<SkillBuilderPracticeBackLinkElement>
    | ArrayLike<SkillBuilderPracticeBackLinkElement>;
  referrer: string;
  historyLength: number;
  currentOrigin: string;
  back: () => void;
};

export function bindSkillBuilderPracticeBackLinks(
  opts: BindSkillBuilderPracticeBackLinksOptions,
): string {
  const href = SKILL_BUILDERS_CATALOG_PATH;
  const historyInput: SkillBuilderPracticeBackHistoryInput = {
    referrer: opts.referrer,
    historyLength: opts.historyLength,
    currentOrigin: opts.currentOrigin,
  };

  for (const el of Array.from(opts.links as ArrayLike<SkillBuilderPracticeBackLinkElement>)) {
    el.href = href;
    el.addEventListener("click", (event) => {
      handleSkillBuilderPracticeBackLinkClick(event, {
        ...historyInput,
        back: opts.back,
      });
    });
  }

  return href;
}
