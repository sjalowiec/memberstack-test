import { defineMiddleware } from "astro:middleware";
import {
  isCoursePreviewProductionBlocked,
  isCoursePreviewRoute,
} from "./lib/legacy_kin/coursePreviewProductionAccess";
import {
  isDropShoulderProductionBlocked,
  isDropShoulderRoute,
} from "./lib/patterns/dropShoulderProductionAccess";

const devOnlyRouteEnv = {
  isViteDev: import.meta.env.DEV,
  publicSiteEnv: import.meta.env.PUBLIC_SITE_ENV,
};

export const onRequest = defineMiddleware(async (context, next) => {
  const request = context.request;
  const u = new URL(request.url);

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