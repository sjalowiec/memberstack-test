import type { APIContext } from "astro";

import { requireAdminForRequest } from "../admin/requireAdminRequest";

export function watsonJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function requireWatsonAdminJson(
  context: APIContext,
): Promise<
  | { ok: true; member: { id: string; email: string | null } }
  | Response
> {
  const auth = await requireAdminForRequest(context.request, context.cookies);
  if (!auth.ok) {
    return watsonJsonResponse({ ok: false, error: auth.error }, auth.status);
  }
  return { ok: true, member: auth.member };
}

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
