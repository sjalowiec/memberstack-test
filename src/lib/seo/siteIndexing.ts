/**
 * Temporary pre-launch indexing control.
 *
 * When PUBLIC_NOINDEX=true, pages emit <meta name="robots" content="noindex, nofollow">.
 * At launch: remove PUBLIC_NOINDEX from Netlify / netlify.toml (or set it to "false") and redeploy.
 */
export function isSiteNoindexEnabled(): boolean {
  return import.meta.env.PUBLIC_NOINDEX === "true";
}
