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

/** Lightweight summary index: `{family}/{userId}/index.json` */
export function projectIndexKey(family, userId) {
  return `${userProjectsPrefix(family, userId)}index.json`;
}

// v3 adds original entered gauge counts to summaries for user-facing display; bumping forces stale indexes to rebuild.
export const PROJECT_SUMMARY_INDEX_VERSION = 3;

/** @param {unknown} value */
function gaugePositiveNumber(value) {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Derives display gauge from a saved pattern's `yarnGauge` section.
 * Keeps original entered swatch counts for display when stored; per-inch values remain for internal use.
 * Mirrors `savedPatternGaugeDisplay.ts`.
 * @param {Record<string, unknown>} project
 */
export function gaugeFromProject(project) {
  const pattern =
    project && typeof project.pattern === "object" && project.pattern
      ? /** @type {Record<string, unknown>} */ (project.pattern)
      : null;
  const yarnGauge =
    pattern && typeof pattern.yarnGauge === "object" && pattern.yarnGauge
      ? /** @type {Record<string, unknown>} */ (pattern.yarnGauge)
      : null;
  if (!yarnGauge) return null;

  const rawSts = gaugePositiveNumber(yarnGauge.gaugeStitchRaw);
  const rawRows = gaugePositiveNumber(yarnGauge.gaugeRowRaw);
  const unit = yarnGauge.gaugeRawUnit === "cm" ? "cm" : "in";

  const perInchSts = gaugePositiveNumber(yarnGauge.stitchGauge);
  const perInchRows = gaugePositiveNumber(yarnGauge.rowGauge);

  if (rawSts !== null && rawRows !== null) {
    const perInch = (raw) => (unit === "cm" ? (raw / 10) * 2.54 : raw / 4);
    return {
      stitchesPerInch: perInchSts ?? perInch(rawSts),
      rowsPerInch: perInchRows ?? perInch(rawRows),
      displayStitches: rawSts,
      displayRows: rawRows,
    };
  }

  if (perInchSts !== null && perInchRows !== null) {
    return { stitchesPerInch: perInchSts, rowsPerInch: perInchRows };
  }

  return null;
}

/** @param {Record<string, unknown>} project */
export function summaryFromProject(project) {
  const gauge = gaugeFromProject(project);
  return {
    id: project.id,
    name: project.name,
    family: project.family,
    source: project.source,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    version: project.version,
    ...(gauge ? { gauge } : {}),
  };
}

/** @param {unknown[]} summaries */
export function sortProjectSummaries(summaries) {
  return [...summaries].sort((a, b) =>
    String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
  );
}

/** @param {unknown} summary */
function isValidProjectSummary(summary) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return false;
  const row = /** @type {Record<string, unknown>} */ (summary);
  return typeof row.id === "string" && row.id.trim().length > 0;
}

/** @param {unknown} parsed */
function parseProjectSummaryIndex(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const root = /** @type {Record<string, unknown>} */ (parsed);
  // Reject stale-schema indexes so they rebuild from the full project blobs (backfills gauge).
  if (root.version !== PROJECT_SUMMARY_INDEX_VERSION) return null;
  const raw = root.summaries;
  if (!Array.isArray(raw)) return null;
  const summaries = raw.filter(isValidProjectSummary);
  if (summaries.length === 0) return null;
  return sortProjectSummaries(summaries);
}

/** @param {import("@netlify/blobs").Store} store @param {string} family @param {string} userId */
export async function readProjectSummaryIndex(store, family, userId) {
  const key = projectIndexKey(family, userId);
  const parsed = await readProjectJson(store, key);
  return parseProjectSummaryIndex(parsed);
}

/** @param {import("@netlify/blobs").Store} store @param {string} family @param {string} userId @param {unknown[]} summaries */
export async function writeProjectSummaryIndex(store, family, userId, summaries) {
  const key = projectIndexKey(family, userId);
  const sorted = sortProjectSummaries(summaries);
  const payload = {
    version: PROJECT_SUMMARY_INDEX_VERSION,
    updatedAt: new Date().toISOString(),
    summaries: sorted,
  };
  await store.set(key, JSON.stringify(payload), {
    metadata: {
      userId,
      family: sanitizeKeySegment(family),
      kind: "summary-index",
      updatedAt: payload.updatedAt,
    },
  });
  return sorted;
}

/** Explanatory text returned when a free user's protected pattern delete is refused. */
export const FREE_SLEEVELESS_PATTERN_DELETE_BLOCKED_MESSAGE =
  "This is your free Sleeveless Pattern. To keep access to it, it can't be deleted unless you unlock the Sleeveless Pattern System.";

/** Explanatory text returned when a non-member tries to create/copy another saved pattern. */
export const SLEEVELESS_PATTERN_CREATE_BLOCKED_MESSAGE =
  "You've already created your free Sleeveless Pattern. To create additional versions, change your gauge or measurements, or explore different style choices, you'll need access to the Sleeveless Pattern System.";

/**
 * Server mirror of the client create/copy rule. Returns true when a new saved project must be
 * refused. Uses client-asserted entitlement (same trust level as delete) plus an independent
 * project-count fallback when entitlement is missing.
 *
 * @param {{ hasSystemAccess?: boolean, freeClaimed?: boolean, existingProjectCount?: number }} input
 */
