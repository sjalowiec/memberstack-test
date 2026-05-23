/**
 * Netlify Blobs access for saved Custom Pattern projects.
 * Key layout: `{family}/{userId}/{projectId}.json` in store `custom-pattern-projects`.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getStore } from "@netlify/blobs";

export const CUSTOM_PATTERN_PROJECTS_BLOB_STORE = "custom-pattern-projects";

/** Stable fallback when ALLOW_DEV_PATTERN_USER is on and no member / header id. */
export const DEFAULT_DEV_PATTERN_USER_ID = "dev_local_pattern_user";

const DEFAULT_FAMILY = "sleeveless";

export function sanitizeKeySegment(segment) {
  return String(segment)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

/** @param {string} family @param {string} userId @param {string} projectId */
export function projectBlobKey(family, userId, projectId) {
  return `${sanitizeKeySegment(family)}/${sanitizeKeySegment(userId)}/${sanitizeKeySegment(projectId)}.json`;
}

/** @param {string} family @param {string} userId */
export function userProjectsPrefix(family, userId) {
  return `${sanitizeKeySegment(family)}/${sanitizeKeySegment(userId)}/`;
}

export function getProjectsStore() {
  return getStore({
    name: CUSTOM_PATTERN_PROJECTS_BLOB_STORE,
    consistency: "strong",
  });
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-KBM-Member-Id, X-KBM-Dev-User-Id",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  };
}

export function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders())) {
    headers.set(k, v);
  }
  return new Response(response.body, { status: response.status, headers });
}

/** @type {boolean | null} */
let dotEnvAllowDevCached = null;

/**
 * Astro `npm run dev` may not inject `.env` into Netlify function `process.env`.
 * Read ALLOW_DEV_PATTERN_USER from the project root `.env` only outside production.
 */
export function readAllowDevPatternUserFromDotEnv() {
  if (dotEnvAllowDevCached !== null) return dotEnvAllowDevCached;
  dotEnvAllowDevCached = false;
  if (process.env.NODE_ENV === "production") return false;
  try {
    const envPath = resolve(process.cwd(), ".env");
    if (!existsSync(envPath)) return false;
    const text = readFileSync(envPath, "utf8");
    dotEnvAllowDevCached = /\bALLOW_DEV_PATTERN_USER\s*=\s*["']?true["']?\s*$/m.test(text);
  } catch {
    dotEnvAllowDevCached = false;
  }
  return dotEnvAllowDevCached;
}

/** True when local dev pattern saves are allowed (never in production deploys). */
export function isAllowDevPatternUser() {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.CONTEXT === "production") return false;
  const fromEnv = process.env.ALLOW_DEV_PATTERN_USER;
  if (fromEnv === "true") return true;
  if (fromEnv === "false") return false;
  return readAllowDevPatternUserFromDotEnv();
}

/**
 * Dev user id: optional `X-KBM-Dev-User-Id` header, else stable local fallback.
 * @param {Request} req
 */
export function resolveDevPatternUserId(req) {
  const fromHeader = req.headers.get("x-kbm-dev-user-id")?.trim();
  const fromEnv = process.env.DEV_PATTERN_USER_FALLBACK?.trim();
  const raw = fromHeader || fromEnv || DEFAULT_DEV_PATTERN_USER_ID;
  return sanitizeKeySegment(raw);
}

/**
 * Resolves storage user id.
 * Production: `X-KBM-Member-Id` from Memberstack (client must be logged in).
 * Dev only: stable dev user when ALLOW_DEV_PATTERN_USER=true (header optional).
 * TODO: Verify Memberstack JWT via MEMBERSTACK_SECRET_KEY before trusting member id.
 *
 * @param {Request} req
 * @returns {{ userId: string, mode: "member" | "dev" } | { error: string, status: number }}
 */
export function resolveProjectUserId(req) {
  const memberId = req.headers.get("x-kbm-member-id")?.trim();
  if (memberId) {
    return { userId: sanitizeKeySegment(memberId), mode: "member" };
  }

  if (isAllowDevPatternUser()) {
    return { userId: resolveDevPatternUserId(req), mode: "dev" };
  }

  return {
    error: "Sign in required to save Custom Pattern projects.",
    status: 401,
  };
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, data: Record<string, unknown> } | { ok: false, error: string }}
 */
export function parseJsonBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "JSON body required." };
  }
  return { ok: true, data: /** @type {Record<string, unknown>} */ (body) };
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} userId
 * @param {string} [existingId]
 */
export function buildProjectRecord(data, userId, existingId) {
  const now = new Date().toISOString();
  const family =
    typeof data.family === "string" && data.family.trim()
      ? sanitizeKeySegment(data.family)
      : DEFAULT_FAMILY;
  const name =
    typeof data.name === "string" && data.name.trim()
      ? data.name.trim().slice(0, 120)
      : "Untitled pattern";
  const notes =
    typeof data.notes === "string" ? data.notes.trim().slice(0, 300) : "";
  const source =
    data.source === "express" || data.source === "custom-build" ? data.source : "custom-build";
  const pattern = data.pattern;
  if (!pattern || typeof pattern !== "object" || Array.isArray(pattern)) {
    return { ok: false, error: "pattern (kbm_current_pattern object) is required." };
  }
  if (pattern.patternType !== "sleeveless") {
    return { ok: false, error: "Only sleeveless pattern projects are supported in this phase." };
  }

  const customOverrides =
    data.customOverrides &&
    typeof data.customOverrides === "object" &&
    !Array.isArray(data.customOverrides)
      ? data.customOverrides
      : {};

  const id = existingId ? sanitizeKeySegment(existingId) : crypto.randomUUID();
  const createdAt =
    typeof data.createdAt === "string" && data.createdAt ? data.createdAt : now;
  const version =
    typeof data.version === "number" && Number.isFinite(data.version)
      ? Math.max(1, Math.floor(data.version))
      : 1;

  return {
    ok: true,
    project: {
      id,
      name,
      ...(notes ? { notes } : {}),
      family,
      source,
      createdAt: existingId && typeof data.createdAt === "string" ? data.createdAt : createdAt,
      updatedAt: now,
      version: existingId ? version + 1 : 1,
      pattern,
      customOverrides,
      _storageUserId: userId,
    },
  };
}

/** Strip internal fields before returning to client. */
export function publicProject(project) {
  if (!project || typeof project !== "object") return project;
  const { _storageUserId, ...rest } = project;
  return rest;
}

/** @param {import("@netlify/blobs").Store} store @param {string} key */
export async function readProjectJson(store, key) {
  const raw = await store.get(key, { type: "text" });
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @param {import("@netlify/blobs").Store} store @param {string} family @param {string} userId */
export async function listProjectSummaries(store, family, userId) {
  const prefix = userProjectsPrefix(family, userId);
  const { blobs } = await store.list({ prefix });
  const summaries = [];
  for (const blob of blobs) {
    if (!blob.key.endsWith(".json")) continue;
    const project = await readProjectJson(store, blob.key);
    if (!project) continue;
    summaries.push({
      id: project.id,
      name: project.name,
      family: project.family,
      source: project.source,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      version: project.version,
    });
  }
  summaries.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return summaries;
}
