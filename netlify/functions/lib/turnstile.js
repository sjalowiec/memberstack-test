export const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function getTurnstileSecretKey(env = process.env) {
  return (env.TURNSTILE_SECRET_KEY || "").trim();
}

/**
 * @param {string | undefined} token
 * @param {string} ip
 * @param {{
 *   secret?: string;
 *   fetchImpl?: typeof fetch;
 * }} [options]
 * @returns {Promise<{ ok: true } | { ok: false, reason: string, errorCodes?: string[] }>}
 */
export async function verifyTurnstileToken(token, ip, options = {}) {
  const secret = options.secret ?? getTurnstileSecretKey();
  const fetchImpl = options.fetchImpl ?? fetch;
  const trimmedToken = (token || "").trim();

  if (!secret) {
    return { ok: false, reason: "missing_secret" };
  }
  if (!trimmedToken) {
    return { ok: false, reason: "missing_token" };
  }

  const body = new URLSearchParams({
    secret,
    response: trimmedToken,
  });
  if (ip && ip !== "unknown") {
    body.set("remoteip", ip);
  }

  let result;
  try {
    const resp = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    result = await resp.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[contact] Turnstile verification request failed:", message);
    return { ok: false, reason: "verify_request_failed" };
  }

  if (result?.success) {
    return { ok: true };
  }

  const errorCodes = Array.isArray(result?.["error-codes"])
    ? result["error-codes"].map((code) => String(code))
    : [];

  if (errorCodes.includes("timeout-or-duplicate")) {
    return { ok: false, reason: "expired_token", errorCodes };
  }

  return { ok: false, reason: "invalid_token", errorCodes };
}
