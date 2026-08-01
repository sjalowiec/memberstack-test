import { toIsoDateOnly, toIsoTimestamp } from "./public";
import {
  billboardMessageHasText,
  sanitizeBillboardHtml,
} from "./sanitizeBillboardHtml";
import type {
  WhatsNewBillboardSettings,
  WhatsNewBillboardSettingsRow,
} from "./types";

export const WHATS_NEW_BILLBOARD_TIME_ZONE = "America/Los_Angeles";

/** Calendar date YYYY-MM-DD in America/Los_Angeles. */
export function losAngelesCalendarDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WHATS_NEW_BILLBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function buildBillboardSettings(
  row: WhatsNewBillboardSettingsRow | null | undefined,
): WhatsNewBillboardSettings | null {
  if (!row) return null;

  const buttonText =
    typeof row.button_text === "string" && row.button_text.trim()
      ? row.button_text.trim()
      : null;
  const buttonDestinationUrl =
    typeof row.button_destination_url === "string" && row.button_destination_url.trim()
      ? row.button_destination_url.trim()
      : null;

  return {
    key: row.key,
    headline: row.headline ?? "",
    message: row.introduction ?? "",
    originalVideoUrl: row.original_video_url,
    safeVimeoEmbedUrl: row.safe_vimeo_embed_url,
    buttonText,
    buttonDestinationUrl,
    startDate: toIsoDateOnly(row.start_date),
    endDate: toIsoDateOnly(row.end_date),
    publishDate: toIsoDateOnly(row.publish_date),
    enabled: Boolean(row.enabled),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

/**
 * Public billboard visibility:
 * enabled, non-empty headline+message, within optional start/end (LA calendar days).
 */
export function getPublicBillboard(
  settings: WhatsNewBillboardSettings | null,
  now: Date = new Date(),
): WhatsNewBillboardSettings | null {
  if (!settings) return null;
  if (!settings.enabled) return null;

  const headline = settings.headline.trim();
  // Sanitize again at the public boundary; never render stored HTML raw.
  const message = sanitizeBillboardHtml(settings.message);
  if (!headline || !billboardMessageHasText(message)) return null;

  const today = losAngelesCalendarDate(now);
  if (settings.startDate && settings.startDate > today) return null;
  if (settings.endDate && settings.endDate < today) return null;

  const hasButton = Boolean(settings.buttonText && settings.buttonDestinationUrl);
  const hasVideo = Boolean(settings.safeVimeoEmbedUrl);

  return {
    ...settings,
    headline,
    message,
    buttonText: hasButton ? settings.buttonText : null,
    buttonDestinationUrl: hasButton ? settings.buttonDestinationUrl : null,
    safeVimeoEmbedUrl: hasVideo ? settings.safeVimeoEmbedUrl : null,
    originalVideoUrl: hasVideo ? settings.originalVideoUrl : settings.originalVideoUrl,
  };
}

export function billboardHasVideo(settings: WhatsNewBillboardSettings): boolean {
  return Boolean(settings.safeVimeoEmbedUrl);
}

export function billboardHasButton(settings: WhatsNewBillboardSettings): boolean {
  return Boolean(settings.buttonText && settings.buttonDestinationUrl);
}
