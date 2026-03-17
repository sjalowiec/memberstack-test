/**
 * Dev-only gating bypass for Memberstack-gated content.
 *
 * When true, gated content and member-only UI are shown locally without
 * requiring a real Memberstack login. For local development only.
 *
 * Requirements (both must be true):
 * - import.meta.env.DEV is true (Astro dev server)
 * - PUBLIC_DEV_BYPASS_GATING is set to the string "true" in .env
 *
 * To disable before release:
 * - Set PUBLIC_DEV_BYPASS_GATING=false in .env, or
 * - Remove PUBLIC_DEV_BYPASS_GATING from .env
 * Production builds (astro build) have import.meta.env.DEV false, so the
 * bypass is off automatically in production.
 */
export const devBypass =
  typeof import.meta !== "undefined" &&
  !!import.meta.env?.DEV &&
  import.meta.env.PUBLIC_DEV_BYPASS_GATING === "true";
