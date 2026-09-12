import { createHmac, timingSafeEqual } from "node:crypto";
import { astroServerAdminEnv } from "../admin/requireAdminRequest";

export const KIN_ADMIN_PREVIEW_COOKIE = "kin_admin_preview";
export const KIN_ADMIN_PREVIEW_MAX_AGE_SEC = 15 * 60;
export const KIN_ADMIN_PREVIEW_PATH = "/courses";

type PreviewGrantPayload = {
  v: 1;
  sub: string;
  exp: number;
};

export type KinCoursePreviewCookieStore = {
  get: (name: string) => { value: string } | undefined;
  set?: (
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none";
      path?: string;
      maxAge?: number;
    },
  ) => void;
};

function signingMaterial(env: NodeJS.ProcessEnv): string | null {
  const secret = String(env.MEMBERSTACK_SECRET_KEY || "").trim();
  return secret || null;
}

function hmac(payload: string, key: string): string {
  return createHmac("sha256", `kin-admin-preview:${key}`).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isUsableMemberId(memberId: string): boolean {
  const id = memberId.trim();
  if (!id || id.length > 128) return false;
  if (id.includes(".")) return false;
  if (/\s/.test(id)) return false;
  return true;
}

export function createKinAdminPreviewGrant(
  memberId: string,
  options: { now?: number; env?: NodeJS.ProcessEnv; maxAgeSec?: number } = {},
): string | null {
  const env = options.env ?? astroServerAdminEnv();
  const key = signingMaterial(env);
  if (!key) return null;
  if (!isUsableMemberId(memberId)) return null;
  const maxAgeSec = options.maxAgeSec ?? KIN_ADMIN_PREVIEW_MAX_AGE_SEC;
  const exp = Math.floor((options.now ?? Date.now()) / 1000) + maxAgeSec;
  const payload: PreviewGrantPayload = { v: 1, sub: memberId.trim(), exp };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${hmac(encoded, key)}`;
}

export function verifyKinAdminPreviewGrant(
  value: string | null | undefined,
  options: { now?: number; env?: NodeJS.ProcessEnv } = {},
): boolean {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw.split(".").length !== 2) return false;
  const env = options.env ?? astroServerAdminEnv();
  const key = signingMaterial(env);
  if (!key) return false;
  const dot = raw.lastIndexOf(".");
  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  if (!payload || !signature) return false;
  if (!safeEqual(signature, hmac(payload, key))) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const record = parsed as Record<string, unknown>;
  if (record.v !== 1) return false;
  if (typeof record.sub !== "string" || !isUsableMemberId(record.sub)) return false;
  if (typeof record.exp !== "number" || !Number.isFinite(record.exp)) return false;
  const nowSec = Math.floor((options.now ?? Date.now()) / 1000);
  return record.exp > nowSec;
}

export function persistKinCourseAdminPreviewCookie(
  cookies: KinCoursePreviewCookieStore | undefined,
  url: URL,
  memberId: string,
): void {
  if (!cookies?.set) return;
  const grant = createKinAdminPreviewGrant(memberId);
  if (!grant) return;
  cookies.set(KIN_ADMIN_PREVIEW_COOKIE, grant, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: KIN_ADMIN_PREVIEW_PATH,
    maxAge: KIN_ADMIN_PREVIEW_MAX_AGE_SEC,
  });
}

export function readKinAdminPreviewGrant(
  cookies: KinCoursePreviewCookieStore | undefined,
  options: { now?: number; env?: NodeJS.ProcessEnv } = {},
): boolean {
  return verifyKinAdminPreviewGrant(cookies?.get(KIN_ADMIN_PREVIEW_COOKIE)?.value, options);
}
