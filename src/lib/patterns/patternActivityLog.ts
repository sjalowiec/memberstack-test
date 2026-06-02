/**
 * Lightweight pattern activity tracking.
 *
 * Records small, non-blocking events (started / generated / saved / updated / opened / printed)
 * for logged-in users. Events are stored separately from saved pattern project JSON via the
 * `pattern-activity-log` Netlify function + Blobs store.
 *
 * Design rules:
 * - Logging is **best-effort** and must never block or break the pattern workflow.
 * - Only logged-in Memberstack users (or the local dev pattern user) are tracked.
 * - `createPatternActivityEvent` / `summarizePatternActivity` are pure + tested; the client
 *   `logPatternActivity` resolves identity and fires the request without throwing.
 */
import {
  authHeadersForCustomPatternProjects,
  resolveCustomPatternProjectAuth,
} from "./customPatternProjectAuth";
import { memberEmailFromMemberstackPayload } from "./memberstackMember";

export const PATTERN_ACTIVITY_LOG_ENDPOINT = "/.netlify/functions/pattern-activity-log";

export type PatternActivityEventType =
  | "pattern_started"
  | "pattern_generated"
  | "pattern_saved"
  | "pattern_updated"
  | "pattern_opened"
  | "pattern_printed";

export const PATTERN_ACTIVITY_EVENT_TYPES: readonly PatternActivityEventType[] = [
  "pattern_started",
  "pattern_generated",
  "pattern_saved",
  "pattern_updated",
  "pattern_opened",
  "pattern_printed",
];

/** A single recorded activity event. Optional fields are omitted when unknown. */
export interface PatternActivityEvent {
  id: string;
  userId: string;
  userEmail?: string;
  /** Pattern system key, e.g. "sleeveless", "hat", "blanket". */
  patternSystem: string;
  patternId?: string;
  patternTitle?: string;
  eventType: PatternActivityEventType;
  /** e.g. "express" or "custom". */
  mode?: string;
  sourcePage?: string;
  createdAt: string;
  /** Small optional details only — keep this lightweight. */
  metadata?: Record<string, unknown>;
}

/** Fields accepted by {@link createPatternActivityEvent}. `id`/`createdAt` are generated when absent. */
export interface PatternActivityEventInput {
  userId: string;
  eventType: PatternActivityEventType;
  patternSystem: string;
  userEmail?: string;
  patternId?: string;
  patternTitle?: string;
  mode?: string;
  sourcePage?: string;
  metadata?: Record<string, unknown>;
  id?: string;
  createdAt?: string;
}

function generateId(): string {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function trimmedOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Builds a normalized {@link PatternActivityEvent}. Required: `userId`, `eventType`, `patternSystem`.
 * Optional fields are only included when present, and `metadata` is copied as a plain object.
 * Throws when a required field is missing or `eventType` is unknown.
 */
export function createPatternActivityEvent(
  input: PatternActivityEventInput,
): PatternActivityEvent {
  const userId = trimmedOrUndefined(input?.userId);
  if (!userId) {
    throw new Error("createPatternActivityEvent: userId is required.");
  }
  const patternSystem = trimmedOrUndefined(input?.patternSystem);
  if (!patternSystem) {
    throw new Error("createPatternActivityEvent: patternSystem is required.");
  }
  if (!PATTERN_ACTIVITY_EVENT_TYPES.includes(input?.eventType)) {
    throw new Error(
      `createPatternActivityEvent: unknown eventType "${String(input?.eventType)}".`,
    );
  }

  const createdAt = trimmedOrUndefined(input.createdAt) ?? new Date().toISOString();

  const event: PatternActivityEvent = {
    id: trimmedOrUndefined(input.id) ?? generateId(),
    userId,
    patternSystem,
    eventType: input.eventType,
    createdAt,
  };

  const userEmail = trimmedOrUndefined(input.userEmail);
  if (userEmail) event.userEmail = userEmail;
  const patternId = trimmedOrUndefined(input.patternId);
  if (patternId) event.patternId = patternId;
  const patternTitle = trimmedOrUndefined(input.patternTitle);
  if (patternTitle) event.patternTitle = patternTitle;
  const mode = trimmedOrUndefined(input.mode);
  if (mode) event.mode = mode;
  const sourcePage = trimmedOrUndefined(input.sourcePage);
  if (sourcePage) event.sourcePage = sourcePage;

  if (
    input.metadata &&
    typeof input.metadata === "object" &&
    !Array.isArray(input.metadata) &&
    Object.keys(input.metadata).length > 0
  ) {
    event.metadata = { ...input.metadata };
  }

  return event;
}

export interface PatternActivitySummary {
  totalEvents: number;
  uniqueUsers: number;
  generatedCount: number;
  savedCount: number;
  recentEvents: PatternActivityEvent[];
}

export interface SummarizePatternActivityOptions {
  /** Max rows for the recent-activity table (default 25). */
  recentLimit?: number;
}

function isPatternActivityEvent(value: unknown): value is PatternActivityEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.userId === "string" &&
    typeof row.eventType === "string" &&
    typeof row.createdAt === "string"
  );
}

