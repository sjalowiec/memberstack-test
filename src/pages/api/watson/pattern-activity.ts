import type { APIRoute } from "astro";

import {
  requireWatsonSessionJson,
  watsonJsonResponse,
} from "../../../lib/watson/watsonApiAuth";

export const prerender = false;

const TARGET_ORIGIN = {
  production: "https://www.knititnow.com",
  dev: "https://kin-dev.netlify.app",
} as const;

/**
 * Read-only proxy. Forwards the viewer's Memberstack bearer token with GET only.
 * Redirects are followed manually so Authorization is not dropped.
 */
async function getActivity(
  url: string,
  authorization: string,
): Promise<Response> {
  let current = url;
  for (let hop = 0; hop < 3; hop += 1) {
    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        Authorization: authorization,
        Accept: "application/json",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  return new Response(JSON.stringify({ ok: false, error: "Too many redirects." }), {
    status: 502,
  });
}

export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const requested = context.url.searchParams.get("environment");
  const environment = requested === "dev" ? "dev" : "production";
  const authorization = context.request.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/i.test(authorization)) {
    return watsonJsonResponse(
      { ok: false, error: "Sign in on the site that recorded these events, then reload Watson." },
      401,
    );
  }

  const params = new URLSearchParams({ limit: "2000" });
  const from = context.url.searchParams.get("from")?.trim() ?? "";
  const to = context.url.searchParams.get("to")?.trim() ?? "";
  const offset = context.url.searchParams.get("offset")?.trim() ?? "";
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (offset) params.set("offset", offset);

  const url = `${TARGET_ORIGIN[environment]}/.netlify/functions/pattern-activity-log?${params}`;
  try {
    const res = await getActivity(url, authorization);
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Pattern-Activity-Source": environment,
      },
    });
  } catch {
    return watsonJsonResponse({ ok: false, error: "Could not reach pattern activity." }, 502);
  }
};
