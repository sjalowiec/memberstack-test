/**
 * Temporary pre-launch indexing control.
 *
 * When PUBLIC_NOINDEX=true, pages emit <meta name="robots" content="noindex, nofollow">.
 * At launch: remove PUBLIC_NOINDEX from Netlify / netlify.toml (or set it to "false") and redeploy.
 *
 * /beta/ feedback pages and /video-help/ customer videos stay available by
 * direct URL. They are left out of search engines, Pagefind, and any XML
 * sitemap. robots.txt must not Disallow them, because crawlers have to fetch
 * the page to read the noindex tag.
 */
export function isSiteNoindexEnabled(): boolean {
  return import.meta.env.PUBLIC_NOINDEX === "true";
}

function normalizedDiscoveryPath(pathname: string): string {
  const withoutQuery = pathname.split("?")[0]?.split("#")[0] ?? "";
  return withoutQuery.replace(/\/index\.html$/i, "").replace(/\/+$/, "") || "/";
}

/**
 * True for /beta, /video-help, and everything under those paths.
 * Sibling routes such as /beta-welcome stay eligible for discovery.
 */
export function isExcludedFromSearchDiscovery(pathname: string): boolean {
  const normalized = normalizedDiscoveryPath(pathname);
  return (
    normalized === "/beta" ||
    normalized.startsWith("/beta/") ||
    normalized === "/video-help" ||
    normalized.startsWith("/video-help/")
  );
}

export function shouldEmitRobotsNoindex(pathname: string): boolean {
  return isSiteNoindexEnabled() || isExcludedFromSearchDiscovery(pathname);
}

/** Drop /beta/ and /video-help/ URLs from an XML sitemap or any other discovery URL list. */
export function omitSearchDiscoveryUrls(urls: readonly string[]): string[] {
  return urls.filter((url) => {
    const pathname = url.startsWith("http") ? new URL(url).pathname : url;
    return !isExcludedFromSearchDiscovery(pathname);
  });
}
