import type { APIRoute } from "astro";

import { readPatternActivityEvents } from "../../../lib/watson/patternActivityBlobRead";
import {
  requireWatsonSessionJson,
  watsonJsonResponse,
} from "../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const requested = context.url.searchParams.get("environment");
  const environment = requested === "dev" ? "dev" : "production";
  const from = context.url.searchParams.get("from")?.trim() ?? "";
  const to = context.url.searchParams.get("to")?.trim() ?? "";
  const offset = context.url.searchParams.get("offset")?.trim() ?? "";

  try {
    const result = await readPatternActivityEvents({ environment, from, to, offset });
    if (!result.ok) {
      return watsonJsonResponse({ ok: false, error: result.error }, result.status);
    }
    return watsonJsonResponse({
      ok: true,
      events: result.events,
      total: result.total,
      environment,
    });
  } catch {
    return watsonJsonResponse({ ok: false, error: "Could not read pattern activity." }, 502);
  }
};
