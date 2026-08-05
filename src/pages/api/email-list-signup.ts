import type { APIRoute } from "astro";
import {
  handleEmailListSignupRequest,
  toPublicEmailListSignupResponse,
  EMAIL_LIST_SIGNUP_MESSAGES,
} from "../../lib/email/emailListSignup";
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
    return jsonResponse(
      { ok: false, error: "Invalid request body." },
      400,
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse(
      { ok: false, error: "Invalid request body." },
      400,
    );
  }

  const result = await handleEmailListSignupRequest(
    body as Record<string, unknown>,
    { clientIp: getClientIpFromHeaders(request.headers) },
  );

  const publicBody = toPublicEmailListSignupResponse(result);

  // Honeypot / rate-limit decoys still return HTTP 200 with a neutral message.
  if (result.ok) {
    return jsonResponse(publicBody, result.status);
  }

  // Never leak outcome details; keep generic copy for server failures.
  if (result.status >= 500) {
    return jsonResponse(
      { ok: false, error: EMAIL_LIST_SIGNUP_MESSAGES.genericFailure },
      result.status,
    );
  }

  return jsonResponse(publicBody, result.status);
};
