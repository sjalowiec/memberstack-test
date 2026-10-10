/**
 * Set-In Sleeve testing on hosted DEV (kin-dev.netlify.app).
 *
 * Opens the Set-In Sleeve builder, pattern, and print pages without a
 * Memberstack login. Saves use one isolated development identity. Other
 * pattern builders stay on the normal membership rules.
 *
 * This cannot be turned on with an environment variable or a URL parameter.
 * The hostname and the page path are the only switches, and a production
 * hostname never matches.
 */
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";

/** Keep in sync with netlify/functions/lib/kin-dev-set-in-sleeve-testing.js */
export const KIN_DEV_SET_IN_SLEEVE_TEST_USER_ID = "kin-dev-set-in-sleeve-testing";

export const SET_IN_DEV_TEST_HEADER = "X-KBM-Set-In-Dev-Test";

const KIN_DEV_HOST = "kin-dev.netlify.app";

export function isKinDevBrowserHost(hostname: string | null | undefined): boolean {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  return host === KIN_DEV_HOST || host.endsWith(`--${KIN_DEV_HOST}`);
}

export function isSetInSleevePatternPath(pathname: string | null | undefined): boolean {
  const path = String(pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
  return path === "/patterns/set-in-sleeve" || path.startsWith("/patterns/set-in-sleeve/");
}

export type HostedSetInSleeveDevTestingOptions = {
  hostname?: string | null;
  pathname?: string | null;
};

/**
 * True only on a kin-dev host while the visitor is on a Set-In Sleeve page.
 * Does not read import.meta.env, PUBLIC_ALLOW_DEV_PATTERN_USER, or location.search.
 */
export function isHostedSetInSleeveDevTesting(
  options: HostedSetInSleeveDevTestingOptions = {},
): boolean {
  const hostname =
    options.hostname !== undefined
      ? options.hostname
      : typeof window !== "undefined"
        ? window.location?.hostname
        : "";
  const pathname =
    options.pathname !== undefined
      ? options.pathname
      : typeof window !== "undefined"
        ? window.location?.pathname
        : "";
  return isKinDevBrowserHost(hostname) && isSetInSleevePatternPath(pathname);
}

/**
 * Access snapshot for the hosted Set-In Sleeve test. No membership plan ids,
 * so this is not a real member session.
 */
export function setInSleeveDevTestingAccess(): SleevelessUserAccess {
  return {
    loggedIn: true,
    memberId: KIN_DEV_SET_IN_SLEEVE_TEST_USER_ID,
    hasSystemAccess: true,
    freeClaimsBySystem: {},
  };
}
