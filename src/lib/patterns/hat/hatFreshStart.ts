/**
 * Blank hat builder session — finished-page “New Pattern” and `?new=1` deep links.
 * Mirrors sleeveless Express fresh-start: clear local draft, then land on the builder.
 */
import { SLEEVELESS_EXPRESS_NEW_SESSION_PARAM, SLEEVELESS_EXPRESS_NEW_SESSION_VALUE } from "../patternStorage";
import { clearHatDraftStorage } from "./hatDraft";

export const HAT_BUILDER_PATH = "/patterns/hat/builder";

/** Same query flag as sweater builders (`?new=1`). */
export const HAT_NEW_SESSION_PARAM = SLEEVELESS_EXPRESS_NEW_SESSION_PARAM;
export const HAT_NEW_SESSION_VALUE = SLEEVELESS_EXPRESS_NEW_SESSION_VALUE;

export function buildHatBuilderNewPatternHref(): string {
  return `${HAT_BUILDER_PATH}?${HAT_NEW_SESSION_PARAM}=${HAT_NEW_SESSION_VALUE}`;
}

export function startFreshHatPattern(
  storage: Pick<Storage, "removeItem"> = typeof localStorage !== "undefined"
    ? localStorage
    : { removeItem: () => undefined },
): void {
  clearHatDraftStorage(storage);
}

export function isHatNewSessionSearchParams(params: URLSearchParams): boolean {
  return params.get(HAT_NEW_SESSION_PARAM) === HAT_NEW_SESSION_VALUE;
}

/**
 * If `?new=1` is present, clear the hat draft and strip the flag from the address bar.
 * Call before the builder hydrates from localStorage.
 */
export function applyHatNewSessionFromUrl(
  href = typeof window !== "undefined" ? window.location.href : "",
  storage?: Pick<Storage, "removeItem">,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(href, window.location.origin);
    if (!isHatNewSessionSearchParams(url.searchParams)) return false;
    startFreshHatPattern(storage);
    url.searchParams.delete(HAT_NEW_SESSION_PARAM);
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`);
    return true;
  } catch {
    return false;
  }
}

export function navigateToFreshHatPattern(
  href = buildHatBuilderNewPatternHref(),
): void {
  if (typeof window === "undefined") return;
  window.location.assign(href);
}

/** Clear draft then navigate to the hat builder with `?new=1` (second clear on arrival). */
export function startNewHatPatternFromFinishedPage(): void {
  startFreshHatPattern();
  navigateToFreshHatPattern();
}
