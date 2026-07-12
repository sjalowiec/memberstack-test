import type { APIRoute } from "astro";

import {
  buildWatsonSessionCookieHeader,
  createWatsonSessionToken,
  resolveWatsonAdminPassword,
  sanitizeWatsonLoginNextPath,
  verifyWatsonPassword,
} from "../../../lib/watson/watsonAuth";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const configuredPassword = resolveWatsonAdminPassword();
  if (!configuredPassword) {
    return new Response("Watson is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const form = await request.formData();
  const submittedPassword = String(form.get("password") ?? "");
  const next = sanitizeWatsonLoginNextPath(String(form.get("next") ?? ""));

  if (!verifyWatsonPassword(submittedPassword, configuredPassword)) {
    const location = new URL("/watson/login", request.url);
    location.searchParams.set("error", "1");
    if (next !== "/watson") {
      location.searchParams.set("next", next);
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${location.pathname}${location.search}`,
        "Cache-Control": "no-store",
      },
    });
  }

  const token = createWatsonSessionToken(configuredPassword);
  return new Response(null, {
    status: 302,
    headers: {
      Location: next,
      "Set-Cookie": buildWatsonSessionCookieHeader(token, request),
      "Cache-Control": "no-store",
    },
  });
};
