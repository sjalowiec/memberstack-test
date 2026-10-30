/**
 * Where a Store Items save is allowed to go.
 *
 * Localhost keeps writing the catalog files. The published kin-dev site and
 * the published production site each write their own Netlify Blob store.
 * Blobs belong to the Netlify site, so a kin-dev save cannot change
 * production. Deploy previews and branch deploys share that site's blob
 * store, so they are refused before anything is written.
 */
import { isLocalhostStyleHostname } from "../env/siteEnvironment";

/** Published kin-dev Netlify site. Matches the Memberstack admin runtime check. */
export const KIN_DEV_SITE_ID = "3196ab5e-c5a1-4cd4-a13a-980523087e9a";

/** Published knititnow.com Netlify site. */
export const PRODUCTION_SITE_ID = "7a6a8dde-c0a0-4a21-960d-dff3f0ba358b";

export const KIN_DEV_HOST = "kin-dev.netlify.app";

const PRODUCTION_HOSTS = new Set([
  "knititnow.com",
  "www.knititnow.com",
]);

const PREVIEW_CONTEXTS = new Set(["deploy-preview", "branch-deploy"]);

export type StoreItemSiteEnv = {
  CONTEXT?: string | null;
  SITE_ID?: string | null;
  SITE_NAME?: string | null;
  URL?: string | null;
  DEPLOY_PRIME_URL?: string | null;
};

export type StoreItemWriteAccess =
  | { ok: true; mode: "filesystem" }
  | { ok: true; mode: "blob"; site: "kin-dev" | "production" }
  | { ok: false; mode: "blocked"; error: string };

const PREVIEW_ERROR =
  "This deploy preview cannot save store items. Open the published kin-dev site or the published production site.";

const BLOCKED_ERROR =
  "Store items can be saved on this computer, or on the published kin-dev or production site.";

function clean(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function hostnameFrom(value: string | null | undefined): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).hostname.trim().toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Preview context wins when the build-time value and the runtime value disagree.
 * A deploy preview must not be treated as the published site.
 */
export function combineStoreItemContext(
  runtimeValue: string | null | undefined,
  buildValue: string | null | undefined,
): string {
  const values = [runtimeValue, buildValue].map((value) => clean(value)).filter(Boolean);
  const preview = values.find((value) => PREVIEW_CONTEXTS.has(value));
  if (preview) return preview;
  return values[0] ?? "";
}

export function combineStoreItemSiteEnv(
  runtime: StoreItemSiteEnv,
  build: StoreItemSiteEnv = {},
): StoreItemSiteEnv {
  const pick = (key: keyof StoreItemSiteEnv): string => {
    const runtimeValue = (runtime[key] || "").trim();
    if (runtimeValue) return runtimeValue;
    return (build[key] || "").trim();
  };
  return {
    CONTEXT: combineStoreItemContext(runtime.CONTEXT, build.CONTEXT),
    SITE_ID: pick("SITE_ID"),
    SITE_NAME: pick("SITE_NAME"),
    URL: pick("URL"),
    DEPLOY_PRIME_URL: pick("DEPLOY_PRIME_URL"),
  };
}

export function isStoreItemPreviewContext(context: string | null | undefined): boolean {
  return PREVIEW_CONTEXTS.has(clean(context));
}

/** Deploy-preview and branch-deploy hostnames, including `name--site.netlify.app`. */
export function isStoreItemPreviewHostname(hostname: string | null | undefined): boolean {
  const host = clean(hostname);
  if (!host) return false;
  if (host.includes("deploy-preview")) return true;
  if (host.includes("--")) return true;
  return false;
}

export function isKinDevStoreSite(env: StoreItemSiteEnv): boolean {
  if (clean(env.SITE_NAME) === "kin-dev") return true;
  if (clean(env.SITE_ID) === KIN_DEV_SITE_ID) return true;
  return hostnameFrom(env.URL) === KIN_DEV_HOST || hostnameFrom(env.DEPLOY_PRIME_URL) === KIN_DEV_HOST;
}

export function isProductionStoreSite(env: StoreItemSiteEnv): boolean {
  const siteName = clean(env.SITE_NAME);
  if (siteName === "knititnow" || siteName === "knititnow-production") return true;
  if (clean(env.SITE_ID) === PRODUCTION_SITE_ID) return true;
  const urlHost = hostnameFrom(env.URL);
  return PRODUCTION_HOSTS.has(urlHost);
}

export function resolveStoreItemWriteAccess(input: {
  hostname?: string | null;
  isViteDev?: boolean;
  env?: StoreItemSiteEnv;
}): StoreItemWriteAccess {
  const hostname = clean(input.hostname);
  if (input.isViteDev === true || isLocalhostStyleHostname(hostname)) {
    return { ok: true, mode: "filesystem" };
  }

  const env = input.env ?? {};
  const context = clean(env.CONTEXT);
  if (isStoreItemPreviewContext(context) || isStoreItemPreviewHostname(hostname)) {
    return { ok: false, mode: "blocked", error: PREVIEW_ERROR };
  }

  const kinDev = isKinDevStoreSite(env);
  const production = isProductionStoreSite(env);
  if (kinDev && production) {
    return { ok: false, mode: "blocked", error: BLOCKED_ERROR };
  }
  // The Astro SSR function on Netlify receives SITE_ID, SITE_NAME, and URL,
  // but not CONTEXT. An explicit non-production context still blocks. A missing
  // context is decided by the published hostname plus the site identity.
  if (context && context !== "production") {
    return { ok: false, mode: "blocked", error: BLOCKED_ERROR };
  }

  if (kinDev && hostname === KIN_DEV_HOST) {
    return { ok: true, mode: "blob", site: "kin-dev" };
  }
  if (production && PRODUCTION_HOSTS.has(hostname)) {
    return { ok: true, mode: "blob", site: "production" };
  }
  return { ok: false, mode: "blocked", error: BLOCKED_ERROR };
}

/** Hosted shop pages read the blob overlay. Localhost reads the project files only. */
export function shouldReadStoreItemOverlay(input: {
  hostname?: string | null;
  isViteDev?: boolean;
}): boolean {
  if (input.isViteDev === true) return false;
  return !isLocalhostStyleHostname(input.hostname);
}
