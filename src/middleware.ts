import { defineMiddleware } from "astro:middleware";
import {
  isCoursePreviewProductionBlocked,
  isCoursePreviewRoute,
} from "./lib/legacy_kin/coursePreviewProductionAccess";
import {
  isDropShoulderProductionBlocked,
  isDropShoulderRoute,
} from "./lib/patterns/dropShoulderProductionAccess";
import {
  isWatsonApiRoute,
  isWatsonRoute,
  watsonApiUnauthorizedResponse,
} from "./lib/watson/watsonAccess";
import {
  isWatsonPublicPath,
  isWatsonSessionAuthenticated,
  sanitizeWatsonLoginNextPath,
} from "./lib/watson/watsonAuth";

const devOnlyRouteEnv = {
  isViteDev: import.meta.env.DEV,
  publicSiteEnv: import.meta.env.PUBLIC_SITE_ENV,
};

export const onRequest = defineMiddleware(async (context, next) => {
  const request = context.request;
  const u = new URL(request.url);

  // Normalize duplicate slashes in the path (e.g. `//signup/thank-you`). Malformed links
  // from external sources — notably ActiveCampaign emails that concatenate a base URL ending
  // in `/` with a leading-slash path — produce `//…`, which matches no route and 404s on every
  // environment. Collapse repeated slashes and redirect to the canonical single-slash URL,
  // preserving the query string (e.g. `?utm_source=ActiveCampaign`).
  const normalizedPathname = u.pathname.replace(/\/{2,}/g, "/");
  if (normalizedPathname !== u.pathname) {
    return context.redirect(`${normalizedPathname}${u.search}`, 301);
  }

  // Taitexma ribber slug cleanup (misnamed TR-860 / broken Silver Reed link).
  // Keep in sync with [[redirects]] in netlify.toml.
  const shopMachineSlugRedirects: Record<string, string> = {
    "/shop/machines/taitexma-tr-860": "/shop/machines/taitexma-tr-850",
    "/shop/machines/silver-reed-tr-860": "/shop/machines/taitexma-tr-850",
  };
  const shopMachineRedirectTo = shopMachineSlugRedirects[normalizedPathname];
  if (shopMachineRedirectTo) {
    return context.redirect(`${shopMachineRedirectTo}${u.search}`, 301);
  }

  if (
    isDropShoulderRoute(u.pathname) &&
    isDropShoulderProductionBlocked(u.hostname, devOnlyRouteEnv)
  ) {
    return context.redirect("/patterns/", 302);
  }

  if (
    isCoursePreviewRoute(u.pathname) &&
    isCoursePreviewProductionBlocked(u.hostname, devOnlyRouteEnv)
  ) {
    return context.redirect("/courses/", 302);
  }

  const isWatsonPage = isWatsonRoute(u.pathname);
  const isWatsonApi = isWatsonApiRoute(u.pathname);

  if (isWatsonPage && u.pathname === "/watson/login" && isWatsonSessionAuthenticated(context.cookies)) {
    return context.redirect(sanitizeWatsonLoginNextPath(u.searchParams.get("next")), 302);
  }

  if ((isWatsonPage || isWatsonApi) && !isWatsonPublicPath(u.pathname)) {
    if (!isWatsonSessionAuthenticated(context.cookies)) {
      if (isWatsonApi) {
        return watsonApiUnauthorizedResponse();
      }

      const next = encodeURIComponent(`${u.pathname}${u.search}`);
      return context.redirect(`/watson/login?next=${next}`, 302);
    }

    context.locals.watsonAuthenticated = true;
  }

  // ✅ Always pass /api through unchanged (keep your original behavior)
  if (u.pathname.startsWith("/api/")) {
    // ✅ Also capture Memberstack token for API routes
    const token =
      context.cookies.get("memberstack")?.value ||
      context.cookies.get("memberstack_access_token")?.value ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      null;

    context.locals.msToken = token;
    return next();
  }

  // For non-API routes, just continue
  return next();
});