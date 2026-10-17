import { MEMBERSTACK_JWT_COOKIE_NAMES } from "../admin/requireAdminRequest";
import { isAllowDevPatternUser } from "../../../netlify/functions/lib/custom-pattern-projects-store.js";

const LOCAL_PREVIEW_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export type LocalDevPreviewAuthOptions = {
  /** Defaults to `import.meta.env.DEV`. False in every hosted build, including kin-dev. */
  isViteDev?: boolean;
  /** Defaults to the existing `ALLOW_DEV_PATTERN_USER` check. False in production deploys. */
  allowDevPatternUser?: boolean;
};

/**
 * Local Help Hub preview only.
 *
 * Uses the existing no-token dev admin identity. A Memberstack cookie or bearer
 * token is ignored so a signed-in non-admin can still see Visitor and Member
 * previews. This does not read the query string. Hosted builds fail the dev
 * check before the host or the allow flag is considered.
 */
export function isLocalDevHelpHubPreviewBypass(
  request: Request,
  options: LocalDevPreviewAuthOptions = {},
): boolean {
  const isViteDev = options.isViteDev ?? import.meta.env.DEV === true;
  if (!isViteDev) return false;
  const allowDevPatternUser = options.allowDevPatternUser ?? isAllowDevPatternUser();
  if (!allowDevPatternUser) return false;
  let hostname = "";
  try {
    hostname = new URL(request.url).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return false;
  }
  if (hostname === "::1") return true;
  return LOCAL_PREVIEW_HOSTS.has(hostname);
}

function cookieHeaderWithoutMemberstack(cookieHeader: string): string {
  const kept = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      const separator = part.indexOf("=");
      const name = (separator === -1 ? part : part.slice(0, separator)).trim();
      return !(MEMBERSTACK_JWT_COOKIE_NAMES as readonly string[]).includes(name);
    });
  return kept.join("; ");
}

/**
 * Request `requireAdminForRequest` should see for a Help Hub preview.
 * On a local dev bypass, Memberstack credentials are removed and the cookie
 * store must be ignored. Everywhere else the original request is unchanged.
 * The original body is not read.
 */
export function helpHubPreviewAuthRequest(
  request: Request,
  options: LocalDevPreviewAuthOptions = {},
): { request: Request; ignoreCookieStore: boolean } {
  if (!isLocalDevHelpHubPreviewBypass(request, options)) {
    return { request, ignoreCookieStore: false };
  }
  const headers = new Headers(request.headers);
  headers.delete("authorization");
  headers.delete("x-kin-member-token");
  const cookie = headers.get("cookie");
  if (cookie) {
    const kept = cookieHeaderWithoutMemberstack(cookie);
    if (kept) headers.set("cookie", kept);
    else headers.delete("cookie");
  }
  return {
    request: new Request(request.url, { method: request.method, headers }),
    ignoreCookieStore: true,
  };
}