/**
 * Computes admin summary stats from a list of events:
 * total events, unique users, generated/saved counts, and recent events newest-first.
 * Tolerates malformed entries (they are ignored).
 */
export function summarizePatternActivity(
  events: readonly unknown[],
  options: SummarizePatternActivityOptions = {},
): PatternActivitySummary {
  const recentLimit = Math.max(0, options.recentLimit ?? 25);
  const valid: PatternActivityEvent[] = Array.isArray(events)
    ? (events.filter(isPatternActivityEvent) as PatternActivityEvent[])
    : [];

  const userIds = new Set<string>();
  let generatedCount = 0;
  let savedCount = 0;
  for (const event of valid) {
    userIds.add(event.userId);
    if (event.eventType === "pattern_generated") generatedCount += 1;
    if (event.eventType === "pattern_saved") savedCount += 1;
  }

  const recentEvents = [...valid]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, recentLimit);

  return {
    totalEvents: valid.length,
    uniqueUsers: userIds.size,
    generatedCount,
    savedCount,
    recentEvents,
  };
}

/** Details supplied by callers when logging — identity is resolved automatically. */
export type LogPatternActivityInput = Omit<
  PatternActivityEventInput,
  "userId" | "userEmail" | "id" | "createdAt"
>;

function isDevEnv(): boolean {
  try {
    return typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

function warnInDev(message: string, detail?: unknown): void {
  if (!isDevEnv()) return;
  if (detail !== undefined) console.warn(`[pattern-activity] ${message}`, detail);
  else console.warn(`[pattern-activity] ${message}`);
}

async function resolveCurrentMemberEmail(): Promise<string | undefined> {
  try {
    const ms = typeof window !== "undefined" ? window.$memberstackDom : undefined;
    if (!ms?.getCurrentMember) return undefined;
    const payload = await ms.getCurrentMember();
    return memberEmailFromMemberstackPayload(payload);
  } catch {
    return undefined;
  }
}

/**
 * Best-effort client logging of a pattern activity event. Never throws and never blocks:
 * resolves the logged-in user, builds the event, and fires a request. Returns whether an event
 * was sent (`false` when skipped, e.g. no logged-in user). Failures are swallowed.
 */
export async function logPatternActivity(
  input: LogPatternActivityInput,
): Promise<boolean> {
  try {
    const auth = await resolveCustomPatternProjectAuth();
    const userId =
      auth.mode === "member" ? auth.memberId : auth.mode === "dev" ? auth.devUserId : undefined;
    if (!userId) {
      // Only logged-in (or local dev) users are tracked — silently skip otherwise.
      return false;
    }

    const userEmail = auth.mode === "member" ? await resolveCurrentMemberEmail() : undefined;
    const sourcePage =
      input.sourcePage ??
      (typeof window !== "undefined" ? window.location?.pathname : undefined);

    const event = createPatternActivityEvent({
      ...input,
      userId,
      userEmail,
      sourcePage,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...authHeadersForCustomPatternProjects(auth),
    };

    const res = await fetch(PATTERN_ACTIVITY_LOG_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(event),
      // Allow the request to complete even if the page navigates away (print/save flows).
      keepalive: true,
    });
    if (!res.ok) {
      warnInDev(`log request failed (${res.status})`);
      return false;
    }
    return true;
  } catch (error) {
    warnInDev("log failed; continuing", error);
    return false;
  }
}

/**
 * Pure interpreter for an admin-only pattern-activity GET probe response. Returns true ONLY for a
 * clean `200 { ok: true }`; anything else (403, network/HTTP error, malformed body) is treated as
 * "not admin" so callers fail closed / hidden-by-default. Used by {@link checkPatternActivityAdminAccess}.
 */
export function isPatternActivityAdminProbeOk(status: number, body: unknown): boolean {
  if (status !== 200) return false;
  return Boolean(body && typeof body === "object" && (body as { ok?: unknown }).ok === true);
}

/**
 * Admin detection reused from the pattern-activity dashboard: probes the admin-only GET endpoint
 * (server-side `isActivityAdmin` allowlist) and returns whether the current member is recognized as
 * an admin. Fails CLOSED — any error, 403, or unauthenticated state resolves to `false` so admin-only
 * UI stays hidden when admin status cannot be confirmed client-side.
 */
export async function checkPatternActivityAdminAccess(): Promise<boolean> {
  try {
    const auth = await resolveCustomPatternProjectAuth();
    if (auth.mode === "none") return false;

    const emailHeader: Record<string, string> = {};
    const email = auth.mode === "member" ? await resolveCurrentMemberEmail() : undefined;
    if (email) emailHeader["X-KBM-Member-Email"] = email;

    const res = await fetch(`${PATTERN_ACTIVITY_LOG_ENDPOINT}?limit=1`, {
      method: "GET",
      headers: { ...authHeadersForCustomPatternProjects(auth), ...emailHeader },
    });
    if (res.status === 403) return false;
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      return false;
    }
    return isPatternActivityAdminProbeOk(res.status, body);
  } catch {
    return false;
  }
}
