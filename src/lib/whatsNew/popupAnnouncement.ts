import { whatsNewEntryHref } from "./announcement";
import { WHATS_NEW_BILLBOARD_TIME_ZONE } from "./billboard";
import { toIsoTimestamp } from "./public";
import {
  billboardMessageHasText,
  sanitizeCardDescriptionHtml,
} from "./sanitizeBillboardHtml";
import {
  WHATS_NEW_INTRODUCTION_MAX_LENGTH,
  WHATS_NEW_POPUP_AUDIENCES,
  WHATS_NEW_TITLE_MAX_LENGTH,
  type WhatsNewPopupAudience,
  type WhatsNewValidationResult,
} from "./types";

/** Labels for the one site-wide pop-up. Stored values stay everyone / members. */
export const POPUP_ANNOUNCEMENT_AUDIENCE_LABELS: Record<WhatsNewPopupAudience, string> = {
  everyone: "Everyone",
  members: "Signed-in",
};

export const POPUP_ANNOUNCEMENT_KEY = "site";

export type WhatsNewPopupAnnouncementRow = {
  announcement_id: string;
  source_card_id: string | null;
  title: string;
  introduction: string;
  audience: string;
  expires_at: Date | string | null;
  enabled: boolean;
  updated_at: Date | string;
};

/** The saved pop-up. Independent of the What's New entry it was copied from. */
export type WhatsNewPopupAnnouncement = {
  id: string;
  sourceCardId: string | null;
  title: string;
  introductionHtml: string;
  href: string;
  audience: WhatsNewPopupAudience;
  /** UTC instant when the pop-up stops, or null when it stays until disabled. */
  expiresAt: string | null;
  /** datetime-local value in America/Los_Angeles, or empty. */
  expiresAtLocal: string;
  enabled: boolean;
  updatedAt: string;
};

export type ValidatedPopupAnnouncementInput = {
  title: string;
  introductionHtml: string;
  audience: WhatsNewPopupAudience;
  expiresAt: string | null;
  sourceCardId: string | null;
  enabled: boolean;
};

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const SOURCE_ID = /^[A-Za-z0-9_-]+$/;

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const pick = (type: string): number => {
    const raw = parts.find((part) => part.type === type)?.value ?? "";
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  };
  let hour = pick("hour");
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    pick("year"),
    pick("month") - 1,
    pick("day"),
    hour,
    pick("minute"),
    pick("second"),
  );
  return asUtc - instant.getTime();
}

/** Interpret YYYY-MM-DDTHH:mm as America/Los_Angeles wall time. */
export function losAngelesDateTimeLocalToUtc(value: string): Date | null {
  const match = LOCAL_DATE_TIME.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = timeZoneOffsetMs(new Date(utcGuess), WHATS_NEW_BILLBOARD_TIME_ZONE);
  let utc = utcGuess - offset;
  const offsetAtResult = timeZoneOffsetMs(new Date(utc), WHATS_NEW_BILLBOARD_TIME_ZONE);
  if (offsetAtResult !== offset) utc = utcGuess - offsetAtResult;
  const result = new Date(utc);
  if (utcToLosAngelesDateTimeLocal(result.toISOString()) !== value.trim()) return null;
  return result;
}

export function utcToLosAngelesDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WHATS_NEW_BILLBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string): string => parts.find((part) => part.type === type)?.value ?? "";
  let hour = pick("hour");
  if (hour === "24") hour = "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${hour}:${pick("minute")}`;
}

/** First instant of the next Los Angeles calendar day. The named day is included. */
export function inclusiveLosAngelesDayEnd(day: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!match) return null;
  const next = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1));
  const year = next.getUTCFullYear();
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  const date = String(next.getUTCDate()).padStart(2, "0");
  const end = losAngelesDateTimeLocalToUtc(`${year}-${month}-${date}T00:00`);
  return end ? end.toISOString() : null;
}

