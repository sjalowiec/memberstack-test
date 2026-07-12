import { createHmac, timingSafeEqual } from "node:crypto";

export const WATSON_SESSION_COOKIE = "watson_session";
export const WATSON_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

type WatsonSecretEnv = {
  WATSON_ADMIN_PASSWORD?: string;
};

type CookieStore = {
  get: (name: string) => { value: string } | undefined;
};

export function resolveWatsonAdminPassword(
  env: WatsonSecretEnv = import.meta.env,
): string | null {
  const password = (env.WATSON_ADMIN_PASSWORD || "").trim();
  return password || null;
}

export function isWatsonPublicPath(pathname: string): boolean {
  return (
    pathname === "/watson/login" ||
    pathname === "/api/watson/login" ||
    pathname === "/api/watson/logout"
  );
}

function signSessionPayload(payload: string, password: string): string {
  return createHmac("sha256", password).update(payload).digest("base64url");
}

export function createWatsonSessionToken(password: string, now = Date.now()): string {
  const exp = now + WATSON_SESSION_MAX_AGE_SECONDS * 1000;
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
  return `${payload}.${signSessionPayload(payload, password)}`;
}

export function verifyWatsonSessionToken(
  token: string,
  password: string,
  now = Date.now(),
): boolean {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = signSessionPayload(payload, password);
  try {
    const actualBuf = Buffer.from(signature, "base64url");
    const expectedBuf = Buffer.from(expected, "base64url");
    if (actualBuf.length !== expectedBuf.length) return false;
    if (!timingSafeEqual(actualBuf, expectedBuf)) return false;
  } catch {
    return false;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: unknown;
    };
    return typeof data.exp === "number" && data.exp > now;
  } catch {
    return false;
  }
}

export function verifyWatsonPassword(input: string, password: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || !password) return false;

  const inputBuf = Buffer.from(trimmed, "utf8");
  const passwordBuf = Buffer.from(password, "utf8");
  if (inputBuf.length !== passwordBuf.length) return false;
  return timingSafeEqual(inputBuf, passwordBuf);
}

export function getWatsonSessionToken(cookies: CookieStore): string | null {
  const value = cookies.get(WATSON_SESSION_COOKIE)?.value?.trim();
  return value || null;
}

export function isWatsonSessionAuthenticated(
  cookies: CookieStore,
  options?: { password?: string | null; now?: number },
): boolean {
  const password = options?.password ?? resolveWatsonAdminPassword();
  if (!password) return false;

  const token = getWatsonSessionToken(cookies);
  if (!token) return false;

  return verifyWatsonSessionToken(token, password, options?.now);
}

export function buildWatsonSessionCookieHeader(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:";
  const parts = [
    `${WATSON_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${WATSON_SESSION_MAX_AGE_SECONDS}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function buildWatsonLogoutCookieHeader(request: Request): string {
  const secure = new URL(request.url).protocol === "https:";
  const parts = [
    `${WATSON_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function sanitizeWatsonLoginNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/watson") || next.startsWith("//") || next.startsWith("/watson/login")) {
    return "/watson";
  }
  return next;
}
