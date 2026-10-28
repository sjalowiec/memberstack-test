import { createHmac, timingSafeEqual } from "node:crypto";

// Shared by Astro pages and standalone Netlify functions. This is the existing
// Watson owner session, not a Memberstack member or a client-supplied identity.
export const STAFF_SESSION_COOKIE = "watson_session";
export const STAFF_OWNER = { id: "staff_owner", email: null };

export function verifyStaffSessionToken(token, password, now = Date.now()) {
  if (!password || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", password).update(payload).digest();
  try {
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof data.exp === "number" && Number.isFinite(data.exp) && data.exp > now;
  } catch {
    return false;
  }
}

export function hasStaffSession(request, env = process.env) {
  const password = String(env.WATSON_ADMIN_PASSWORD || "").trim();
  if (!password) return false;
  const cookies = request.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq).trim() !== STAFF_SESSION_COOKIE) continue;
    try {
      if (verifyStaffSessionToken(decodeURIComponent(part.slice(eq + 1).trim()), password)) return true;
    } catch { /* malformed cookie is not a session */ }
  }
  return false;
}

export function isSameOriginStaffRequest(request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}
