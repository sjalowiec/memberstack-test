import { randomUUID } from "node:crypto";

import {
  resolveSearchActivityEnvironment,
  resolveStoredIdentity,
  type SearchActivityEnvironment,
  type SearchActivityIdentity,
} from "../searchActivity";

/** Display and Read more clicks. Preview is never recorded. */
export const WHATS_NEW_ANNOUNCEMENT_ACTIVITY_TYPES = ["displayed", "read_more"] as const;

export type WhatsNewAnnouncementActivityType =
  (typeof WHATS_NEW_ANNOUNCEMENT_ACTIVITY_TYPES)[number];

export type WhatsNewAnnouncementActivityEvent = {
  id: string;
  cardId: string;
  eventType: WhatsNewAnnouncementActivityType;
  identity: SearchActivityIdentity;
  memberId?: string;
  environment: SearchActivityEnvironment;
  sourcePage?: string;
  createdAt: string;
};

export function isWhatsNewAnnouncementActivityType(
  value: unknown,
): value is WhatsNewAnnouncementActivityType {
  return (
    typeof value === "string" &&
    (WHATS_NEW_ANNOUNCEMENT_ACTIVITY_TYPES as readonly string[]).includes(value)
  );
}

function cleanSourcePage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return undefined;
  const pathOnly = trimmed.split("?")[0]?.split("#")[0] ?? "";
  if (!pathOnly.startsWith("/") || pathOnly.includes("\\")) return undefined;
  return pathOnly.slice(0, 180);
}

function cleanCardId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Builds one announcement activity event.
 * A signed-in member id is taken only from the verified session, matching search activity.
 */
export function buildWhatsNewAnnouncementActivityEvent(
  raw: unknown,
  options: {
    verifiedMemberId?: string | null;
    now?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): { ok: true; event: WhatsNewAnnouncementActivityEvent } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Event body required." };
  }
  const body = raw as Record<string, unknown>;
  const cardId = cleanCardId(body.cardId ?? body.card_id);
  if (!cardId) return { ok: false, error: "Announcement id is required." };
  if (!isWhatsNewAnnouncementActivityType(body.eventType ?? body.event_type)) {
    return { ok: false, error: "Event type must be displayed or read_more." };
  }

  const identity = resolveStoredIdentity({
    verifiedMemberId: options.verifiedMemberId,
    clientIdentity: body.identity,
  });

  const event: WhatsNewAnnouncementActivityEvent = {
    id: randomUUID(),
    cardId,
    eventType: (body.eventType ?? body.event_type) as WhatsNewAnnouncementActivityType,
    identity: identity.identity,
    environment: resolveSearchActivityEnvironment(options.env),
    createdAt: options.now ?? new Date().toISOString(),
  };
  if (identity.memberId) event.memberId = identity.memberId;
  const sourcePage = cleanSourcePage(body.sourcePage ?? body.source_page);
  if (sourcePage) event.sourcePage = sourcePage;
  return { ok: true, event };
}
