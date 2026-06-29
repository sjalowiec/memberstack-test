import type { APIRoute } from "astro";
import { handleCourseReadyNotificationRequest } from "../../lib/email/courseReadyNotificationHandler";

export const prerender = false;

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { ok: false, error: "Invalid request body." },
      400,
    );
  }

  const result = await handleCourseReadyNotificationRequest(
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {},
  );

  if (result.ok) {
    return jsonResponse({ ok: true }, result.status);
  }

  return jsonResponse({ ok: false, error: result.error }, result.status);
};
