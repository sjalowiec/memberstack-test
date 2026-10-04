import { applyComplimentaryCampaignRequestHosts } from "./complimentaryCampaignSync";

/**
 * Astro SSR inlines literal `import.meta.env.*` at build time. Watson routes
 * bundled that way do not always see Netlify's runtime `SITE_ID` or the
 * complimentary sync flag on `process.env`. Fill only the missing keys from
 * the build, then from the request host, so production can write and kin-dev
 * still resolves to its own site.
 *
 * Imported only by Astro routes. The scheduled Netlify function reads
 * `process.env` itself and must not import this file.
 */
export function observedComplimentaryCampaignHosts(
  requestUrl?: URL,
  request?: Request,
): string[] {
  const hosts: string[] = [];
  const add = (value: string | null | undefined) => {
    const host = String(value || "")
      .split(",")[0]
      .trim()
      .toLowerCase()
      .split(":")[0];
    if (host && !hosts.includes(host)) hosts.push(host);
  };
  add(requestUrl?.hostname);
  add(request?.headers.get("host"));
  add(request?.headers.get("x-forwarded-host"));
  return hosts;
}

export function complimentaryCampaignAstroEnv(input?: {
  requestUrl?: URL;
  request?: Request;
}): NodeJS.ProcessEnv {
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
  return applyComplimentaryCampaignRequestHosts(
    env,
    observedComplimentaryCampaignHosts(input?.requestUrl, input?.request),
  );
}
