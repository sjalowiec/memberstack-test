import type { APIRoute } from "astro";

import { buildWatsonLogoutCookieHeader } from "../../../lib/watson/watsonAuth";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/watson/login",
      "Set-Cookie": buildWatsonLogoutCookieHeader(request),
      "Cache-Control": "no-store",
    },
  });
};
