/**
 * Local Pattern Testing Mode.
 *
 * Unlocks Pattern Builder pages while running the Astro dev server on
 * localhost. It is not a Memberstack session and does not carry a membership
 * plan id.
 *
 * All three conditions are required:
 *  - `import.meta.env.DEV` is true (false in every production build, including
 *    kin-dev and deploy previews)
 *  - the browser hostname is `localhost` or `127.0.0.1`
 *  - `PUBLIC_ALLOW_DEV_PATTERN_USER` is not `"false"`
 *
 * Set `PUBLIC_ALLOW_DEV_PATTERN_USER=false` in `.env` and restart the dev
 * server to turn this off. Named pattern saves still use the existing Netlify
 * dev user (`ALLOW_DEV_PATTERN_USER`); this helper does not change that.
 */
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";

/**
 * Stable label for local testing. Not a Memberstack member id (`mem_…`).
 * Used so draft ownership and the access debug badge can tell this mode apart
 * from a signed-in member.
 */
export const LOCAL_PATTERN_TESTING_ID = "local-pattern-testing";

const LOCAL_PATTERN_TESTING_HOSTS = new Set(["localhost", "127.0.0.1"]);

export type LocalPatternTestingOptions = {
  /**
   * Defaults to `import.meta.env.DEV`. Tests pass `false` to simulate a
   * production build. Callers in the app omit this.
   */
  isViteDev?: boolean;
  /**
   * Defaults to `import.meta.env.PUBLIC_ALLOW_DEV_PATTERN_USER`.
   * The string `"false"` disables local pattern testing.
   */
  allowDevPatternUser?: string | null;
  /** Defaults to `window.location.hostname` in the browser. */
  hostname?: string | null;
};

function viteDevEnabled(options: LocalPatternTestingOptions): boolean {
  if (options.isViteDev !== undefined) return options.isViteDev === true;
  return typeof import.meta !== "undefined" && import.meta.env.DEV === true;
}

function allowDevPatternUserFlag(
  options: LocalPatternTestingOptions,
): string | null | undefined {
  if ("allowDevPatternUser" in options) return options.allowDevPatternUser;
  if (typeof import.meta === "undefined") return undefined;
  const value = import.meta.env.PUBLIC_ALLOW_DEV_PATTERN_USER;
  return typeof value === "string" ? value : undefined;
}

function testingHostname(options: LocalPatternTestingOptions): string {
  if (typeof options.hostname === "string") return options.hostname;
  if (typeof window === "undefined") return "";
  return window.location?.hostname ?? "";
}

/** True only for Astro dev on localhost, unless explicitly disabled. */
export function isLocalPatternTestingEnabled(
  options: LocalPatternTestingOptions = {},
): boolean {
  if (!viteDevEnabled(options)) return false;
  if (allowDevPatternUserFlag(options) === "false") return false;
  const host = testingHostname(options).trim().toLowerCase();
  return LOCAL_PATTERN_TESTING_HOSTS.has(host);
}

/**
 * Access snapshot used when local pattern testing is on.
 *
 * `loggedIn` is true only because {@link hasPatternSystemAccess} denies every
 * logged-out snapshot. `activePlanIds` is omitted on purpose: when that array
 * is present, access is recomputed from membership plan ids. Omitting it keeps
 * this mode off the real plan list.
 */
export function localPatternTestingAccess(): SleevelessUserAccess {
  return {
    loggedIn: true,
    memberId: LOCAL_PATTERN_TESTING_ID,
    hasSystemAccess: true,
    freeClaimsBySystem: {},
  };
}
