import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const request = context.request;
  const u = new URL(request.url);

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