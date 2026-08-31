/**
 * Blank Socks Builder session — `?new=1` and in-page Start over.
 */

import { SLEEVELESS_EXPRESS_NEW_SESSION_PARAM, SLEEVELESS_EXPRESS_NEW_SESSION_VALUE } from "../patternStorage";
import {
  clearSockDraftStorage,
  createEmptySockDraft,
  writeSockDraft,
  type SockDraft,
  type SockDraftUnit,
} from "./sockDraft";
import { clearSockSavedProjectIdentity } from "./sockSavedProject";

export const SOCK_BUILDER_PATH = "/patterns/socks/builder";

export const SOCK_NEW_SESSION_PARAM = SLEEVELESS_EXPRESS_NEW_SESSION_PARAM;
export const SOCK_NEW_SESSION_VALUE = SLEEVELESS_EXPRESS_NEW_SESSION_VALUE;

export function buildSockBuilderNewPatternHref(): string {
  return `${SOCK_BUILDER_PATH}?${SOCK_NEW_SESSION_PARAM}=${SOCK_NEW_SESSION_VALUE}`;
}

export function startFreshSockPattern(
  storage: Pick<Storage, "removeItem"> = typeof localStorage !== "undefined"
    ? localStorage
    : { removeItem: () => undefined },
): void {
  clearSockSavedProjectIdentity();
  clearSockDraftStorage(storage);
}

export function startOverSockBuilderSession(args: { unit: SockDraftUnit }): SockDraft {
  clearSockSavedProjectIdentity();
  const draft = createEmptySockDraft({ unit: args.unit });
  writeSockDraft(draft);
  return draft;
}

export function isSockNewSessionSearchParams(params: URLSearchParams): boolean {
  return params.get(SOCK_NEW_SESSION_PARAM) === SOCK_NEW_SESSION_VALUE;
}

export function applySockNewSessionFromUrl(
  href = typeof window !== "undefined" ? window.location.href : "",
  storage?: Pick<Storage, "removeItem">,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(href, window.location.origin);
    if (!isSockNewSessionSearchParams(url.searchParams)) return false;
    startFreshSockPattern(storage);
    url.searchParams.delete(SOCK_NEW_SESSION_PARAM);
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`);
    return true;
  } catch {
    return false;
  }
}
