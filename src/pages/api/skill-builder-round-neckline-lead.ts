import type { APIRoute } from "astro";
import {
  handleRoundNecklineSkillBuilderLeadRequest,
  toPublicRoundNecklineLeadResponse,
} from "../../lib/skillBuilders/roundNecklineSkillBuilderLeadCapture";
import { getClientIpFromHeaders } from "../../lib/security/ipRateLimit";

export const prerender = false;

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return jsonResponse(
      { ok: false, error: "Content-Type must be application/json" },
      400,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid request body." }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ ok: false, error: "Invalid request body." }, 400);
  }

  const result = await handleRoundNecklineSkillBuilderLeadRequest(
    body as Record<string, unknown>,
    {
      clientIp: getClientIpFromHeaders(request.headers),
    },
  );

  return jsonResponse(toPublicRoundNecklineLeadResponse(result), result.status);
};
