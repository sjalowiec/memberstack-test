/**
 * Astro SSR inlines literal `import.meta.env.*` at build time. Watson routes
 * bundled that way do not always see Netlify's runtime `SITE_ID` or the
 * complimentary sync flag on `process.env`. Fill only the missing keys from
 * the build so production can write and kin-dev still resolves to its own site.
 *
 * Imported only by Astro routes. The scheduled Netlify function reads
 * `process.env` itself and must not import this file.
 */
export function complimentaryCampaignAstroEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const fill = (key: string, value: unknown) => {
    if (String(env[key] ?? "").trim()) return;
    if (typeof value === "string" && value.trim()) env[key] = value;
  };
  fill("CONTEXT", import.meta.env.CONTEXT);
  fill("SITE_ID", import.meta.env.SITE_ID);
  fill("SITE_NAME", import.meta.env.SITE_NAME);
  fill("URL", import.meta.env.URL);
  fill("DEPLOY_PRIME_URL", import.meta.env.DEPLOY_PRIME_URL);
  fill(
    "COMPLIMENTARY_CAMPAIGN_SYNC_LIVE_ENABLED",
    import.meta.env.COMPLIMENTARY_CAMPAIGN_SYNC_LIVE_ENABLED,
  );
  return env;
}
