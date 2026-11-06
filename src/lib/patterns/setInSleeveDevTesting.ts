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

/**
 * Kin-dev copy of one saved Drop Shoulder project. Not the member's production id.
 * The pattern page and print page open only when the URL names this id.
 */
export const KIN_DEV_MEASUREMENT_COPY_PROJECT_ID = "e7a41c2d-8b60-4f1a-9c55-3d6b0a91f4e2";

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
  search?: string | null;
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

function pageSearch(options: HostedSetInSleeveDevTestingOptions): string {
  if (options.search !== undefined) return options.search ?? "";
  return typeof window !== "undefined" ? window.location?.search ?? "" : "";
}

function normalizedPath(pathname: string | null | undefined): string {
  return String(pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
}

/**
 * True only on kin-dev, on the sleeveless pattern or print page, for the
 * measurement-copy project. Other sleeveless pages stay membership-gated.
 * A production hostname never matches.
 */
export function isHostedMeasurementCopyDevTesting(
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
  const path = normalizedPath(pathname);
  if (path !== "/patterns/sleeveless/pattern" && path !== "/patterns/sleeveless/print") return false;
  if (!isKinDevBrowserHost(hostname)) return false;
  const projectId = new URLSearchParams(pageSearch(options)).get("project")?.trim();
  return projectId === KIN_DEV_MEASUREMENT_COPY_PROJECT_ID;
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

/**
 * Draft-owner id for hosted Set-In Sleeve testing.
 * A signed-in Memberstack member on kin-dev must not be treated as a different
 * owner of this draft — that clears the selected size and the loaded pattern.
 * Returns null everywhere else so production membership ownership is unchanged.
 */
export function hostedSetInSleeveDraftOwnerId(
  options?: HostedSetInSleeveDevTestingOptions,
): string | null {
  return isHostedSetInSleeveDevTesting(options) || isHostedMeasurementCopyDevTesting(options)
    ? KIN_DEV_SET_IN_SLEEVE_TEST_USER_ID
    : null;
}
