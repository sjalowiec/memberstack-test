/**
 * Dev-only gating bypass for Memberstack-gated content.
 *
 * When true, gated content and member-only UI are shown locally without
 * requiring a real Memberstack login. For local development only.
 *
 * Two independent ways to turn it on (either is sufficient):
 *
 * 1. Explicit opt-in (works on the Astro dev server):
 *    - import.meta.env.DEV is true (Astro dev server), AND
 *    - PUBLIC_DEV_BYPASS_GATING is set to the string "true" in .env
 *
 * 2. Localhost runtime override (no env var needed): the page is being served
 *    from a localhost-style host (localhost / 127.0.0.1 / 0.0.0.0 / ::1 /
 *    *.local). This lets us exercise pattern flows locally without a real
 *    Memberstack login.
 *
 * Production hosts (knititnow.com, etc.) resolve to "production" and Netlify
 * deploy previews (*.netlify.app) resolve to "dev" — neither is "localhost",
 * so neither gets the bypass. Production builds (astro build) also have
 * import.meta.env.DEV false, so opt-in #1 is off automatically there too.
 *
 * To disable before release:
 * - Set PUBLIC_DEV_BYPASS_GATING=false in .env, or
 * - Remove PUBLIC_DEV_BYPASS_GATING from .env
 * (The localhost override only ever triggers on a localhost-style host, so it
 * cannot affect production or deploy previews regardless.)
 */
import { detectSiteEnvironment } from "./env/siteEnvironment";

/**
 * Local dev override: allows testing pattern flows without Memberstack login.
 * Only true when actually served from a localhost-style host (never on
 * production domains or *.netlify.app deploy previews).
 */
function isLocalhostRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location?.hostname;
  return (
    detectSiteEnvironment(hostname, {
      isViteDev: typeof import.meta !== "undefined" && !!import.meta.env?.DEV,
    }) === "localhost"
  );
}

export const devBypassOptIn =
  typeof import.meta !== "undefined" &&
  !!import.meta.env?.DEV &&
  import.meta.env.PUBLIC_DEV_BYPASS_GATING === "true";

/** Catalog video bypass: explicit env opt-in only (never localhost auto or ?member=true). */
export const videoDevBypass = devBypassOptIn;

// Local dev override: allows testing pattern flows without Memberstack login.
export const devBypass = devBypassOptIn || isLocalhostRuntime();
