/**
 * Tip of the Week row ↔ DTO mapping and display helpers.
 */
import type { TipCatalogVideo } from "../tipOfTheWeek";
import { resolveTipCatalogVideo } from "../tipOfTheWeek";
import {
  TIP_DEFAULT_AVAILABILITY_NOTICE,
  TIP_DEFAULT_EYEBROW,
  TIP_DEFAULT_FOOTER_TEMPLATE,
  isTipOfTheWeekStatus,
  type TipOfTheWeekRecord,
  type TipOfTheWeekRow,
  type TipRelatedLink,
} from "./types";

function toIsoDateOnly(value: string | Date | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    return trimmed;
  }
  try {
    return value.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function toIsoTimestamp(value: string | Date | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return value.toISOString();
  } catch {
    return "";
  }
}

function parseJsonArray(raw: string | null | undefined): unknown[] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseLearnPointsJson(raw: string | null | undefined): string[] {
  return parseJsonArray(raw)
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseRelatedLinksJson(
  raw: string | null | undefined,
): TipRelatedLink[] {
  const links: TipRelatedLink[] = [];
  for (const item of parseJsonArray(raw)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const href = typeof row.href === "string" ? row.href.trim() : "";
    if (!label || !href.startsWith("/") || href.startsWith("//")) continue;
    const note =
      typeof row.note === "string" && row.note.trim() ? row.note.trim() : undefined;
    links.push({ label, href, note });
  }
  return links;
}

export function buildTipOfTheWeekRecord(
  row: TipOfTheWeekRow,
): TipOfTheWeekRecord | null {
  if (!row || !isTipOfTheWeekStatus(row.status)) return null;
  const tipId = String(row.tip_id || "").trim();
  const title = String(row.title || "").trim();
  if (!tipId || !title) return null;

  return {
    id: String(row.id),
    tipId,
    title,
    intro: String(row.intro || "").trim(),
    videoContentId: String(row.video_content_id || "").trim(),
    availableFrom: toIsoDateOnly(row.available_from),
    availableThrough: toIsoDateOnly(row.available_through),
    status: row.status,
    availabilityNotice:
      String(row.availability_notice || "").trim() || TIP_DEFAULT_AVAILABILITY_NOTICE,
    availabilityFooterTemplate:
      String(row.availability_footer_template || "").trim() ||
      TIP_DEFAULT_FOOTER_TEMPLATE,
    tryCopy: String(row.try_copy || "").trim(),
    sueTipCopy: String(row.sue_tip_copy || "").trim(),
    learnPoints: parseLearnPointsJson(row.learn_points_json),
    relatedLinks: parseRelatedLinksJson(row.related_links_json),
    eyebrow: String(row.eyebrow || "").trim() || TIP_DEFAULT_EYEBROW,
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

/** Format YYYY-MM-DD for display (UTC calendar components → long US date). */
export function formatTipAvailabilityDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || "").trim());
  if (!match) return String(isoDate || "").trim();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return String(isoDate).trim();
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function tipAvailabilityFooterFromRecord(
  tip: Pick<TipOfTheWeekRecord, "availableThrough" | "availabilityFooterTemplate">,
): string {
  const date = formatTipAvailabilityDate(tip.availableThrough);
  return tip.availabilityFooterTemplate.replace("{date}", date);
}

export function resolveVideoForTip(
  tip: Pick<TipOfTheWeekRecord, "videoContentId">,
): TipCatalogVideo | null {
  return resolveTipCatalogVideo({
    tipId: "",
    eyebrow: "",
    title: "",
    intro: "",
    availabilityNotice: "",
    availableThrough: "",
    videoContentId: tip.videoContentId,
    videoTitle: "",
    learnHeading: "",
    learnPoints: [],
    tryHeading: "",
    tryCopy: "",
    sueTipHeading: "",
    sueTipCopy: "",
    relatedHeading: "",
    relatedLinks: [],
    availabilityFooterTemplate: "{date}",
  });
}

export function filterPublicRelatedLinks(
  links: TipRelatedLink[],
): TipRelatedLink[] {
  return (links || []).filter(
    (link) =>
      typeof link?.href === "string" &&
      link.href.startsWith("/") &&
      !link.href.startsWith("//") &&
      !link.href.includes("example.com") &&
      !link.href.includes("#todo") &&
      typeof link.label === "string" &&
      link.label.trim().length > 0,
  );
}
