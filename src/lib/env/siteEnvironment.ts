/**
 * Environment + Memberstack-mode detection for the orientation banner,
 * the header account indicator, and the admin Environment Status card.
 *
 * Pure functions so they can be unit tested and reused from both Astro
 * server frontmatter (SSR) and client scripts.
 */

export type SiteEnvironment = "localhost" | "dev" | "production";

export type MemberstackMode = "test" | "live" | "unknown";

export interface DetectSiteEnvironmentOptions {
  /** Value of `import.meta.env.PUBLIC_SITE_ENV` (authoritative when set). */
  publicSiteEnv?: string | null;
  /** Value of `import.meta.env.DEV` (true while running the local dev server). */
  isViteDev?: boolean;
}

const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

/** Apex + www domains that are the live, member-facing production site. */
const PRODUCTION_HOSTNAMES = new Set([
  "knititnow.com",
  "www.knititnow.com",
  "knitbymachine.com",
  "www.knitbymachine.com",
]);

function normalizeHost(hostname: string | null | undefined): string {
  return (hostname || "").trim().toLowerCase();
}

/**
 * Decide which environment a request/page is running in.
 *
 * Order of precedence (most reliable first):
 *  1. Local dev server (`import.meta.env.DEV`) or a localhost-style hostname.
 *  2. Any `*.netlify.app` host (deploy previews, branch deploys, the kin-dev
 *     site, etc.) is treated as `dev` — the real production site is served from
 *     a custom domain, never the raw netlify.app host.
 *  3. Known production (custom-domain) hostnames.
 *  4. Explicit `PUBLIC_SITE_ENV` configuration.
 *  5. Fallback: anything else (unknown hosts) is treated as `dev` so the banner
 *     fails *visible*, never hiding accidentally on a non-production box.
 */
export function detectSiteEnvironment(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
): SiteEnvironment {
  const host = normalizeHost(hostname);

  if (options.isViteDev === true) return "localhost";
  if (LOCAL_HOSTNAMES.has(host) || host.endsWith(".local")) return "localhost";

  if (host.endsWith(".netlify.app") || host === "netlify.app") return "dev";

  if (PRODUCTION_HOSTNAMES.has(host)) return "production";

  const configured = (options.publicSiteEnv || "").trim().toLowerCase();
  if (configured === "production" || configured === "prod") return "production";
  if (configured === "dev" || configured === "development" || configured === "staging") {
    return "dev";
  }

  return "dev";
}

/** Human-facing label for the banner / admin card. */
export function siteEnvironmentLabel(env: SiteEnvironment): string {
  switch (env) {
    case "localhost":
      return "LOCALHOST";
    case "dev":
      return "DEV";
    case "production":
      return "PRODUCTION";
  }
}

/** Whether the orientation banner should be shown for this environment. */
export function shouldShowEnvironmentBanner(env: SiteEnvironment): boolean {
  return env !== "production";
}

/**
 * Best-effort attempt to read whether Memberstack is running in TEST or LIVE
 * mode from the loaded `$memberstackDom` instance.
 *
 * Memberstack v2's DOM package does not expose a documented public API for the
 * current mode, so this probes the most likely internal fields and the public
 * key shape. When nothing conclusive is found it returns `"unknown"` (which the
 * UI is expected to surface as "UNKNOWN").
 */
export function detectMemberstackMode(win: unknown): MemberstackMode {
  try {
    const w = win as Record<string, any> | undefined | null;
    const ms = w?.$memberstackDom ?? w?.$memberstack ?? null;
    if (!ms) return "unknown";

    const stringCandidates: unknown[] = [
      ms?._app?.mode,
      ms?.app?.mode,
      ms?._config?.mode,
      ms?.config?.mode,
      ms?.mode,
    ];
    for (const candidate of stringCandidates) {
      const mode = classifyModeString(candidate);
      if (mode !== "unknown") return mode;
    }

    const boolCandidates: unknown[] = [
      ms?._app?.testMode,
      ms?._app?.test,
      ms?.testMode,
      ms?.test,
    ];
    for (const candidate of boolCandidates) {
      if (typeof candidate === "boolean") return candidate ? "test" : "live";
    }

    const keyCandidates: unknown[] = [
      ms?._app?.publicKey,
      ms?.publicKey,
      ms?._config?.publicKey,
      ms?.config?.publicKey,
    ];
    for (const candidate of keyCandidates) {
      const mode = classifyModeString(candidate);
      if (mode !== "unknown") return mode;
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

function classifyModeString(value: unknown): MemberstackMode {
  if (typeof value !== "string") return "unknown";
  const v = value.toLowerCase();
  if (!v) return "unknown";
  if (v.includes("test") || v.includes("sandbox") || v.startsWith("pk_test")) {
    return "test";
  }
  if (v.includes("live") || v.includes("prod") || v.startsWith("pk_live")) {
    return "live";
  }
  return "unknown";
}

export function memberstackModeLabel(mode: MemberstackMode): string {
  switch (mode) {
    case "test":
      return "TEST";
    case "live":
      return "LIVE";
    case "unknown":
      return "UNKNOWN";
  }
}
