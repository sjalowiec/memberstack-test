import { defineMiddleware } from "astro:middleware";
import {
  isDropShoulderDiagramReviewProductionBlocked,
  isDropShoulderDiagramReviewRoute,
} from "./lib/dev/dropShoulderDiagramReviewAccess";
import {
  isSleevelessFrontStsRowsPreviewProductionBlocked,
  isSleevelessFrontStsRowsPreviewRoute,
} from "./lib/dev/sleevelessFrontStsRowsPreviewAccess";
import {
  isCoursePreviewProductionBlocked,
  isCoursePreviewRoute,
} from "./lib/legacy_kin/coursePreviewProductionAccess";
import {
  isDropShoulderProductionBlocked,
  isDropShoulderRoute,
} from "./lib/patterns/dropShoulderProductionAccess";
import {
  isSidewaysCardiganProductionBlocked,
  isSidewaysCardiganRoute,
} from "./lib/patterns/sidewaysCardiganProductionAccess";
import {
  christmasStockingTemporarilyUnavailableResponse,
  isChristmasStockingProductionBlocked,
  isChristmasStockingRoute,
} from "./lib/patterns/christmasStockingProductionAccess";
import {
  isEasyCutYarnCutterProductionBlocked,
  isEasyCutYarnCutterRoute,
} from "./lib/shop/easyCutYarnCutter";
import {
  isHobbyKnitNeedlesProductionBlocked,
  isHobbyKnitNeedlesRoute,
} from "./lib/shop/hobbyKnitNeedles";
import {
  isLk150TensionMastKitRoute,
  isLk150TensionMastProductionBlocked,
} from "./lib/shop/lk150TensionMastKit";
import {
  isWatsonApiRoute,
  isWatsonRoute,
  watsonApiUnauthorizedResponse,
} from "./lib/watson/watsonAccess";
import {
  isWatsonPublicPath,
  isWatsonSessionAuthenticated,
  sanitizeStaffLoginNextPath,
} from "./lib/watson/watsonAuth";
import { adminGateResponse, isAdminProtectedPath } from "./lib/admin/adminPageGate";
import { requireAdminForRequest } from "./lib/admin/requireAdminRequest";

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

  const staffSignedIn = isWatsonSessionAuthenticated(context.cookies);
  (context.locals as { staffAuthenticated?: boolean }).staffAuthenticated = staffSignedIn;

  if (normalizedPathname.replace(/\/+$/, "") === "/admin/login" && staffSignedIn) {
    return context.redirect(sanitizeStaffLoginNextPath(u.searchParams.get("next")), 302);
  }

  if (isAdminProtectedPath(normalizedPathname)) {
    // Admin pages require the staff session. Customer Memberstack sessions never
    // substitute for signing in as staff. API handlers share the verified gate.
    const isApi = normalizedPathname.startsWith("/api/");
    const localDevelopment = import.meta.env.DEV && ["localhost", "127.0.0.1"].includes(u.hostname);
    const auth = isApi || staffSignedIn || localDevelopment
      ? await requireAdminForRequest(request, context.cookies)
      : { ok: false as const, status: 401, error: "Sign in required." };
    const denied = adminGateResponse(auth, normalizedPathname, `${normalizedPathname}${u.search}`);
    if (denied) return denied;
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
    isSidewaysCardiganRoute(u.pathname) &&
    isSidewaysCardiganProductionBlocked(u.hostname, devOnlyRouteEnv)
  ) {
    return context.redirect("/patterns/", 302);
  }

  if (
    isChristmasStockingRoute(u.pathname) &&
    isChristmasStockingProductionBlocked(u.hostname, devOnlyRouteEnv)
  ) {
    return christmasStockingTemporarilyUnavailableResponse();
  }

  if (
    isDropShoulderDiagramReviewRoute(u.pathname) &&
    isDropShoulderDiagramReviewProductionBlocked(u.hostname, devOnlyRouteEnv)
  ) {
    return new Response("Not found", { status: 404 });
  }

  if (
    isSleevelessFrontStsRowsPreviewRoute(u.pathname) &&
    isSleevelessFrontStsRowsPreviewProductionBlocked(u.hostname, devOnlyRouteEnv)
  ) {
    return new Response("Not found", { status: 404 });
  }

  if (
    isCoursePreviewRoute(u.pathname) &&
    isCoursePreviewProductionBlocked(u.hostname, devOnlyRouteEnv)
  ) {
    return context.redirect("/courses/", 302);
  }

  if (
    isLk150TensionMastKitRoute(u.pathname) &&
    isLk150TensionMastProductionBlocked(u.hostname, devOnlyRouteEnv)
  ) {
    return new Response("Not found", { status: 404 });
  }

  if (
    isHobbyKnitNeedlesRoute(u.pathname) &&
    isHobbyKnitNeedlesProductionBlocked(u.hostname, devOnlyRouteEnv)
  ) {
    return new Response("Not found", { status: 404 });
  }

  if (
    isEasyCutYarnCutterRoute(u.pathname) &&
    isEasyCutYarnCutterProductionBlocked(u.hostname, devOnlyRouteEnv)
  ) {
    return new Response("Not found", { status: 404 });
  }

  const isWatsonPage = isWatsonRoute(u.pathname);
  const isWatsonApi = isWatsonApiRoute(u.pathname);

  if (isWatsonPage && u.pathname === "/watson/login" && isWatsonSessionAuthenticated(context.cookies)) {
    return context.redirect(sanitizeStaffLoginNextPath(u.searchParams.get("next")), 302);
  }

  if ((isWatsonPage || isWatsonApi) && !isWatsonPublicPath(u.pathname)) {
    if (!isWatsonSessionAuthenticated(context.cookies)) {
      if (isWatsonApi) {
        return watsonApiUnauthorizedResponse();
      }

      const next = encodeURIComponent(`${u.pathname}${u.search}`);
      return context.redirect(`/admin/login?next=${next}`, 302);
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

  const response = await next();
  if (isWatsonPage || normalizedPathname === "/admin" || normalizedPathname.startsWith("/admin/")) {
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
});