export function formatLosAngelesDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: WHATS_NEW_BILLBOARD_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${formatted} America/Los_Angeles`;
}

function isAudience(value: string): value is WhatsNewPopupAudience {
  return (WHATS_NEW_POPUP_AUDIENCES as readonly string[]).includes(value);
}

export function buildPopupAnnouncement(
  row: WhatsNewPopupAnnouncementRow | null | undefined,
): WhatsNewPopupAnnouncement | null {
  if (!row?.announcement_id?.trim() || !isAudience(row.audience)) return null;
  const expiresAt = row.expires_at == null ? null : toIsoTimestamp(row.expires_at) || null;
  const sourceCardId = row.source_card_id?.trim() || null;
  return {
    id: row.announcement_id.trim(),
    sourceCardId,
    title: row.title ?? "",
    introductionHtml: sanitizeCardDescriptionHtml(row.introduction ?? ""),
    href: sourceCardId ? whatsNewEntryHref(sourceCardId) : "/whats-new",
    audience: row.audience,
    expiresAt,
    expiresAtLocal: expiresAt ? utcToLosAngelesDateTimeLocal(expiresAt) : "",
    enabled: Boolean(row.enabled),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

export function isPopupAnnouncementActive(
  announcement: Pick<
    WhatsNewPopupAnnouncement,
    "enabled" | "title" | "introductionHtml" | "expiresAt"
  >,
  now: Date = new Date(),
): boolean {
  if (!announcement.enabled) return false;
  if (!announcement.title.trim()) return false;
  const introduction = sanitizeCardDescriptionHtml(announcement.introductionHtml);
  if (!billboardMessageHasText(introduction)) return false;
  if (!announcement.expiresAt) return true;
  const expires = new Date(announcement.expiresAt);
  if (Number.isNaN(expires.getTime())) return false;
  return now.getTime() < expires.getTime();
}

/**
 * A different What's New entry is a different announcement, so a previous
 * dismissal does not apply. Editing the same entry keeps the id.
 */
export function shouldMintAnnouncementId(
  existing: { id: string; sourceCardId: string | null } | null,
  sourceCardId: string | null,
): boolean {
  if (!existing?.id) return true;
  return (existing.sourceCardId ?? "") !== (sourceCardId ?? "");
}

export function validatePopupAnnouncementInput(
  input: Record<string, unknown>,
): WhatsNewValidationResult<ValidatedPopupAnnouncementInput> {
  const titleRaw = input.title;
  if (typeof titleRaw !== "string" || !titleRaw.trim()) {
    return { ok: false, error: "Pop-up title is required." };
  }
  const title = titleRaw.trim();
  if (title.length > WHATS_NEW_TITLE_MAX_LENGTH) {
    return { ok: false, error: "Pop-up title is too long." };
  }

  const introRaw = input.introductionHtml ?? input.introduction ?? input.description;
  const introductionHtml = sanitizeCardDescriptionHtml(
    typeof introRaw === "string" ? introRaw : "",
  );
  if (!billboardMessageHasText(introductionHtml)) {
    return { ok: false, error: "Pop-up message is required." };
  }
  if (introductionHtml.length > WHATS_NEW_INTRODUCTION_MAX_LENGTH) {
    return { ok: false, error: "Pop-up message is too long." };
  }

  const audienceRaw = input.audience ?? input.popupAudience ?? "everyone";
  const audience = typeof audienceRaw === "string" ? audienceRaw.trim() : "";
  if (!isAudience(audience)) {
    return { ok: false, error: "Audience must be Everyone or Signed-in." };
  }

  let expiresAt: string | null = null;
  const expiresRaw = input.expiresAtLocal ?? input.expires_at_local ?? input.expiresAt;
  if (typeof expiresRaw === "string" && expiresRaw.trim()) {
    const parsed = losAngelesDateTimeLocalToUtc(expiresRaw.trim());
    if (!parsed) {
      return {
        ok: false,
        error: "Expiration must be a date and time in America/Los_Angeles.",
      };
    }
    expiresAt = parsed.toISOString();
  }

  let sourceCardId: string | null = null;
  const sourceRaw = input.sourceCardId ?? input.source_card_id;
  if (typeof sourceRaw === "string" && sourceRaw.trim()) {
    const source = sourceRaw.trim();
    if (!SOURCE_ID.test(source) || source.length > 80) {
      return { ok: false, error: "Choose a What's New entry from the list." };
    }
    sourceCardId = source;
  }

  return {
    ok: true,
    value: {
      title,
      introductionHtml,
      audience,
      expiresAt,
      sourceCardId,
      enabled: Boolean(input.enabled),
    },
  };
}
