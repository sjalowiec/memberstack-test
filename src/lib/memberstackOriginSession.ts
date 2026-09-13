/**
 * After switching Memberstack to `.knititnow.com` cookies, each subdomain can
 * still keep an older origin-scoped session in localStorage or a host-only
 * `_ms-mid` cookie. That leftover wins on the next visit, so www and courses
 * can show different logged-in members.
 *
 * Run this before the Memberstack CDN script so the shared root cookie is the
 * only session Memberstack can restore.
 */

export const MEMBERSTACK_COOKIE_NAMES = ["_ms-mid", "_ms_mid", "_ms_cookie"] as const;

export const MEMBERSTACK_STORAGE_KEY_RE = /^(?:_?ms[-_]|memberstack)/i;

export type MemberstackOriginSessionScope = {
  hostname: string;
  setCookie: (value: string) => void;
  localStorage?: Pick<Storage, "key" | "length" | "removeItem"> | null;
  sessionStorage?: Pick<Storage, "key" | "length" | "removeItem"> | null;
};

export function isKnitItNowHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  return host === "knititnow.com" || host.endsWith(".knititnow.com");
}

export function expireHostOnlyCookie(name: string): string {
  return `${name}=; Max-Age=0; Path=/`;
}

export function shouldClearMemberstackStorageKey(key: string): boolean {
  return MEMBERSTACK_STORAGE_KEY_RE.test(key);
}

function clearMatchingStorage(
  storage: Pick<Storage, "key" | "length" | "removeItem"> | null | undefined,
): void {
  if (!storage) return;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && shouldClearMemberstackStorageKey(key)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

export function prepareMemberstackRootCookieSession(
  scope: MemberstackOriginSessionScope,
): boolean {
  if (!isKnitItNowHost(scope.hostname)) return false;

  for (const name of MEMBERSTACK_COOKIE_NAMES) {
    scope.setCookie(expireHostOnlyCookie(name));
  }
  clearMatchingStorage(scope.localStorage);
  clearMatchingStorage(scope.sessionStorage);
  return true;
}