export function isSleevelessPatternCreateBlocked(input) {
  if (!input || typeof input !== "object") return false;
  if (input.hasSystemAccess === true) return false;
  if (input.freeClaimed === true) return true;

  const count = Number(input.existingProjectCount);
  if (Number.isFinite(count) && count > 0) return true;
  return false;
}

/**
 * Parses the optional client entitlement snapshot from a save request body.
 * @param {unknown} body
 */
export function readSleevelessEntitlementFromSaveBody(body) {
  const root =
    body && typeof body === "object" && !Array.isArray(body)
      ? /** @type {Record<string, unknown>} */ (body)
      : null;
  const entitlement =
    root?.entitlement && typeof root.entitlement === "object" && !Array.isArray(root.entitlement)
      ? /** @type {Record<string, unknown>} */ (root.entitlement)
      : null;
  if (!entitlement) return null;
  return {
    hasSystemAccess: entitlement.hasSystemAccess === true,
    freeClaimed: entitlement.freeClaimed === true,
    freeClaimedPatternId:
      typeof entitlement.freeClaimedPatternId === "string"
        ? entitlement.freeClaimedPatternId.trim()
        : undefined,
  };
}

/**
 * Server mirror of the client free-pattern delete rule. Returns true when the deletion must be
 * refused. The entitlement flags are client-asserted (same trust level as `X-KBM-Member-Id`), but
 * `totalSavedCount` is computed server-side from the user's own blobs for the unknown-id fallback.
 *
 * - System access → never blocked.
 * - Not freeClaimed → never blocked.
 * - freeClaimed + known claimed id → block deleting exactly that id.
 * - freeClaimed + unknown claimed id → block when it is the user's last remaining pattern.
 *
 * @param {{ hasSystemAccess?: boolean, freeClaimed?: boolean, freeClaimedPatternId?: string, projectId: string, totalSavedCount: number }} input
 */
export function isFreeSleevelessPatternDeleteBlocked(input) {
  if (!input || typeof input !== "object") return false;
  if (input.hasSystemAccess === true) return false;
  if (input.freeClaimed !== true) return false;

  const claimedId =
    typeof input.freeClaimedPatternId === "string" ? input.freeClaimedPatternId.trim() : "";
  if (claimedId) return String(input.projectId) === claimedId;

  const count = Number(input.totalSavedCount);
  return Number.isFinite(count) ? count <= 1 : true;
}

/**
 * Deletes a project blob and updates the lightweight summary index.
 * @param {import("@netlify/blobs").Store} store
 * @param {string} family
 * @param {string} userId
 * @param {string} projectId
 */
export async function deleteProjectAndUpdateIndex(store, family, userId, projectId) {
  const key = projectBlobKey(family, userId, projectId);
  await store.delete(key);

  // Index might still reference the deleted project — filter before rewriting.
  let existing = await readProjectSummaryIndex(store, family, userId);
  if (!existing) {
    existing = await listProjectSummariesFromBlobScan(store, family, userId);
  }
  const next = existing.filter((row) => row.id !== projectId);
  await writeProjectSummaryIndex(store, family, userId, next);
  return next;
}

/**
 * Upsert one project summary into the index (after save/update).
 * @param {import("@netlify/blobs").Store} store
 * @param {string} family
 * @param {string} userId
 * @param {Record<string, unknown>} project
 */
export async function upsertProjectSummaryInIndex(store, family, userId, project) {
  const summary = summaryFromProject(project);
  let existing = await readProjectSummaryIndex(store, family, userId);
  if (!existing) {
    existing = await listProjectSummariesFromBlobScan(store, family, userId);
  }
  const next = existing.filter((row) => row.id !== summary.id);
  next.push(summary);
  return writeProjectSummaryIndex(store, family, userId, next);
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
      "Content-Type, Authorization, X-KBM-Member-Id, X-KBM-Member-Email, X-KBM-Dev-User-Id",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

  const readingWorkflow =
    data.readingWorkflow &&
    typeof data.readingWorkflow === "object" &&
    !Array.isArray(data.readingWorkflow)
      ? data.readingWorkflow
      : undefined;

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
      ...(readingWorkflow ? { readingWorkflow } : {}),
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

/** Scan all project blobs (legacy path; skips index.json). */
export async function listProjectSummariesFromBlobScan(store, family, userId) {
  const prefix = userProjectsPrefix(family, userId);
  const indexKey = projectIndexKey(family, userId);
  const { blobs } = await store.list({ prefix });
  const summaries = [];
  for (const blob of blobs) {
    if (blob.key === indexKey || !blob.key.endsWith(".json")) continue;
    const project = await readProjectJson(store, blob.key);
    if (!project?.id) continue;
    summaries.push(summaryFromProject(project));
  }
  return sortProjectSummaries(summaries);
}

/** @param {import("@netlify/blobs").Store} store @param {string} family @param {string} userId */
export async function listProjectSummaries(store, family, userId) {
  const fromIndex = await readProjectSummaryIndex(store, family, userId);
  if (fromIndex) return fromIndex;

  const fromScan = await listProjectSummariesFromBlobScan(store, family, userId);
  await writeProjectSummaryIndex(store, family, userId, fromScan);
  return fromScan;
}
