import { isSameOriginStaffRequest } from "../../../../netlify/functions/lib/staff-session.js";
import type { APIRoute } from "astro";

import { buildWatsonLogoutCookieHeader } from "../../../lib/watson/watsonAuth";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginStaffRequest(request)) return new Response("Same-origin request required.", { status: 403 });
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/admin/login",
      "Set-Cookie": buildWatsonLogoutCookieHeader(request),
      "Cache-Control": "no-store",
    },
  });
};

