import type { APIContext } from "astro";

import { isWatsonSessionAuthenticated } from "./watsonAuth";

export function watsonJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function requireWatsonSessionJson(
  context: APIContext,
): Promise<{ ok: true } | Response> {
  if (!isWatsonSessionAuthenticated(context.cookies)) {
    return watsonJsonResponse({ ok: false, error: "Sign in required." }, 401);
  }
  return { ok: true };
}

/** @deprecated Use requireWatsonSessionJson. Kept as alias for existing API routes. */
export const requireWatsonAdminJson = requireWatsonSessionJson;

export async function readWatsonJsonBody(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return {
      ok: false,
      response: watsonJsonResponse(
        { ok: false, error: "Content-Type must be application/json." },
        400,
      ),
    };
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      response: watsonJsonResponse({ ok: false, error: "Invalid JSON body." }, 400),
    };
  }
}
