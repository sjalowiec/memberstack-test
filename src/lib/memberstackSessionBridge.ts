/**
 * Memberstack's browser SDK stores the session JWT in localStorage when its API
 * host is not on this site's root domain, even with useCookies enabled. A sign-in
 * in another tab then never shows up as a cookie on the save request.
 *
 * Copy a real JWT into `_ms_cookie` on `.knititnow.com` so an already-open admin
 * form sends it on the next Save. The server still verifies that JWT and the
 * admin allowlist. Netlify Basic auth is not a session.
 */

export const MEMBERSTACK_LOCAL_STORAGE_KEY = "_ms-mid";

const SESSION_COOKIE_NAMES = [
  "_ms_cookie",
  "_ms-mid",
  "_ms_mid",
  "memberstack",
  "memberstack_access_token",
] as const;

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export function looksLikeMemberstackSessionJwt(value: string): boolean {
  const token = value.trim();
  return token.split(".").length === 3 && token.length > 20;
}

export function memberstackJwtFromCookieHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (!(SESSION_COOKIE_NAMES as readonly string[]).includes(name)) continue;
    let value = part.slice(separator + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      value = decodeURIComponent(value);
    } catch {
      /* keep the raw value */
    }
    if (looksLikeMemberstackSessionJwt(value)) return value.trim();
  }
  return null;
}

export function memberstackSessionCookieAssignment(token: string, hostname: string): string | null {
  if (!looksLikeMemberstackSessionJwt(token)) return null;
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  const encoded = encodeURIComponent(token.trim());
  const secure = host !== "localhost" && host !== "127.0.0.1";
  const onKnitItNow = host === "knititnow.com" || host.endsWith(".knititnow.com");
  const domain = onKnitItNow ? "; Domain=.knititnow.com" : "";
  return `_ms_cookie=${encoded}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax${secure ? "; Secure" : ""}${domain}`;
}

export function readStoredMemberstackJwt(storage: {
  localStorage?: { getItem(key: string): string | null } | null;
  cookie?: string | null;
}): string | null {
  try {
    const local = storage.localStorage?.getItem(MEMBERSTACK_LOCAL_STORAGE_KEY) ?? "";
    if (looksLikeMemberstackSessionJwt(local)) return local.trim();
  } catch {
    /* private mode */
  }
  return memberstackJwtFromCookieHeader(storage.cookie);
}

export function publishMemberstackSessionCookie(
  token: string,
  options: {
    hostname: string;
    existingCookie?: string | null;
    setCookie: (value: string) => void;
  },
): boolean {
  if (!looksLikeMemberstackSessionJwt(token)) return false;
  const trimmed = token.trim();
  if (memberstackJwtFromCookieHeader(options.existingCookie) === trimmed) return false;
  const assignment = memberstackSessionCookieAssignment(trimmed, options.hostname);
  if (!assignment) return false;
  options.setCookie(assignment);
  return true;
}

export function publishBrowserMemberstackSessionCookie(token?: string | null): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  try {
    const resolved =
      (token && looksLikeMemberstackSessionJwt(token) ? token.trim() : null) ||
      readStoredMemberstackJwt({
        localStorage: window.localStorage,
        cookie: document.cookie,
      });
    if (!resolved) return;
    publishMemberstackSessionCookie(resolved, {
      hostname: window.location.hostname,
      existingCookie: document.cookie,
      setCookie: (value) => {
        document.cookie = value;
      },
    });
  } catch {
    /* storage blocked */
  }
}

const BRIDGE_FLAG = "__kbmMemberstackSessionBridge";

export function installMemberstackSessionBridge(target: Window = window): void {
  const marked = target as Window & { [BRIDGE_FLAG]?: boolean };
  if (marked[BRIDGE_FLAG]) return;
  marked[BRIDGE_FLAG] = true;

  const publish = () => publishBrowserMemberstackSessionCookie();
  publish();
  target.addEventListener("storage", publish);
  target.addEventListener("focus", publish);
  target.addEventListener("pageshow", publish);
  const ready = target.$memberstackDom?.onReady;
  if (ready && typeof ready.then === "function") {
    void ready.then(publish).catch(() => undefined);
  }
}
