import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware((context, next) => {
  const request = context.request;
  const u = new URL(request.url);

  // For /api routes (e.g. /api/jumplinks.json?content_id=...), ensure any rewrite
  // preserves the query string. Pass through unchanged so search params reach the API.
  if (u.pathname.startsWith("/api/")) {
    return next();
  }

  return next();
});
